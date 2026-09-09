const extractionService = require('../ai/extraction.service');
const replyService = require('../ai/reply.service');
const contactService = require('./contact.service');
const messageService = require('./message.service');
const supabase = require('../config/supabase');

class MessageProcessorService {
  /**
   * Process a saved message asynchronously
   * @param {Object} message The saved message record from database
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
  async processPendingMessages(limit = 10, accountJid) {
    const params = [limit];
    let accountFilter = '';
    if (accountJid) {
      params.unshift(accountJid);
      accountFilter = 'AND m.account_jid = $1';
    }

    const query = `
      SELECT m.*
      FROM messages m
      WHERE m.message_type = 'text'
        AND m.from_me = false
        AND NULLIF(TRIM(m.text), '') IS NOT NULL
        ${accountFilter}
        AND m.timestamp >= NOW() - INTERVAL '15 minutes'
        AND NOT EXISTS (
          SELECT 1 FROM suggested_replies sr WHERE sr.source_message_id = m.id
        )
      ORDER BY m.timestamp DESC
      LIMIT $${params.length};
    `;

    try {
      const result = await supabase.query(query, params);
      if (result.rows.length === 0) {
        return;
      }

      console.log(`[AI] Processing ${result.rows.length} recent pending message(s)`);

      for (const message of result.rows) {
        const res = await this._processAsync(message);
        if (res && res.isRateLimited) {
          console.warn('[AI] Rate limit reached across models. Pausing queue.');
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

    const accountJid = message.account_jid || 'default_user';

    try {
      // 1. Fetch Contact & Relationship Context
      const contact = await contactService.findContactByJid(message.chat_jid, accountJid) || {
        jid: message.chat_jid,
        name: null
      };

      // 2. Fetch Recent Conversation Thread History (up to 10 messages for rich language & tone context)
      const threadHistory = await messageService.getRecentThreadHistory(message.chat_jid, 10, message.id, accountJid);

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

      if (!replyResult.success) {
        console.warn(`[AI Reply] Analysis unavailable for msg ${message.id}:`, replyResult.error);
        return replyResult;
      }

      const { should_reply, action_type, suggested_reply, reason, detected_language, detected_tone, event_details } = replyResult.data || {};

      if (should_reply && suggested_reply) {
        // Save Suggested Reply to Database scoped to account_jid
        let suggestedReplyId = null;
        const existingReply = await supabase.query(
          `SELECT id FROM suggested_replies WHERE source_message_id = $1 AND account_jid = $2 LIMIT 1;`,
          [message.id, accountJid]
        );

        if (existingReply.rows.length === 0) {
          const insertReplyQuery = `
            INSERT INTO suggested_replies (
              account_jid, contact_id, chat_jid, source_message_id, suggested_reply, action_type, reason, tone, status, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', NOW(), NOW())
            RETURNING id;
          `;
          const replyRes = await supabase.query(insertReplyQuery, [
            accountJid,
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
          suggestedReplyId = existingReply.rows[0].id;
          await supabase.query(
            `UPDATE suggested_replies SET suggested_reply = $1, reason = $2, tone = $3, updated_at = NOW() WHERE id = $4`,
            [suggested_reply, reason, detected_tone || 'casual', suggestedReplyId]
          );
        }

        // Create or update unique active AI Action for this chat scoped to account_jid
        const existingAction = await supabase.query(
          `SELECT id FROM ai_actions WHERE chat_jid = $1 AND account_jid = $2 AND status = 'active' LIMIT 1;`,
          [message.chat_jid, accountJid]
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
              account_jid, contact_id, chat_jid, source_message_id, suggested_reply_id, type, title, description, status, priority, created_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', 1.0, NOW())
            RETURNING id;
          `;
          const actionRes = await supabase.query(insertActionQuery, [
            accountJid,
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
            `SELECT id FROM extractions WHERE source_message_id = $1 AND account_jid = $2 LIMIT 1;`,
            [message.id, accountJid]
          );
          if (checkExtr.rows.length === 0) {
            const extrType = action_type === 'birthday' ? 'life_event' : action_type === 'incident' ? 'incident' : 'task';
            await supabase.query(
              `INSERT INTO extractions (account_jid, contact_id, source_message_id, type, payload, confidence, status)
               VALUES ($1, $2, $3, $4, $5, 0.95, 'active')`,
              [
                accountJid,
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
      }

      return { success: true };
    } catch (err) {
      console.error(`[MessageProcessor] Error processing message ${message.id}:`, err.message);
      return { success: false, error: err.message };
    }
  }
}

module.exports = new MessageProcessorService();
