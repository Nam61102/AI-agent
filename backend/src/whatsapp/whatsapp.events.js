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
            message;

  if (m.conversation) {
    return { text: m.conversation, type: 'text', hasMedia: false };
  }
  if (m.extendedTextMessage?.text) {
    return { text: m.extendedTextMessage.text, type: 'text', hasMedia: false };
  }
  if (m.imageMessage) {
    return { text: m.imageMessage.caption || '', type: 'image', hasMedia: true };
  }
  if (m.videoMessage) {
    return { text: m.videoMessage.caption || '', type: 'video', hasMedia: true };
  }
  if (m.audioMessage) {
    return { text: '', type: 'audio', hasMedia: true };
  }
  if (m.documentMessage) {
    return { text: m.documentMessage.caption || m.documentMessage.fileName || '', type: 'document', hasMedia: true };
  }
  if (m.stickerMessage) {
    return { text: '', type: 'sticker', hasMedia: true };
  }
  if (m.contactMessage || m.contactsArrayMessage) {
    return { text: '[Contact]', type: 'contact', hasMedia: false };
  }
  if (m.locationMessage || m.liveLocationMessage) {
    return { text: '[Location]', type: 'location', hasMedia: false };
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
      if (!rawChatJid || !messageId || rawChatJid === 'status@broadcast' || rawChatJid.endsWith('@g.us') && !rawMsg.message) {
        continue;
      }
      
      const chatJid = getCanonicalJid(rawChatJid);

      // Check if chat/contact is excluded BEFORE saving
      const existingContact = await contactService.findContactByJid(chatJid);
      if (existingContact && existingContact.excluded === true) {
        console.log(`[WhatsAppEvents] Chat JID ${chatJid} is marked as excluded. Skipping message.`);
        continue;
      }

      // Extract normalized content
      const fromMe = Boolean(rawMsg.key.fromMe);
      const { text, type: messageType, hasMedia } = extractMessageContent(rawMsg);
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
