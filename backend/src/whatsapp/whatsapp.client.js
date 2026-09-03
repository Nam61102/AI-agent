const {
  default: makeWASocket,
  DisconnectReason,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const QRCode = require('qrcode');
const auth = require('./whatsapp.auth');
const events = require('./whatsapp.events');
const contactService = require('../services/contact.service');
const { getCanonicalJid, formatPhoneNumber } = require('./whatsapp.utils');

const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

class WhatsAppClient {
  constructor() {
    this.socket = null;
    this.io = null;
    this.status = 'NOT_CONNECTED';
    this.latestQr = null;
    this.latestPairingCode = null;
    this.isConnecting = false;
    this.autoReconnect = true;
    this.logger = pino({ level: 'silent' });

    // Real-time WhatsApp data stores
    this.realtimeChats = new Map(); // canonical_jid -> chat object
    this.realtimeMessages = new Map(); // canonical_jid -> messages array
    this.contactNames = new Map(); // canonical_jid -> name
  }

  setSocketIO(io) {
    this.io = io;
    this.setupSocketListeners();
  }

  setupSocketListeners() {
    if (!this.io) return;

    this.io.on('connection', (clientSocket) => {
      clientSocket.emit('whatsapp:status', { status: this.status });

      if (this.latestQr && (this.status === 'QR_READY' || this.status === 'CONNECTING')) {
        clientSocket.emit('whatsapp:qr', { qr: this.latestQr });
      }

      // Emit initial real-time chats on client connect
      clientSocket.emit('whatsapp:realtime_chats', { chats: this.getSortedChats() });

      clientSocket.on('whatsapp:request_status', () => {
        clientSocket.emit('whatsapp:status', { status: this.status });
        if (this.latestQr) {
          clientSocket.emit('whatsapp:qr', { qr: this.latestQr });
        }
        clientSocket.emit('whatsapp:realtime_chats', { chats: this.getSortedChats() });
      });

      // Handle request for specific chat messages
      clientSocket.on('whatsapp:request_messages', async (data) => {
        const jid = data?.jid;
        if (jid) {
          try {
            const messageService = require('../services/message.service');
            const recentMessages = await messageService.getChatMessages(jid, 6);
            
            clientSocket.emit('whatsapp:chat_messages', {
              jid,
              messages: recentMessages
            });
          } catch (err) {
            console.error('Error fetching chat messages via socket:', err.message);
          }
        }
      });

      // Handle real-time sending of messages via socket
      clientSocket.on('whatsapp:send_message', async (data) => {
        const { jid, text } = data;
        if (jid && text) {
          try {
            await this.sendMessage(jid, text);
          } catch (e) {
            console.error('Socket send_message error:', e.message);
          }
        }
      });
    });
  }

  emit(event, data) {
    if (this.io) {
      this.io.emit(event, data);
    }
  }

  getSortedChats() {
    const chatList = Array.from(this.realtimeChats.values());
    return chatList.sort((a, b) => {
      const timeA = new Date(a.last_message_timestamp).getTime() || 0;
      const timeB = new Date(b.last_message_timestamp).getTime() || 0;
      return timeB - timeA;
    });
  }

  extractText(rawMsg) {
    if (!rawMsg || !rawMsg.message) return null;
    let m = rawMsg.message;
    
    // Unwrap ephemeral or viewOnce messages
    if (m.ephemeralMessage?.message) m = m.ephemeralMessage.message;
    else if (m.viewOnceMessage?.message) m = m.viewOnceMessage.message;
    else if (m.viewOnceMessageV2?.message) m = m.viewOnceMessageV2.message;
    else if (m.documentWithCaptionMessage?.message) m = m.documentWithCaptionMessage.message;

    return (
      m.conversation || 
      m.extendedTextMessage?.text || 
      m.imageMessage?.caption || 
      m.videoMessage?.caption || 
      m.documentMessage?.caption || 
      m.buttonsResponseMessage?.selectedDisplayText ||
      m.buttonsResponseMessage?.selectedButtonId || 
      m.listResponseMessage?.title || 
      m.listResponseMessage?.description ||
      m.templateButtonReplyMessage?.selectedDisplayText ||
      m.templateButtonReplyMessage?.selectedId ||
      (m.imageMessage ? '📷 Photo' : null) ||
      (m.videoMessage ? '🎥 Video' : null) ||
      (m.documentMessage ? '📄 Document' : null) ||
      (m.audioMessage ? '🎵 Voice message' : null) ||
      (m.stickerMessage ? '✨ Sticker' : null) ||
      (m.contactMessage ? '👤 Contact' : null) ||
      (m.locationMessage ? '📍 Location' : null) ||
      (m.pollCreationMessage ? '📊 Poll: ' + (m.pollCreationMessage.name || '') : null) ||
      null
    );
  }
  getTimestampMs(ts) {
    if (!ts) return Date.now();
    if (typeof ts === 'number') {
      return ts < 1000000000000 ? ts * 1000 : ts;
    }
    if (typeof ts === 'object') {
      const num = Number(ts.low !== undefined ? ts.low : ts);
      return num < 1000000000000 ? num * 1000 : num;
    }
    const parsed = Number(ts);
    if (!isNaN(parsed)) {
      return parsed < 1000000000000 ? parsed * 1000 : parsed;
    }
    return Date.now();
  }

  addRealtimeMessage(jid, text, timestampMs, fromMe, pushName, msgId, isHistory = false) {
    if (!jid || jid.endsWith('@newsletter') || jid.endsWith('@lid')) return;
    if (!text || text.trim() === '') return;

    const canonicalJid = getCanonicalJid(jid);
    const msgDate = new Date(timestampMs).toISOString();

    const msgObj = {
      id: msgId || 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      chat_jid: canonicalJid,
      sender_jid: fromMe ? 'me' : jid,
      from_me: fromMe,
      text,
      timestamp: msgDate,
      message_type: 'text'
    };

    // Store in message history for this chat
    if (!this.realtimeMessages.has(canonicalJid)) {
      this.realtimeMessages.set(canonicalJid, []);
    }
    let isNewMsg = false;
    const msgs = this.realtimeMessages.get(canonicalJid);
    if (!msgs.some(m => m.id === msgObj.id)) {
      msgs.push(msgObj);
      msgs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      isNewMsg = true;
    }

    // Resolve Name
    const isGroup = canonicalJid.endsWith('@g.us');
    
    if (pushName && !isGroup && !fromMe && !this.contactNames.has(canonicalJid)) {
      this.contactNames.set(canonicalJid, pushName);
    }
    
    // Update chat metadata
    const existing = this.realtimeChats.get(canonicalJid);
    
    let resolvedName = this.contactNames.get(canonicalJid) || (!isGroup && !fromMe ? pushName : null);
    if (!resolvedName || /^\d+$/.test(resolvedName)) {
      resolvedName = isGroup ? 'Group' : formatPhoneNumber(canonicalJid.split('@')[0]);
    }

    // Only set needs_reply to true if it's a NEW real-time incoming message.
    // If it's a history sync message, keep whatever the unread_count was set to (or false if unknown).
    let shouldNeedReply = false;
    let newUnreadCount = 0;
    
    if (isHistory) {
       // Keep existing needs_reply if it was set by the chats payload
       shouldNeedReply = existing ? existing.needs_reply : false;
       newUnreadCount = existing ? existing.unread_count : 0;
    } else {
       // If fromMe is true, clear needs_reply. If false, set it.
       if (fromMe) {
         shouldNeedReply = false;
         newUnreadCount = 0;
       } else {
         shouldNeedReply = true;
         newUnreadCount = (existing?.unread_count || 0) + 1;
       }
    }

    // Determine if we should update the last message based on timestamps
    let finalLastMsgText = text;
    let finalLastMsgTs = msgDate;
    
    if (existing && existing.last_message_timestamp) {
      const existingTs = new Date(existing.last_message_timestamp).getTime();
      const currentTs = new Date(msgDate).getTime();
      if (existingTs > currentTs) {
        finalLastMsgText = existing.last_message_text;
        finalLastMsgTs = existing.last_message_timestamp;
      }
    }

    this.realtimeChats.set(canonicalJid, {
      jid: canonicalJid,
      name: resolvedName,
      last_message_text: finalLastMsgText,
      last_message_timestamp: finalLastMsgTs,
      needs_reply: shouldNeedReply,
      unread_count: newUnreadCount
    });

    // Notify clients only if it's not history sync (history sync will bulk emit)
    if (!isHistory) {
      if (isNewMsg) {
        this.emit('whatsapp:new_message', { jid: canonicalJid, message: msgObj });
      }
      this.emit('whatsapp:realtime_chats', { chats: this.getSortedChats() });
    }
  }

  async connect() {
    if (this.socket && this.status === 'CONNECTED') {
      return { success: true, status: 'CONNECTED', requiresScan: false };
    }

    const hasSavedSession = auth.sessionExists();

    if (this.socket) {
      try {
        this.socket.ev.removeAllListeners();
        this.socket.end();
      } catch (e) {}
      this.socket = null;
    }

    this.isConnecting = true;
    this.autoReconnect = true;
    this.latestQr = null;
    this.latestPairingCode = null;
    this.updateStatus('CONNECTING');
    this.emit('whatsapp:connecting', { status: 'connecting' });

    try {
      const { state, saveCreds } = await auth.getAuthState();
      const { version, isLatest } = await fetchLatestBaileysVersion();

      console.log(`[WhatsAppClient] Initializing WASocket with version [${version.join('.')}] (isLatest: ${isLatest})`);

      this.socket = makeWASocket({
        version,
        auth: state,
        logger: this.logger,
        printQRInTerminal: false,
        browser: ['macOS', 'Chrome', '124.0.0'],
        syncFullHistory: true,
        shouldSyncHistoryMessage: () => true,
        generateHighQualityLinkPreview: false,
        markOnlineOnConnect: true,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 15000
      });

      this.socket.ev.on('creds.update', saveCreds);

      this.socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          try {
            const qrDataUri = await QRCode.toDataURL(qr, {
              margin: 2,
              scale: 8,
              color: { dark: '#000000', light: '#ffffff' }
            });
            this.latestQr = qrDataUri;
            console.log('WhatsApp QR generated (PNG Data URI ready)');
            this.updateStatus('QR_READY');
            this.emit('whatsapp:qr', { qr: qrDataUri, rawQr: qr });
          } catch (qrErr) {
            this.latestQr = qr;
            console.log('WhatsApp QR generated (raw)');
            this.updateStatus('QR_READY');
            this.emit('whatsapp:qr', { qr });
          }
        }

        if (connection === 'connecting') {
          if (this.status !== 'QR_READY') {
            this.updateStatus('CONNECTING');
          }
        } else if (connection === 'open') {
          this.isConnecting = false;
          this.latestQr = null;
          this.latestPairingCode = null;
          console.log('✓ [WhatsAppClient] PAIRING SUCCESSFUL & CONNECTED!');

          const rawConnectedId = this.socket?.user?.id || '';
          const connectedJid = getCanonicalJid(rawConnectedId);
          console.log(`[WhatsAppClient] Connected as user: ${connectedJid}`);

          // Check if session owner changed to prevent mixing contacts & chats between different users
          const prevOwner = auth.getSessionOwner();
          if (connectedJid && prevOwner && prevOwner !== connectedJid) {
            console.log(`[WhatsAppClient] New account connected (${connectedJid} != ${prevOwner}). Purging old account data from database and memory.`);
            this.realtimeChats.clear();
            this.realtimeMessages.clear();
            this.contactNames.clear();
            
            try {
              const supabase = require('../config/supabase');
              await supabase.query('DELETE FROM extractions; DELETE FROM messages; DELETE FROM contacts;');
            } catch (e) {
              console.error('[WhatsAppClient] Error purging old account DB data:', e.message);
            }
          }
          if (connectedJid) {
            auth.saveSessionOwner(connectedJid);
          }

          this.updateStatus('CONNECTED');
          this.emit('whatsapp:connected', { status: 'connected', user: connectedJid });
        } else if (connection === 'close') {
          this.isConnecting = false;
          const statusCode = lastDisconnect?.error?.output?.statusCode || 
                             lastDisconnect?.error?.output?.payload?.statusCode;

          const isLoggedOut = statusCode === DisconnectReason.loggedOut;

          if (isLoggedOut) {
            console.log('[WhatsAppClient] Session logged out by WhatsApp');
            auth.clearSession();
            this.latestQr = null;
            this.latestPairingCode = null;
            this.socket = null;
            
            // Auto wipe DB on disconnect/logout
            try {
              const supabase = require('../config/supabase');
              supabase.query('DELETE FROM extractions; DELETE FROM messages; DELETE FROM contacts;').catch(e => console.error(e));
              console.log('[WhatsAppClient] Database wiped clean on logout.');
            } catch (err) {}

            this.updateStatus('LOGGED_OUT');
            this.emit('whatsapp:logged_out', { status: 'logged_out' });
          } else {
            console.log(`[WhatsAppClient] Connection closed (code: ${statusCode}). Reconnecting in 2 seconds...`);
            this.updateStatus('AUTHENTICATING');
            setTimeout(() => {
                this.connect();
            }, 2000);
          }
        }
      });

      this.socket.ev.on('contacts.upsert', async (contacts) => {
        let hasNew = false;
        for (const c of contacts) {
          if (c.id && (c.name || c.verifiedName || c.pushname)) {
            const canonical = getCanonicalJid(c.id);
            const resolvedName = c.name || c.verifiedName || c.pushname;
            this.contactNames.set(canonical, resolvedName);
            
            // Persist the phonebook name to the database
            try {
              await contactService.findOrCreateContact({ jid: canonical, name: resolvedName });
            } catch (err) {
              console.error('[WhatsAppClient] Failed to save contact:', err.message);
            }
          }
        }
      });

      this.socket.ev.on('groups.upsert', async (groups) => {
        for (const group of groups) {
          if (group.id && (group.name || group.subject)) {
            const canonical = getCanonicalJid(group.id);
            const resolvedName = group.name || group.subject;
            this.contactNames.set(canonical, resolvedName);
            try {
              await contactService.findOrCreateContact({ jid: canonical, name: resolvedName });
            } catch (err) {}
          }
        }
      });

      // 1. Initial History Sync Listener
      this.socket.ev.on('messaging-history.set', async ({ chats, messages, contacts }) => {
        console.log(`[WhatsAppClient] Real-time History Sync: ${messages?.length || 0} messages, ${chats?.length || 0} chats, ${contacts?.length || 0} contacts.`);
        const now = Date.now();

        // Process historical messages through the standard pipeline (which saves them and runs AI extractions)
        if (messages && messages.length > 0) {
          // Sort and take the 100 most recent messages for AI extraction to prevent rate limits
          const recentMessages = [...messages].sort((a, b) => {
            let tsA = a.messageTimestamp || 0;
            let tsB = b.messageTimestamp || 0;
            if (typeof tsA === 'object' && 'low' in tsA) tsA = tsA.low;
            if (typeof tsB === 'object' && 'low' in tsB) tsB = tsB.low;
            return tsB - tsA; // descending
          }).slice(0, 100);

          // Process in background
          events.handleIncomingMessages({ messages: recentMessages }).catch(err => {
            console.error('[WhatsAppClient] Error processing history messages:', err.message);
          });
        }

        // Load contacts first so we have their names
        if (contacts) {
          for (const c of contacts) {
            if (c.id && (c.name || c.verifiedName || c.pushname)) {
              const canonical = getCanonicalJid(c.id);
              const resolvedName = c.name || c.verifiedName || c.pushname;
              this.contactNames.set(canonical, resolvedName);
              // Save to database
              try {
                await contactService.findOrCreateContact({ jid: canonical, name: resolvedName });
              } catch (err) {}
            }
          }
        }
        
        // Load group names from chats
        if (chats) {
          for (const chat of chats) {
            if (chat.id && chat.name) {
              const canonical = getCanonicalJid(chat.id);
              this.contactNames.set(canonical, chat.name);
              try {
                await contactService.findOrCreateContact({ jid: canonical, name: chat.name });
              } catch (err) {}
            }
          }
        }

        if (messages) {
          for (const msg of messages) {
            if (!msg.message) continue;
            const jid = msg.key?.remoteJid;
            if (!jid || jid.endsWith('@newsletter')) continue;

            const tsMs = this.getTimestampMs(msg.messageTimestamp);
            const text = this.extractText(msg);
            if (!text) continue;

            const fromMe = Boolean(msg.key.fromMe);
            this.addRealtimeMessage(jid, text, tsMs, fromMe, msg.pushName, msg.key.id, true);
          }
        }

        // Also add chats that didn't have messages in this payload (and update unread_count for existing)
        if (chats) {
          for (const c of chats) {
            const jid = c.id;
            if (!jid || jid.endsWith('@newsletter') || jid.endsWith('@lid')) continue;
            const canonicalJid = getCanonicalJid(jid);
            
            const existing = this.realtimeChats.get(canonicalJid);
            if (existing) {
               existing.needs_reply = c.unreadCount > 0;
               existing.unread_count = c.unreadCount || 0;
            } else {
               const isGroup = canonicalJid.endsWith('@g.us');
               const rawNum = canonicalJid.split('@')[0];
               let resolvedName = c.name || this.contactNames.get(canonicalJid);
               
               if (!resolvedName || /^\d+$/.test(resolvedName)) {
                 if (isGroup) resolvedName = resolvedName || 'Group';
                 else resolvedName = formatPhoneNumber(rawNum);
               }

               this.realtimeChats.set(canonicalJid, {
                 jid: canonicalJid,
                 name: resolvedName,
                 last_message_text: '',
                 last_message_timestamp: new Date(this.getTimestampMs(c.conversationTimestamp)).toISOString(),
                 needs_reply: c.unreadCount > 0,
                 unread_count: c.unreadCount || 0
               });
            }
          }
        }
        

        
        // Emit updated chats list after processing history
        this.emit('whatsapp:realtime_chats', { chats: this.getSortedChats() });
      });

      // 2. Real-time Incoming Message Listener
      this.socket.ev.on('messages.upsert', (upsert) => {
        events.handleIncomingMessages(upsert);

        if (!upsert || !upsert.messages) return;
        const now = Date.now();

        for (const rawMsg of upsert.messages) {
          if (!rawMsg.message) continue;
          const jid = rawMsg.key?.remoteJid;
          if (!jid || jid.endsWith('@newsletter')) continue;

          const tsMs = this.getTimestampMs(rawMsg.messageTimestamp);

          const text = this.extractText(rawMsg);
          if (!text) continue;

          const fromMe = Boolean(rawMsg.key.fromMe);
          this.addRealtimeMessage(jid, text, tsMs, fromMe, rawMsg.pushName, rawMsg.key.id);
        }
      });

      return { success: true, status: this.status, requiresScan: !hasSavedSession };
    } catch (err) {
      this.isConnecting = false;
      console.error('[WhatsAppClient] Error during connection:', err.message);
      this.updateStatus('ERROR');
      this.emit('whatsapp:error', { message: err.message });
      return { success: false, error: err.message };
    }
  }

  async sendMessage(jid, text) {
    if (!this.socket) {
      throw new Error('WhatsApp client is not connected');
    }
    const sentMsg = await this.socket.sendMessage(jid, { text });
    
    // Instantly add sent message to real-time store and reset needs_reply
    const msgId = sentMsg?.key?.id || 'sent_' + Date.now();
    this.addRealtimeMessage(jid, text, Date.now(), true, 'me', msgId);

    return sentMsg;
  }

  updateStatus(newStatus) {
    this.status = newStatus;
    console.log(`[WhatsAppClient] Connection status: ${newStatus}`);
    this.emit('whatsapp:status', { status: newStatus });
  }

  getStatus() { return this.status; }
  getQR() { return this.latestQr; }
  getPairingCode() { return this.latestPairingCode; }

  getCurrentSessionContacts() {
    // Return contacts directly from active session memory
    const contacts = [];
    for (const [jid, name] of this.contactNames.entries()) {
      contacts.push({ jid, name });
    }
    return contacts;
  }
  async disconnect() {
    console.log('[WhatsAppClient] Disconnecting and clearing session...');
    
    // 1. Terminate socket if it exists
    if (this.socket) {
      try {
        this.socket.ev.removeAllListeners();
        if (this.status === 'CONNECTED' || this.status === 'CONNECTING') {
          this.socket.logout();
        }
        this.socket.end();
      } catch (e) {
        console.error('Error closing socket:', e.message);
      }
      this.socket = null;
    }
    
    // 2. Clear Auth Folder and Session Owner
    auth.clearSession();
    
    // 3. Clear in-memory caches completely so the new user doesn't see old contacts
    this.realtimeChats.clear();
    this.realtimeMessages.clear();
    this.contactNames.clear();
    
    // 4. Wipe DB tables so no data remains for disconnected user
    try {
      const supabase = require('../config/supabase');
      await supabase.query('DELETE FROM extractions; DELETE FROM messages; DELETE FROM contacts;');
      console.log('[WhatsAppClient] Database wiped clean on disconnect.');
    } catch (err) {
      console.error('[WhatsAppClient] Error wiping DB on disconnect:', err.message);
    }

    // 5. Update status and notify clients
    this.isConnecting = false;
    this.latestQr = null;
    this.latestPairingCode = null;
    this.updateStatus('DISCONNECTED');
    
    // Broadcast empty list to clear UI for clients immediately
    this.emit('whatsapp:realtime_chats', { chats: [] });
    
    return { success: true };
  }
  
  async initOnStartup() {
    if (!auth.sessionExists()) {
      console.log('[WhatsAppClient] No saved session found. Skipping DB load.');
      return;
    }

    try {
      const dbChats = await require('../services/message.service').getChats();
      const dbContacts = await contactService.getAllContacts();
      
      for (const c of dbContacts) {
        if (c.jid && c.name && !c.jid.endsWith('@lid')) {
          const canonical = getCanonicalJid(c.jid);
          if (!this.contactNames.has(canonical) || /^\+?\d[\d\s-]*$/.test(this.contactNames.get(canonical))) {
            this.contactNames.set(canonical, c.name);
          }
        }
      }

      for (const chat of dbChats) {
        if (chat.jid && chat.jid.endsWith('@lid')) continue;
        const canonicalJid = getCanonicalJid(chat.jid);
        
        let resolvedName = this.contactNames.get(canonicalJid) || chat.name;
        if (!resolvedName || /^\d+$/.test(resolvedName)) {
           const rawNum = canonicalJid.split('@')[0];
           if (canonicalJid.endsWith('@g.us')) {
             resolvedName = resolvedName || 'Group';
           } else {
             resolvedName = formatPhoneNumber(rawNum);
           }
        }

        this.realtimeChats.set(canonicalJid, {
          jid: canonicalJid,
          name: resolvedName,
          last_message_text: chat.last_message_text,
          last_message_timestamp: new Date(chat.last_message_timestamp).toISOString(),
          needs_reply: chat.needs_reply,
          unread_count: chat.needs_reply ? 1 : 0
        });
      }
    } catch (e) {
      console.error('[WhatsAppClient] Failed to load DB state on startup:', e.message);
    }

    console.log('[WhatsAppClient] Saved WhatsApp session found. Initializing...');
    this.connect();
  }
}

const clientInstance = new WhatsAppClient();
module.exports = clientInstance;
