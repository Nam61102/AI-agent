const whatsappClient = require('../whatsapp/whatsapp.client');

async function connect(req, res) {
  try {
    const result = await whatsappClient.connect();
    return res.status(200).json({
      success: true,
      status: whatsappClient.getStatus(),
      requiresScan: result.requiresScan === true
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

async function requestPairingCode(req, res) {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
      return res.status(400).json({ success: false, error: 'phoneNumber is required' });
    }
    const result = await whatsappClient.requestPairingCode(phoneNumber);
    return res.status(200).json({
      success: true,
      code: result.code,
      status: whatsappClient.getStatus()
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

async function getStatus(req, res) {
  try {
    return res.status(200).json({
      success: true,
      status: whatsappClient.getStatus()
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

async function disconnect(req, res) {
  try {
    await whatsappClient.disconnect();
    
    // Clear all data associated with this WhatsApp number
    const supabase = require('../config/supabase');
    await supabase.query('DELETE FROM extractions;');
    await supabase.query('DELETE FROM messages;');
    await supabase.query('DELETE FROM contacts;');
    console.log('[WhatsAppController] Database wiped clean on disconnect.');

    return res.status(200).json({
      success: true,
      status: whatsappClient.getStatus()
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

async function getQR(req, res) {
  try {
    const qr = whatsappClient.getQR();
    const pairingCode = whatsappClient.getPairingCode();
    return res.status(200).json({
      success: true,
      qr: qr || null,
      pairingCode: pairingCode || null,
      status: whatsappClient.getStatus()
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

const messageService = require('../services/message.service');

async function getChats(req, res) {
  try {
    const auth = require('../whatsapp/whatsapp.auth');
    if (!auth.sessionExists()) {
      return res.status(200).json({ success: true, chats: [] });
    }

    const realtimeChats = whatsappClient.getSortedChats();
    const storedChats = await messageService.getChats();
    const chatsByJid = new Map(storedChats.map(chat => [chat.jid, chat]));

    for (const chat of realtimeChats) {
      chatsByJid.set(chat.jid, chat);
    }

    const chats = Array.from(chatsByJid.values()).sort((a, b) => {
      if (a.needs_reply && !b.needs_reply) return -1;
      if (!a.needs_reply && b.needs_reply) return 1;
      return new Date(b.last_message_timestamp).getTime() - new Date(a.last_message_timestamp).getTime();
    });

    return res.status(200).json({
      success: true,
      chats
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

const { getCanonicalJid } = require('../whatsapp/whatsapp.utils');

async function sendMessage(req, res) {
  try {
    const { jid, text } = req.body;
    if (!jid || !text) {
      return res.status(400).json({ success: false, error: 'jid and text are required' });
    }
    const canonicalJid = getCanonicalJid(jid);
    await whatsappClient.sendMessage(canonicalJid, text);

    // Save sent message to Supabase
    await messageService.saveMessage({
      chat_jid: canonicalJid,
      sender_jid: 'me',
      from_me: true,
      timestamp: new Date().toISOString(),
      text,
      message_type: 'text',
      has_media: false,
      whatsapp_message_id: 'sent_' + Date.now()
    });

    // Automatically mark pending AI replies for this chat as sent/dismissed
    try {
      const supabase = require('../config/supabase');
      await supabase.query(
        `UPDATE ai_actions SET status = 'dismissed', updated_at = NOW() 
         WHERE chat_jid = $1 AND type = 'reply_needed' AND status = 'active'`,
        [canonicalJid]
      );
      await supabase.query(
        `UPDATE suggested_replies SET status = 'sent', updated_at = NOW()
         WHERE chat_jid = $1 AND status = 'pending'`,
        [canonicalJid]
      );
    } catch (e) {
      console.warn('[WhatsAppController] Failed to auto-dismiss pending replies:', e.message);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

async function getCurrentContacts(req, res) {
  try {
    const contacts = whatsappClient.getCurrentSessionContacts();
    return res.status(200).json({
      success: true,
      count: contacts.length,
      contacts: contacts
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

async function getRecentChats(req, res) {
  try {
    const auth = require('../whatsapp/whatsapp.auth');
    if (!auth.sessionExists()) {
      return res.status(200).json({ success: true, timeframe: 'Last 6 hours', count: 0, chats: [] });
    }
    const hours = parseInt(req.query.hours) || 6;
    const messageService = require('../services/message.service');
    const dbChats = await messageService.getChats();
    const realtimeChats = whatsappClient.getSortedChats();
    
    const chatMap = new Map();

    // 1. Populate from DB
    for (const chat of dbChats) {
      if (!chat.last_message_text || chat.last_message_text.trim() === '') continue;
      chatMap.set(chat.jid, {
        jid: chat.jid,
        name: chat.name,
        is_group: chat.is_group,
        last_message_text: chat.last_message_text,
        last_message_timestamp: new Date(chat.last_message_timestamp).toISOString(),
        needs_reply: chat.needs_reply,
        unread_count: chat.needs_reply ? 1 : 0
      });
    }

    // 2. Merge with real-time memory if newer
    for (const chat of realtimeChats) {
      if (!chat.last_message_text || chat.last_message_text.trim() === '') continue;
      const existing = chatMap.get(chat.jid);
      if (!existing || new Date(chat.last_message_timestamp).getTime() >= new Date(existing.last_message_timestamp).getTime()) {
        chatMap.set(chat.jid, {
          jid: chat.jid,
          name: chat.name || existing?.name || 'Contact',
          is_group: Boolean(chat.jid?.endsWith('@g.us')),
          last_message_text: chat.last_message_text,
          last_message_timestamp: new Date(chat.last_message_timestamp).toISOString(),
          needs_reply: chat.needs_reply,
          unread_count: chat.unread_count || (chat.needs_reply ? 1 : 0)
        });
      }
    }

    const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);
    const sortedChats = Array.from(chatMap.values())
      .filter(chat => new Date(chat.last_message_timestamp).getTime() >= cutoffTime)
      .sort((a, b) => new Date(b.last_message_timestamp).getTime() - new Date(a.last_message_timestamp).getTime());

    return res.status(200).json({
      success: true,
      timeframe: `Last ${hours} hours`,
      count: sortedChats.length,
      chats: sortedChats
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

async function getChatMessages(req, res) {
  try {
    const auth = require('../whatsapp/whatsapp.auth');
    if (!auth.sessionExists()) {
      return res.status(200).json({ success: true, timeframe: 'Last 6 hours', count: 0, messages: [] });
    }
    const jid = req.params.jid;
    if (!jid) return res.status(400).json({ success: false, error: 'JID is required' });

    const hours = parseInt(req.query.hours) || 6;
    const messageService = require('../services/message.service');
    const recentMessages = await messageService.getChatMessages(jid, hours);

    return res.status(200).json({
      success: true,
      timeframe: `Last ${hours} hours`,
      count: recentMessages.length,
      messages: recentMessages
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = {
  connect,
  requestPairingCode,
  getStatus,
  disconnect,
  getQR,
  getChats,
  sendMessage,
  getCurrentContacts,
  getRecentChats,
  getChatMessages
};
