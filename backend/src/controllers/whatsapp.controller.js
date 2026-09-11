const whatsappClient = require('../whatsapp/whatsapp.client');
const messageService = require('../services/message.service');
const { getCanonicalJid, formatPhoneNumber } = require('../whatsapp/whatsapp.utils');

async function connect(req, res) {
  try {
    const sessionId = req.sessionId || 'default';
    const result = await whatsappClient.connect(sessionId);
    return res.status(200).json({
      success: true,
      status: whatsappClient.getStatus(sessionId),
      requiresScan: result.requiresScan === true,
      sessionId
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to generate pairing code'
    });
  }
}

async function requestPairingCode(req, res) {
  try {
    const sessionId = req.sessionId || 'default';
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
      return res.status(400).json({ success: false, status: 'ERROR', error: 'phoneNumber is required' });
    }
    const session = whatsappClient.getSession(sessionId);
    const requestCode = () => Promise.race([
      session.requestPairingCode(phoneNumber),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Pairing request timed out. Please wait a moment and request a new code.')), 25000))
    ]);

    let result;
    try {
      result = await requestCode();
    } catch (firstError) {
      if (!/connection closed|stream errored|socket closed/i.test(firstError?.message || '')) {
        throw firstError;
      }
      console.warn('[WhatsAppController] Pairing socket closed during startup; retrying once.');
      result = await requestCode();
    }
    return res.status(200).json({
      success: true,
      code: result.code,
      status: session.status,
      sessionId
    });
  } catch (error) {
    console.error('[WhatsAppController] Pairing code request failed:', error?.stack || error);
    const isRateLimit = error?.message?.includes('rate-limit') || error?.message?.includes('429') || error?.message?.includes('overlimit');
    return res.status(isRateLimit ? 429 : 500).json({
      success: false,
      status: isRateLimit ? 'RATE_LIMITED' : 'ERROR',
      error: error?.message || 'Failed to generate pairing code'
    });
  }
}

async function getStatus(req, res) {
  try {
    const sessionId = req.sessionId || 'default';
    const session = whatsappClient.getSession(sessionId);
    return res.status(200).json({
      success: true,
      status: session.status,
      user: session.connectedJid || null,
      error: session.lastError || null,
      sessionId
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
    const sessionId = req.sessionId || 'default';
    await whatsappClient.disconnect(sessionId);

    return res.status(200).json({
      success: true,
      status: whatsappClient.getStatus(sessionId),
      sessionId
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
    const sessionId = req.sessionId || 'default';
    const session = whatsappClient.getSession(sessionId);
    const qr = session.latestQr;
    const pairingCode = session.latestPairingCode;
    return res.status(200).json({
      success: true,
      qr: qr || null,
      pairingCode: pairingCode || null,
      status: session.status,
      sessionId
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

async function getChats(req, res) {
  try {
    const sessionId = req.sessionId || 'default';
    const accountJid = req.accountJid;
    const session = whatsappClient.getSession(sessionId);
    const limitHours = req.query.hours ? parseInt(req.query.hours, 10) : 720;
    const namesOnly = req.query.namesOnly === 'true' || req.query.names_only === 'true';

    const realtimeChats = session.getSortedChats();
    const storedChats = await messageService.getChats(accountJid, limitHours, namesOnly);
    const chatsByJid = new Map(storedChats.map(chat => [chat.jid, chat]));

    for (const chat of realtimeChats) {
      if (namesOnly) {
        const isGroup = chat.jid && chat.jid.endsWith('@g.us');
        const isPhoneOnly = /^[0-9+ ()\-\.\_]+$/.test(chat.name || '');
        if (isPhoneOnly || !chat.name || chat.name === 'Unknown') continue;
      }
      chatsByJid.set(chat.jid, chat);
    }

    const chats = Array.from(chatsByJid.values()).sort((a, b) => {
      if (a.needs_reply && !b.needs_reply) return -1;
      if (!a.needs_reply && b.needs_reply) return 1;
      return new Date(b.last_message_timestamp).getTime() - new Date(a.last_message_timestamp).getTime();
    });

    return res.status(200).json({
      success: true,
      chats,
      sessionId
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

async function sendMessage(req, res) {
  try {
    const sessionId = req.sessionId || 'default';
    const accountJid = req.accountJid;
    const { jid, text } = req.body;

    if (!jid || !text) {
      return res.status(400).json({ success: false, error: 'jid and text are required' });
    }
    const canonicalJid = getCanonicalJid(jid);
    await whatsappClient.sendMessage(canonicalJid, text, sessionId);

    // Save sent message to Supabase scoped to accountJid
    await messageService.saveMessage({
      account_jid: accountJid,
      chat_jid: canonicalJid,
      sender_jid: 'me',
      from_me: true,
      timestamp: new Date().toISOString(),
      text,
      message_type: 'text',
      has_media: false,
      whatsapp_message_id: 'sent_' + Date.now()
    });

    // Auto-dismiss pending reply_needed actions for this chat
    try {
      const supabase = require('../config/supabase');
      await supabase.query(
        `UPDATE ai_actions SET status = 'dismissed', updated_at = NOW() 
         WHERE chat_jid = $1 AND (account_jid = $2 OR account_jid = 'default_user') AND type = 'reply_needed' AND status = 'active'`,
        [canonicalJid, accountJid]
      );
      await supabase.query(
        `UPDATE suggested_replies SET status = 'sent', updated_at = NOW()
         WHERE chat_jid = $1 AND (account_jid = $2 OR account_jid = 'default_user') AND status = 'pending'`,
        [canonicalJid, accountJid]
      );
    } catch (e) {}

    return res.status(200).json({ success: true, sessionId });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

async function getCurrentContacts(req, res) {
  try {
    const sessionId = req.sessionId || 'default';
    const session = whatsappClient.getSession(sessionId);
    const contacts = Array.from(session.contactNames.entries()).map(([jid, name]) => ({ jid, name }));
    return res.status(200).json({
      success: true,
      count: contacts.length,
      contacts,
      sessionId
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

async function getRecentChats(req, res) {
  try {
    const accountJid = req.accountJid;
    const limitHours = req.query.hours ? parseInt(req.query.hours, 10) : 720;
    const namesOnly = req.query.namesOnly === 'true' || req.query.names_only === 'true';
    const chats = await messageService.getChats(accountJid, limitHours, namesOnly);
    return res.status(200).json({
      success: true,
      count: chats.length,
      chats
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

async function getChatMessages(req, res) {
  try {
    const { jid } = req.params;
    const accountJid = req.accountJid;
    const limit = parseInt(req.query.limit, 10) || 50;
    if (!jid) return res.status(400).json({ success: false, error: 'JID parameter is required' });

    const messages = await messageService.getChatMessages(jid, limit, accountJid);
    return res.status(200).json({
      success: true,
      jid,
      count: messages.length,
      messages
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
