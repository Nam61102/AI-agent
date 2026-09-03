const contactService = require('../services/contact.service');
const messageService = require('../services/message.service');
const { getCanonicalJid } = require('./whatsapp.utils');

/**
 * Extract normalized text, type, and media flag from a Baileys message object
 * @param {Object} msg Baileys raw message
 */
function extractMessageContent(msg) {
  if (!msg || !msg.message) {
    return { text: '', type: 'unknown', hasMedia: false };
  }

  const message = msg.message;
  // Handle ephemeral or viewOnce wrappers
  const m = message.ephemeralMessage?.message || 
            message.viewOnceMessage?.message || 
            message.viewOnceMessageV2?.message || 
            message.documentWithCaptionMessage?.message ||
            message;

  if (m.conversation) {
    return { text: m.conversation, type: 'text', hasMedia: false };
  }
  if (m.extendedTextMessage?.text) {
    return { text: m.extendedTextMessage.text, type: 'text', hasMedia: false };
  }
  if (m.imageMessage) {
    return { text: m.imageMessage.caption || '📷 Photo', type: 'image', hasMedia: true };
  }
  if (m.videoMessage) {
    return { text: m.videoMessage.caption || '🎥 Video', type: 'video', hasMedia: true };
  }
  if (m.audioMessage) {
    return { text: '🎵 Voice message', type: 'audio', hasMedia: true };
  }
  if (m.documentMessage) {
    return { text: m.documentMessage.caption || m.documentMessage.fileName || '📄 Document', type: 'document', hasMedia: true };
  }
  if (m.stickerMessage) {
    return { text: '✨ Sticker', type: 'sticker', hasMedia: true };
  }
  if (m.contactMessage || m.contactsArrayMessage) {
    return { text: '👤 Contact', type: 'contact', hasMedia: false };
  }
  if (m.locationMessage || m.liveLocationMessage) {
    return { text: '📍 Location', type: 'location', hasMedia: false };
  }
  if (m.pollCreationMessage) {
    return { text: '📊 Poll: ' + (m.pollCreationMessage.name || ''), type: 'poll', hasMedia: false };
  }
  if (m.buttonsResponseMessage?.selectedDisplayText || m.buttonsResponseMessage?.selectedButtonId) {
    return { text: m.buttonsResponseMessage.selectedDisplayText || m.buttonsResponseMessage.selectedButtonId, type: 'text', hasMedia: false };
  }
  if (m.listResponseMessage?.title || m.listResponseMessage?.description) {
    return { text: m.listResponseMessage.title || m.listResponseMessage.description, type: 'text', hasMedia: false };
  }
  if (m.templateButtonReplyMessage?.selectedDisplayText || m.templateButtonReplyMessage?.selectedId) {
    return { text: m.templateButtonReplyMessage.selectedDisplayText || m.templateButtonReplyMessage.selectedId, type: 'text', hasMedia: false };
  }

  return { text: '', type: 'other', hasMedia: false };
}

/**
 * Handle incoming Baileys messages upsert event
 * @param {Object} upsert Baileys upsert payload
 */
async function handleIncomingMessages(upsert) {
  if (!upsert || !upsert.messages || !Array.isArray(upsert.messages)) {
    return;
  }

  for (const rawMsg of upsert.messages) {
    try {
      const rawChatJid = rawMsg.key?.remoteJid;
      const messageId = rawMsg.key?.id;

      // Ignore broadcast status updates, protocol messages, or empty keys
      if (!rawChatJid || !messageId || rawChatJid === 'status@broadcast' || (rawChatJid.endsWith('@g.us') && !rawMsg.message)) {
        continue;
      }

      // Extract normalized content
      const fromMe = Boolean(rawMsg.key.fromMe);
      const { text, type: messageType, hasMedia } = extractMessageContent(rawMsg);

      // If message has no meaningful text content (e.g. protocol sync, sender key distribution, reactions, etc.), skip saving it
      if (!text || text.trim() === '') {
        continue;
      }
      
      const chatJid = getCanonicalJid(rawChatJid);

      // Check if chat/contact is excluded BEFORE saving
      const existingContact = await contactService.findContactByJid(chatJid);
      if (existingContact && existingContact.excluded === true) {
        console.log(`[WhatsAppEvents] Chat JID ${chatJid} is marked as excluded. Skipping message.`);
        continue;
      }
      const senderJid = fromMe
        ? 'me'
        : getCanonicalJid(rawMsg.key.participant || rawChatJid);
      const timestamp = rawMsg.messageTimestamp
        ? new Date(rawMsg.messageTimestamp * 1000).toISOString()
        : new Date().toISOString();

      // Find or create contact
      const contact = await contactService.findOrCreateContact({
        jid: chatJid,
        name: rawMsg.pushName || null
      });

      // Construct normalized message object
      const normalizedMessage = {
        contact_id: contact.id,
        chat_jid: chatJid,
        sender_jid: senderJid,
        from_me: fromMe,
        timestamp: timestamp,
        text: text,
        message_type: messageType,
        has_media: hasMedia,
        whatsapp_message_id: messageId
      };

    // Save message in Supabase
    const saved = await messageService.saveMessage(normalizedMessage);

    if (fromMe) {
      // If the user sent a message from their mobile/web WhatsApp, auto-dismiss any pending reply_needed actions for this chat
      try {
        const supabase = require('../config/supabase');
        await supabase.query(
          `UPDATE ai_actions SET status = 'dismissed', updated_at = NOW() 
           WHERE chat_jid = $1 AND type = 'reply_needed' AND status = 'active'`,
          [chatJid]
        );
        await supabase.query(
          `UPDATE suggested_replies SET status = 'sent', updated_at = NOW()
           WHERE chat_jid = $1 AND status = 'pending'`,
          [chatJid]
        );
      } catch (e) {
        console.warn('[WhatsAppEvents] Failed to dismiss pending replies on outgoing message:', e.message);
      }
    }
    
    // Trigger AI Extraction asynchronously
    if (saved) {
      const messageProcessor = require('../services/message-processor.service');
      messageProcessor.process(saved);
    }

  } catch (err) {
    console.error('[WhatsAppEvents] Error processing message:', err.message);
  }
  }
}

module.exports = {
  extractMessageContent,
  handleIncomingMessages
};
