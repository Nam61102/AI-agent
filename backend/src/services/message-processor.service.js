const extractionService = require('../ai/extraction.service');
const replyService = require('../ai/reply.service');
const contactService = require('./contact.service');
const messageService = require('./message.service');
const supabase = require('../config/supabase');

class MessageProcessorService {
  /**
   * Process a saved message asynchronously
   * @param {Object} message The saved message record from Supabase
   */
  async process(message) {
    // Fire and forget, don't wait for it
    this._processAsync(message).catch(err => {
      console.error(`[MessageProcessor] Unhandled error processing message ${message?.id}:`, err.message);
    });
  }

  /**
   * Controlled backfill processing (only recent 15 minutes by default on startup)
   */
  async processPendingMessages(limit = 10) {
    const query = `
      SELECT m.*
      FROM messages m
      WHERE m.message_type = 'text'
        AND m.from_me = false
        AND NULLIF(TRIM(m.text), '') IS NOT NULL
        AND m.timestamp >= NOW() - INTERVAL '15 minutes'
        AND NOT EXISTS (
          SELECT 1 FROM suggested_replies sr WHERE sr.source_message_id = m.id
        )
      ORDER BY m.timestamp DESC
      LIMIT $1;
    `;

    try {
      const result = await supabase.query(query, [limit]);
      if (result.rows.length === 0) {
        console.log('[AI] No pending live messages to process on startup.');
        return;
      }

      console.log(`[AI] Processing ${result.rows.length} recent pending message(s)`);

      for (const message of result.rows) {
        const res = await this._processAsync(message);
        if (res && res.isRateLimited) {
          console.warn('[AI] Rate limit reached across models. Pausing startup queue.');
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    } catch (error) {
      console.error('[AI] Pending message processing failed:', error.message);
    }
  }

  async _processAsync(message) {
    if (!message || !message.id || !message.text || message.text.trim() === '') {
      return { success: true };
    }

    // Only process text messages
    if (message.message_type !== 'text') {
      return { success: true };
    }

    // Outgoing messages don't need AI suggested replies
    if (message.from_me) {
      return { success: true };
    }

    try {
      // 1. Fetch Contact & Relationship Context
      const contact = await contactService.findContactByJid(message.chat_jid) || {
        jid: message.chat_jid,
        name: null
      };

      // 2. Fetch Recent Conversation Thread History (up to 10 messages for rich language & tone context)
      const threadHistory = await messageService.getRecentThreadHistory(message.chat_jid, 10, message.id);

      // 3. Trigger Conversational Reply Engine with Language & Slang detection
      console.log(`[AI Reply] Analyzing incoming message ${message.id} from ${contact.name || message.chat_jid}`);
      const replyResult = await replyService.generateReply({
        contact: {
          name: contact.name,
          jid: contact.jid,
          layer: contact.layer,
          is_group: message.chat_jid.endsWith('@g.us')
        },
        conversationHistory: threadHistory,
        currentMessage: {
          id: message.id,
          sender: contact.name || message.sender_jid,
          text: message.text,
          timestamp: message.timestamp
        }
      });

      if (replyResult.success && replyResult.data && replyResult.data.needs_reply && replyResult.data.suggested_reply) {
        const { 
          action_type = 'reply_needed', 
          suggested_reply, 
          reason, 
          detected_language,
          detected_tone,
          event_details 
        } = replyResult.data;

        // Check if reply already created for this source message
        const existingReply = await supabase.query(
          `SELECT id FROM suggested_replies WHERE source_message_id = $1 LIMIT 1;`,
          [message.id]
        );

        let suggestedReplyId = null;

        if (existingReply.rows.length === 0) {
          const insertReplyQuery = `
            INSERT INTO suggested_replies (
              contact_id, chat_jid, source_message_id, suggested_reply, action_type, reason, tone, status, created_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', NOW())
            RETURNING id;
          `;
          const replyRes = await supabase.query(insertReplyQuery, [
            message.contact_id || contact.id,
            message.chat_jid,
            message.id,
            suggested_reply,
            action_type,
            reason,
            detected_tone || 'casual'
          ]);
          suggestedReplyId = replyRes.rows[0]?.id;
          console.log(`[AI Reply] Suggested reply saved (ID: ${suggestedReplyId}, Lang: ${detected_language}) for message ${message.id}`);
        } else {
          // Update existing with improved reply
          suggestedReplyId = existingReply.rows[0].id;
          await supabase.query(
            `UPDATE suggested_replies SET suggested_reply = $1, reason = $2, tone = $3, updated_at = NOW() WHERE id = $4`,
            [suggested_reply, reason, detected_tone || 'casual', suggestedReplyId]
          );
        }

        // Create or update unique active AI Action for this chat
        const existingAction = await supabase.query(
          `SELECT id FROM ai_actions WHERE chat_jid = $1 AND status = 'active' LIMIT 1;`,
          [message.chat_jid]
        );

        let title = action_type === 'birthday' 
          ? 'Birthday' 
          : action_type === 'follow_up' 
          ? 'Follow Up' 
          : action_type === 'incident'
          ? 'Urgent Incident'
          : 'Reply Needed';

        if (event_details?.title) {
          title = event_details.title;
        }

        if (existingAction.rows.length === 0) {
          const insertActionQuery = `
            INSERT INTO ai_actions (
              contact_id, chat_jid, source_message_id, suggested_reply_id, type, title, description, status, priority, created_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', 1.0, NOW())
            RETURNING id;
          `;
          const actionRes = await supabase.query(insertActionQuery, [
            message.contact_id || contact.id,
            message.chat_jid,
            message.id,
            suggestedReplyId,
            action_type,
            title,
            reason
          ]);
          console.log(`[AI Reply] AI Action created (ID: ${actionRes.rows[0]?.id}) [${action_type}] for message ${message.id}`);
        } else {
          await supabase.query(
            `UPDATE ai_actions 
             SET source_message_id = $1, 
                 suggested_reply_id = $2, 
                 title = $3, 
                 description = $4, 
                 type = $5, 
                 updated_at = NOW() 
             WHERE id = $6`,
            [message.id, suggestedReplyId, title, reason, action_type, existingAction.rows[0].id]
          );
          console.log(`[AI Reply] AI Action updated (ID: ${existingAction.rows[0].id}) for chat ${message.chat_jid}`);
        }

        // Also save extracted event to extractions table if event_details present
        if (event_details && (event_details.title || event_details.date)) {
          const checkExtr = await supabase.query(
            `SELECT id FROM extractions WHERE source_message_id = $1 LIMIT 1;`,
            [message.id]
          );
          if (checkExtr.rows.length === 0) {
            const extrType = action_type === 'birthday' ? 'life_event' : action_type === 'incident' ? 'incident' : 'task';
            await supabase.query(
              `INSERT INTO extractions (contact_id, source_message_id, type, payload, confidence, status)
               VALUES ($1, $2, $3, $4, 0.95, 'active')`,
              [
                message.contact_id || contact.id,
                message.id,
                extrType,
                JSON.stringify(event_details)
              ]
            );
          }
        }
      } else {
        console.log(`[AI Reply] No reply needed for message ${message.id}: ${replyResult.data?.reason || 'Conversational closing'}`);
        // If no reply is needed, dismiss any old pending reply_needed action for this chat
        await supabase.query(
          `UPDATE ai_actions SET status = 'dismissed', updated_at = NOW() 
           WHERE chat_jid = $1 AND type = 'reply_needed' AND status = 'active'`,
          [message.chat_jid]
        );
      }

      // 4. Also perform Life/Event extraction for any specific entity parsing
      await this._processExtraction(message);

      return { success: true };
    } catch (err) {
      console.error(`[MessageProcessor] Error processing message ${message.id}:`, err.message);
      return { success: false, error: err.message };
    }
  }

  async _processExtraction(message) {
    try {
      const textLower = message.text.trim().toLowerCase();
      const ignoredPhrases = ['hey', 'hi', 'hello', 'ok', 'okay', 'yes', 'no', 'k', 'cool', 'thanks'];
      if (textLower.length < 3 || ignoredPhrases.includes(textLower)) {
        return;
      }

      const checkQuery = `SELECT id FROM extractions WHERE source_message_id = $1 LIMIT 1;`;
      const checkRes = await supabase.query(checkQuery, [message.id]);
      if (checkRes.rows.length > 0) return;

      const result = await extractionService.processMessage(message.text, message.timestamp);
      if (result.success && result.data) {
        const extraction = extractionService.normalizeExtraction(result.data);
        if (extraction) {
          const insertQuery = `
            INSERT INTO extractions (contact_id, source_message_id, type, payload, confidence, status)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id;
          `;
          await supabase.query(insertQuery, [
            message.contact_id,
            message.id,
            extraction.type,
            extraction.payload,
            extraction.confidence,
            extraction.status
          ]);
          console.log(`[AI Extraction] Event extracted (${extraction.type}) for message ${message.id}`);
        }
      }
    } catch (err) {
      console.warn(`[AI Extraction] Extraction skipped for message ${message.id}:`, err.message);
    }
  }
}

module.exports = new MessageProcessorService();
