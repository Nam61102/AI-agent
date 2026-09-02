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

    return res.status(200).json({ success: true });
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
  sendMessage
};
