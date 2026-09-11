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
  async processPendingMessages(limit = 20, accountJid) {
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
        AND m.timestamp >= NOW() - INTERVAL '24 hours'
        AND NOT EXISTS (
          SELECT 1 FROM ai_actions a WHERE a.source_message_id = m.id
        )
      ORDER BY m.timestamp DESC
      LIMIT $${params.length};
    `;

    try {
      const result = await supabase.query(query, params);
      if (result.rows.length === 0) {
        return;
      }

      console.log(`[AI Engine] Backfilling/Processing ${result.rows.length} pending WhatsApp message(s)...`);

      for (const message of result.rows) {
        const res = await this._processAsync(message);
        if (res && res.isRateLimited) {
          console.warn('[AI Engine] Rate limit reached across models. Pausing queue.');
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 250));
      }
    } catch (error) {
      console.error('[AI Engine] Pending message processing failed:', error.message);
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

    // Outgoing messages don't need AI analysis/replies
    if (message.from_me) {
      return { success: true };
    }

    const accountJid = message.account_jid || 'default_user';

    try {
      // Avoid re-processing if action already exists for this exact source_message_id
      const existingActionForMsg = await supabase.query(
        `SELECT id FROM ai_actions WHERE source_message_id = $1 AND account_jid = $2 LIMIT 1;`,
        [message.id, accountJid]
      );
      if (existingActionForMsg.rows.length > 0) {
        return { success: true };
      }

      // 1. Fetch Contact & Relationship Context
      const contact = await contactService.findContactByJid(message.chat_jid, accountJid) || {
        jid: message.chat_jid,
        name: null
      };

      // 2. Fetch Recent Conversation Thread History
      const threadHistory = await messageService.getRecentThreadHistory(message.chat_jid, 10, message.id, accountJid);

      // 3. Process extraction using AI Extraction Service
      console.log(`[AI Engine] Analyzing message ${message.id} from ${contact.name || message.chat_jid}`);
      const extractionRes = await extractionService.processMessage(message.text, message.timestamp);
      
      let normalized = null;
      if (extractionRes.success && extractionRes.data) {
        normalized = extractionService.normalizeExtraction(extractionRes.data);
      }

      // 4. Fallback / Augment with Reply Service if needed
      let suggestedReply = normalized?.suggestedReply || null;
      let replyReason = normalized?.whyItMatters || null;

      if (!normalized || !suggestedReply) {
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

        if (replyResult.success && replyResult.data) {
          const rData = replyResult.data;
          if (rData.needs_reply && rData.suggested_reply) {
            suggestedReply = rData.suggested_reply;
            replyReason = rData.reason;
            
            if (!normalized) {
              const actType = rData.action_type || 'ai_reply';
              let category = 'ai_auto_reply';
              if (actType === 'birthday') category = 'important_event';
              else if (actType === 'follow_up' || actType === 'incident') category = 'needs_action';

              normalized = {
                category,
                subtype: actType,
                confidence: 0.92,
                status: 'active',
                whatMatters: rData.event_details?.title || (category === 'needs_action' ? 'Action Required' : 'Message Received'),
                whyItMatters: rData.reason || 'AI detected a response is expected.',
                recommendedAction: suggestedReply ? 'Send suggested reply' : 'Review message context',
                suggestedReply: rData.suggested_reply
              };
            }
          }
        }
      }

      // 5. If item is classified as important / relevant, store it permanently in database
      if (normalized && normalized.category) {
        const { category, subtype, whatMatters, whyItMatters, recommendedAction, confidence } = normalized;

        // Save suggested reply if available
        let suggestedReplyId = null;
        if (suggestedReply) {
          const insertReplyQuery = `
            INSERT INTO suggested_replies (
              account_jid, contact_id, chat_jid, source_message_id, suggested_reply, action_type, reason, tone, status, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'casual', 'pending', NOW(), NOW())
            RETURNING id;
          `;
          const replyRes = await supabase.query(insertReplyQuery, [
            accountJid,
            message.contact_id || contact.id,
            message.chat_jid,
            message.id,
            suggestedReply,
            subtype || category,
            whyItMatters
          ]);
          suggestedReplyId = replyRes.rows[0]?.id;
        }

        // Save unique AI Action record (DO NOT OVERWRITE previous actions!)
        const insertActionQuery = `
          INSERT INTO ai_actions (
            account_jid, contact_id, chat_jid, source_message_id, suggested_reply_id, type, category, subtype, title, meaning, description, next_step, status, priority, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'active', 1.0, NOW(), NOW())
          RETURNING id;
        `;
        const actionRes = await supabase.query(insertActionQuery, [
          accountJid,
          message.contact_id || contact.id,
          message.chat_jid,
          message.id,
          suggestedReplyId,
          subtype || category,
          category,
          subtype || category,
          whatMatters,
          whyItMatters,
          whyItMatters,
          recommendedAction
        ]);

        console.log(`[AI Engine] Created Intelligence Action (ID: ${actionRes.rows[0]?.id}) [${category} / ${subtype}] for msg ${message.id}`);

        // Save to extractions table
        const insertExtrQuery = `
          INSERT INTO extractions (account_jid, contact_id, source_message_id, type, payload, confidence, status, extracted_at)
          VALUES ($1, $2, $3, $4, $5, $6, 'active', NOW())
          RETURNING id;
        `;
        await supabase.query(insertExtrQuery, [
          accountJid,
          message.contact_id || contact.id,
          message.id,
          category,
          JSON.stringify({
            category,
            subtype,
            what_matters: whatMatters,
            why_it_matters: whyItMatters,
            recommended_action: recommendedAction,
            suggested_reply: suggestedReply
          }),
          confidence || 0.95
        ]);

        // Trigger Push Notification for high priority extractions
        if (category === 'needs_action' || subtype === 'urgent' || subtype === 'important_conversation' || subtype === 'meeting') {
          const pushService = require('./push.service');
          const contactName = contact.name || message.chat_jid.split('@')[0];
          await pushService.sendPushNotification(
            accountJid, 
            `Action Needed: ${contactName}`, 
            whatMatters || 'Urgent message requires your attention'
          );
        }

        return { success: true };
      } else {
        console.log(`[AI Engine] Message ${message.id} filtered out (casual chatter / low value).`);
        return { success: true };
      }
    } catch (err) {
      console.error(`[MessageProcessor] Error processing message ${message.id}:`, err.message);
      return { success: false, error: err.message };
    }
  }
}

module.exports = new MessageProcessorService();
