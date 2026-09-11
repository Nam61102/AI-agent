const {
  default: makeWASocket,
  DisconnectReason
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const QRCode = require('qrcode');
const auth = require('./whatsapp.auth');
const events = require('./whatsapp.events');
const contactService = require('../services/contact.service');
const { getCanonicalJid, formatPhoneNumber, registerLidMapping } = require('./whatsapp.utils');

class WhatsAppSessionInstance {
  constructor(sessionId, manager) {
    this.sessionId = sessionId;
    this.manager = manager;
    this.socket = null;
    this.status = 'NOT_CONNECTED';
    this.latestQr = null;
    this.latestPairingCode = null;
    this.isConnecting = false;
    this.isRegistered = false;
    this.socketCreatedAt = 0;
    this.autoReconnect = true;
    this.reconnectTimer = null;
    this.reconnectAttempts = 0;
    this.lastError = null;
    this.logger = pino({ level: 'silent' });
    this.connectedJid = auth.getSessionOwner(sessionId) || null;

    // Real-time WhatsApp data stores for this session
    this.realtimeChats = new Map(); // canonical_jid -> chat object
    this.realtimeMessages = new Map(); // canonical_jid -> messages array
    this.contactNames = new Map(); // canonical_jid -> name
    this.rawProtoMessages = new Map(); // message_id -> proto.IMessage
    this.msgRetryCounterCache = {
      _map: new Map(),
      get(key) { return this._map.get(key); },
      set(key, val) { this._map.set(key, val); },
      del(key) { this._map.delete(key); },
      flushAll() { this._map.clear(); }
    };
  }

  emit(event, data) {
    if (this.manager.io) {
      this.manager.io.to(`session_${this.sessionId}`).emit(event, { ...data, sessionId: this.sessionId });
    }
  }

  updateStatus(status) {
    this.status = status;
    this.emit('whatsapp:status', { status });
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

    const isGroup = canonicalJid.endsWith('@g.us');
    const rawNum = canonicalJid.split('@')[0];
    let resolvedName = this.contactNames.get(canonicalJid) || (!isGroup && pushName ? pushName : null);
    
    if (!resolvedName || /^\d+$/.test(resolvedName)) {
      if (isGroup) resolvedName = resolvedName || 'Group';
      else resolvedName = formatPhoneNumber(rawNum);
    }

    const newMsg = {
      id: msgId || Date.now(),
      chat_jid: canonicalJid,
      text: text.trim(),
      from_me: fromMe,
      timestamp: msgDate,
      sender_name: fromMe ? 'You' : (pushName || resolvedName),
      has_media: false
    };

    if (!this.realtimeMessages.has(canonicalJid)) {
      this.realtimeMessages.set(canonicalJid, []);
    }
    const list = this.realtimeMessages.get(canonicalJid);
    const exists = list.some(m => m.id === newMsg.id || (m.timestamp === newMsg.timestamp && m.text === newMsg.text));
    if (!exists) {
      list.push(newMsg);
      list.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      if (list.length > 50) list.shift();
    }

    const existingChat = this.realtimeChats.get(canonicalJid);
    const isNewer = !existingChat || new Date(msgDate).getTime() >= new Date(existingChat.last_message_timestamp).getTime();

    if (isNewer) {
      this.realtimeChats.set(canonicalJid, {
        jid: canonicalJid,
        name: resolvedName,
        last_message_text: text.trim(),
        last_message_timestamp: msgDate,
        needs_reply: !fromMe,
        unread_count: !fromMe && !isHistory ? ((existingChat?.unread_count || 0) + 1) : (existingChat?.unread_count || 0)
      });
    }

    if (!isHistory) {
      this.emit('whatsapp:new_message', { jid: canonicalJid, message: newMsg });
      this.emit('whatsapp:realtime_chats', { chats: this.getSortedChats() });
    }
  }

  async connect() {
    if (this.socket && this.status === 'CONNECTED') {
      return { success: true, status: 'CONNECTED', requiresScan: false };
    }

    const hasSavedSession = auth.sessionExists(this.sessionId);

    if (this.socket) {
      try {
        this.socket.ev.removeAllListeners('connection.update');
        if (typeof this.socket.end === 'function') {
          this.socket.end();
        }
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
      const { state, saveCreds } = await auth.getAuthState(this.sessionId);
      this.isRegistered = Boolean(state.creds.registered);

      console.log(`[WhatsAppSession:${this.sessionId}] Initializing WASocket`);

      this.socket = makeWASocket({
        auth: state,
        logger: this.logger,
        printQRInTerminal: false,
        syncFullHistory: false,
        generateHighQualityLinkPreview: false,
        markOnlineOnConnect: false,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 15000,
        msgRetryCounterCache: this.msgRetryCounterCache,
        getMessage: async (key) => {
          if (!key || !key.id) return undefined;
          if (this.rawProtoMessages.has(key.id)) {
            return this.rawProtoMessages.get(key.id);
          }
          try {
            const supabase = require('../config/supabase');
            const res = await supabase.query(
              'SELECT text FROM messages WHERE whatsapp_message_id = $1 LIMIT 1',
              [key.id]
            );
            if (res.rows.length > 0 && res.rows[0].text) {
              const protoMsg = { conversation: res.rows[0].text };
              this.rawProtoMessages.set(key.id, protoMsg);
              return protoMsg;
            }
          } catch (err) {}
          return undefined;
        }
      });
      this.socketCreatedAt = Date.now();

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
            console.log(`[WhatsAppSession:${this.sessionId}] QR generated`);
            this.updateStatus('QR_READY');
            this.emit('whatsapp:qr', { qr: qrDataUri, rawQr: qr });
          } catch (qrErr) {
            this.latestQr = qr;
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
          this.reconnectAttempts = 0;
          this.lastError = null;
          if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
          }
          this.latestQr = null;
          this.latestPairingCode = null;
          
          const rawConnectedId = this.socket?.user?.id || '';
          const connectedJid = getCanonicalJid(rawConnectedId);
          this.connectedJid = connectedJid;
          console.log(`✓ [WhatsAppSession:${this.sessionId}] CONNECTED as ${connectedJid}`);

          auth.saveSessionOwner(this.sessionId, connectedJid);

          // Pre-populate contact names from DB
          try {
            const dbContacts = await contactService.getAllContacts(connectedJid);
            for (const c of dbContacts) {
              if (c.jid && c.name) {
                this.contactNames.set(getCanonicalJid(c.jid), c.name);
              }
            }
          } catch (err) {}

          this.updateStatus('CONNECTED');
          this.emit('whatsapp:connected', { status: 'connected', user: connectedJid });
        } else if (connection === 'close') {
          this.isConnecting = false;
          const statusCode = lastDisconnect?.error?.output?.statusCode || 
                             lastDisconnect?.error?.output?.payload?.statusCode;

          const isLoggedOut = statusCode === DisconnectReason.loggedOut;

          if (isLoggedOut) {
            console.log(`[WhatsAppSession:${this.sessionId}] Logged out by WhatsApp`);
            auth.clearSession(this.sessionId);
            this.latestQr = null;
            this.latestPairingCode = null;
            this.socket = null;
            this.connectedJid = null;
            this.isRegistered = false;
            
            this.updateStatus('LOGGED_OUT');
            this.emit('whatsapp:logged_out', { status: 'logged_out' });
          } else {
            const isRestart = statusCode === DisconnectReason.restartRequired || statusCode === 515;
            const delay = isRestart ? 100 : 2000;
            this.reconnectAttempts += 1;
            const closeMessage = lastDisconnect?.error?.message || `WhatsApp connection closed (code: ${statusCode || 'unknown'})`;
            console.warn(`[WhatsAppSession:${this.sessionId}] ${closeMessage}. Reconnect attempt ${this.reconnectAttempts}/5.`);
            if (this.reconnectAttempts >= 5) {
              this.lastError = `${closeMessage}. Pairing did not complete. Request a new code and try again.`;
              this.updateStatus('ERROR');
              this.emit('whatsapp:error', { message: this.lastError });
            } else {
              this.updateStatus('AUTHENTICATING');
              this.scheduleReconnect(delay);
            }
          }
        }
      });

      const handleContactUpdate = async (contactsList) => {
        const accountJid = this.connectedJid || auth.getSessionOwner(this.sessionId) || 'default_user';
        for (const c of contactsList) {
          if (c.id && c.lid) {
            registerLidMapping(c.lid, c.id);
          }
          if (c.id && (c.name || c.notify || c.verifiedName || c.pushname)) {
            const canonical = getCanonicalJid(c.id);
            const resolvedName = c.name || c.notify || c.verifiedName || c.pushname;
            const isAddressBook = Boolean(c.name && c.name.trim() !== '');
            if (resolvedName) {
              this.contactNames.set(canonical, resolvedName);
              try {
                await contactService.findOrCreateContact({ jid: canonical, name: resolvedName, accountJid, isAddressBook });
              } catch (err) {}
            }
          }
        }
      };

      this.socket.ev.on('contacts.upsert', handleContactUpdate);
      this.socket.ev.on('contacts.update', handleContactUpdate);

      const handleChatUpdate = async (chatsList) => {
        const accountJid = this.connectedJid || auth.getSessionOwner(this.sessionId) || 'default_user';
        for (const chat of chatsList) {
          if (chat.id && (chat.name || chat.subject)) {
            const canonical = getCanonicalJid(chat.id);
            const resolvedName = chat.name || chat.subject;
            const isAddressBook = Boolean(chat.name && chat.name.trim() !== '');
            if (resolvedName) {
              this.contactNames.set(canonical, resolvedName);
              try {
                await contactService.findOrCreateContact({ jid: canonical, name: resolvedName, accountJid, isAddressBook });
              } catch (err) {}
            }
          }
        }
      };

      this.socket.ev.on('chats.upsert', handleChatUpdate);
      this.socket.ev.on('chats.update', handleChatUpdate);

      this.socket.ev.on('groups.upsert', async (groups) => {
        const accountJid = this.connectedJid || auth.getSessionOwner(this.sessionId) || 'default_user';
        for (const group of groups) {
          if (group.id && (group.name || group.subject)) {
            const canonical = getCanonicalJid(group.id);
            const resolvedName = group.name || group.subject;
            this.contactNames.set(canonical, resolvedName);
            try {
              await contactService.findOrCreateContact({ jid: canonical, name: resolvedName, accountJid, isAddressBook: true });
            } catch (err) {}
          }
        }
      });

      this.socket.ev.on('messaging-history.set', ({ chats, messages, contacts }) => {
        const accountJid = this.connectedJid || auth.getSessionOwner(this.sessionId) || 'default_user';
        console.log(`[WhatsAppSession:${this.sessionId}] History Sync received: ${messages?.length || 0} msgs, ${contacts?.length || 0} contacts.`);

        setImmediate(async () => {
          if (messages && messages.length > 0) {
            events.handleIncomingMessages({ messages: messages, isHistorySync: true }, accountJid).catch(err => {
              console.error(`[WhatsAppSession:${this.sessionId}] Error processing history:`, err.message);
            });
          }

          if (contacts) {
            for (const c of contacts) {
              if (c.id && c.lid) {
                registerLidMapping(c.lid, c.id);
              }
              if (c.id && (c.name || c.notify || c.verifiedName || c.pushname)) {
                const canonical = getCanonicalJid(c.id);
                const resolvedName = c.name || c.notify || c.verifiedName || c.pushname;
                const isAddressBook = Boolean(c.name && c.name.trim() !== '');
                this.contactNames.set(canonical, resolvedName);
                contactService.findOrCreateContact({ jid: canonical, name: resolvedName, accountJid, isAddressBook }).catch(() => {});
              }
            }
          }

          if (messages) {
            for (const msg of messages) {
              if (!msg.message) continue;
              if (msg.key?.id) {
                this.rawProtoMessages.set(msg.key.id, msg.message);
              }
              const jid = msg.key?.remoteJid;
              if (!jid || jid.endsWith('@newsletter')) continue;

              const tsMs = this.getTimestampMs(msg.messageTimestamp);
              const text = this.extractText(msg);
              if (!text) continue;

              const fromMe = Boolean(msg.key.fromMe);
              this.addRealtimeMessage(jid, text, tsMs, fromMe, msg.pushName, msg.key.id, true);
            }
          }

          this.emit('whatsapp:realtime_chats', { chats: this.getSortedChats() });
        });
      });

      this.socket.ev.on('messages.upsert', (upsert) => {
        const accountJid = this.connectedJid || auth.getSessionOwner(this.sessionId) || 'default_user';
        events.handleIncomingMessages(upsert, accountJid);

        if (!upsert || !upsert.messages) return;
        for (const rawMsg of upsert.messages) {
          try {
            if (rawMsg.key?.id && rawMsg.message) {
              this.rawProtoMessages.set(rawMsg.key.id, rawMsg.message);
              if (this.rawProtoMessages.size > 2000) {
                const firstKey = this.rawProtoMessages.keys().next().value;
                this.rawProtoMessages.delete(firstKey);
              }
            }

            const rawChatJid = rawMsg.key?.remoteJid;
            if (!rawChatJid || rawChatJid === 'status@broadcast' || rawChatJid.endsWith('@newsletter')) continue;
            
            const text = this.extractText(rawMsg);
            if (!text) continue;

            const tsMs = this.getTimestampMs(rawMsg.messageTimestamp);
            const fromMe = Boolean(rawMsg.key?.fromMe);
            this.addRealtimeMessage(rawChatJid, text, tsMs, fromMe, rawMsg.pushName, rawMsg.key?.id, false);
          } catch (e) {}
        }
      });

      return {
        success: true,
        status: this.status,
        requiresScan: !hasSavedSession
      };
    } catch (err) {
      console.error(`[WhatsAppSession:${this.sessionId}] Connect error:`, err.message);
      this.isConnecting = false;
      this.updateStatus('NOT_CONNECTED');
      throw err;
    }
  }

  async requestPairingCode(phoneNumber) {
    if (!phoneNumber) {
      throw new Error('Phone number is required');
    }
    let normalizedPhoneNumber = String(phoneNumber || '').replace(/\D/g, '');
    if (normalizedPhoneNumber.startsWith('0')) {
      normalizedPhoneNumber = normalizedPhoneNumber.replace(/^0+/, '');
    }
    if (normalizedPhoneNumber.length === 10) {
      normalizedPhoneNumber = '91' + normalizedPhoneNumber;
    }
    if (normalizedPhoneNumber.length < 11 || normalizedPhoneNumber.length > 15) {
      throw new Error('Enter a valid phone number with country code (e.g. 917038128870 or 7038128870).');
    }

    // A stale auth directory can report registered even when the socket is dead.
    // Only refuse pairing when this session is genuinely connected.
    if (this.socket && this.status === 'CONNECTED') {
      throw new Error('WhatsApp is already connected for this session.');
    }

    // Always clear unauthenticated session state and initialize a clean socket for pairing code
    this.autoReconnect = false;
    if (this.socket) {
      try {
        this.socket.ev.removeAllListeners();
        this.socket.end();
      } catch (e) {}
      this.socket = null;
    }
    auth.clearSession(this.sessionId);
    this.isRegistered = false;
    this.connectedJid = null;
    this.reconnectAttempts = 0;
    this.lastError = null;
    await this.connect();

    const deadline = Date.now() + 15000;
    while (!this.socket && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 250));
    }

    if (!this.socket || typeof this.socket.requestPairingCode !== 'function') {
      throw new Error('WhatsApp connection is not ready for pairing. Please try again.');
    }

    const socketWarmupRemaining = 3000 - (Date.now() - this.socketCreatedAt);
    if (socketWarmupRemaining > 0) {
      await new Promise(resolve => setTimeout(resolve, socketWarmupRemaining));
    }

    try {
      console.log(`[WA:${this.sessionId}] Submitting pairing code IQ request...`);
      const rawCode = await this.socket.requestPairingCode(normalizedPhoneNumber);
      const formattedCode = rawCode?.match(/.{1,4}/g)?.join('-') || rawCode;
      this.latestPairingCode = formattedCode;
      this.latestQr = null;
      this.updateStatus('QR_READY');
      this.emit('whatsapp:pairing_code', { code: formattedCode, pairingCode: formattedCode });
      console.log(`[WA:${this.sessionId}] Pairing code successfully generated.`);
      return { success: true, code: formattedCode };
    } catch (pairingErr) {
      console.error(`[WA:${this.sessionId}] Pairing code request failed:`, pairingErr.message);
      if (pairingErr.message?.includes('429') || pairingErr.message?.includes('rate') || pairingErr.message?.includes('overlimit')) {
        throw new Error('WhatsApp has temporarily rate-limited pairing codes for this phone number due to multiple recent attempts. Please scan the QR code tab instead to link instantly, or wait 15 minutes.');
      }
      throw pairingErr;
    }
  }

  scheduleReconnect(delayMs = 2000) {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (!this.autoReconnect) return;

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(() => {});
    }, delayMs);
  }

  async disconnect() {
    this.autoReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    const accountJid = this.connectedJid || auth.getSessionOwner(this.sessionId);

    if (this.socket) {
      try {
        await this.socket.logout();
      } catch (e) {}
      try {
        this.socket.end();
      } catch (e) {}
      this.socket = null;
    }

    auth.clearSession(this.sessionId);
    this.latestQr = null;
    this.latestPairingCode = null;
    this.isRegistered = false;
    this.realtimeChats.clear();
    this.realtimeMessages.clear();
    this.contactNames.clear();
    this.connectedJid = null;
    this.updateStatus('NOT_CONNECTED');

    // Wipe only this specific account's data
    if (accountJid) {
      try {
        const supabase = require('../config/supabase');
        await supabase.query('DELETE FROM ai_actions WHERE account_jid = $1', [accountJid]);
        await supabase.query('DELETE FROM suggested_replies WHERE account_jid = $1', [accountJid]);
        await supabase.query('DELETE FROM extractions WHERE account_jid = $1', [accountJid]);
        await supabase.query('DELETE FROM messages WHERE account_jid = $1', [accountJid]);
        await supabase.query('DELETE FROM contacts WHERE account_jid = $1', [accountJid]);
        console.log(`[WhatsAppSession:${this.sessionId}] Data wiped for account ${accountJid}`);
      } catch (e) {}
    }
  }

  async sendMessage(jid, text) {
    if (!this.socket || this.status !== 'CONNECTED') {
      throw new Error(`WhatsApp is not connected for session [${this.sessionId}].`);
    }
    let canonicalJid = getCanonicalJid(jid);
    let targetJid = canonicalJid.endsWith('@g.us') || canonicalJid.endsWith('@newsletter')
      ? canonicalJid
      : (canonicalJid.includes('@') ? canonicalJid : `${canonicalJid}@s.whatsapp.net`);

    // Verify and resolve registered WhatsApp user JID via onWhatsApp to guarantee 2-tick delivery
    if (!targetJid.endsWith('@g.us') && !targetJid.endsWith('@newsletter') && this.socket.onWhatsApp) {
      try {
        const numToVerify = targetJid.split('@')[0].split(':')[0];
        const results = await this.socket.onWhatsApp(numToVerify);
        if (Array.isArray(results) && results.length > 0) {
          const match = results.find(r => r.exists && r.jid);
          if (match && match.jid) {
            targetJid = match.jid;
            const verifiedCanonical = getCanonicalJid(match.jid);
            if (canonicalJid !== verifiedCanonical) {
              registerLidMapping(canonicalJid, verifiedCanonical);
              canonicalJid = verifiedCanonical;
            }
          }
        }
      } catch (onWaErr) {
        console.warn(`[WhatsAppSession:${this.sessionId}] onWhatsApp resolution warning for ${targetJid}:`, onWaErr.message);
      }
    }

    const customMessageId = 'NRYN_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    const rawProto = { conversation: text.trim() };

    // Pre-cache raw proto so getMessage returns it instantly during Signal E2EE retry packets
    this.rawProtoMessages.set(customMessageId, rawProto);
    if (this.rawProtoMessages.size > 5000) {
      const firstKey = this.rawProtoMessages.keys().next().value;
      this.rawProtoMessages.delete(firstKey);
    }

    const sent = await this.socket.sendMessage(targetJid, { text: text.trim() }, { messageId: customMessageId });
    const messageId = sent?.key?.id || customMessageId;

    const accountJid = this.connectedJid || auth.getSessionOwner(this.sessionId) || 'default_user';

    try {
      const messageService = require('../services/message.service');
      const contactService = require('../services/contact.service');
      const contact = await contactService.findContactByJid(canonicalJid, accountJid);

      await messageService.saveMessage({
        account_jid: accountJid,
        contact_id: contact?.id || null,
        chat_jid: canonicalJid,
        sender_jid: 'me',
        from_me: true,
        timestamp: new Date().toISOString(),
        text: text.trim(),
        message_type: 'text',
        has_media: false,
        whatsapp_message_id: messageId
      });

      const supabase = require('../config/supabase');
      await supabase.query(
        `UPDATE ai_actions SET status = 'dismissed', updated_at = NOW() 
         WHERE chat_jid = $1 AND account_jid = $2 AND type = 'reply_needed' AND status = 'active'`,
        [canonicalJid, accountJid]
      );
      await supabase.query(
        `UPDATE suggested_replies SET status = 'sent', updated_at = NOW()
         WHERE chat_jid = $1 AND account_jid = $2 AND status = 'pending'`,
        [canonicalJid, accountJid]
      );
    } catch (dbErr) {
      console.warn(`[WhatsAppSession:${this.sessionId}] Error persisting sent message:`, dbErr.message);
    }

    // Track outgoing message locally
    this.addRealtimeMessage(canonicalJid, text, Date.now(), true, 'You', messageId);
    return sent;
  }

}

class WhatsAppSessionManager {
  constructor() {
    this.sessions = new Map(); // sessionId -> WhatsAppSessionInstance
    this.io = null;
  }

  setSocketIO(io) {
    this.io = io;
    this.setupSocketListeners();
  }

  getSession(sessionId = 'default') {
    const sId = String(sessionId || 'default').trim();
    if (!this.sessions.has(sId)) {
      const instance = new WhatsAppSessionInstance(sId, this);
      this.sessions.set(sId, instance);
      
      // Auto-connect if saved session exists
      if (auth.sessionExists(sId)) {
        instance.connect().catch(() => {});
      }
    }
    return this.sessions.get(sId);
  }

  getConnectedJid(sessionId = 'default') {
    const session = this.getSession(sessionId);
    return session.connectedJid || auth.getSessionOwner(sessionId) || null;
  }

  setupSocketListeners() {
    if (!this.io) return;

    this.io.on('connection', (clientSocket) => {
      // Determine session ID from handshake query or default
      const initialSessionId = String(clientSocket.handshake.query?.sessionId || 'default').trim();
      clientSocket.join(`session_${initialSessionId}`);

      const session = this.getSession(initialSessionId);
      clientSocket.emit('whatsapp:status', { status: session.status, sessionId: initialSessionId });

      if (session.latestQr && (session.status === 'QR_READY' || session.status === 'CONNECTING')) {
        clientSocket.emit('whatsapp:qr', { qr: session.latestQr, sessionId: initialSessionId });
      }

      clientSocket.emit('whatsapp:realtime_chats', { chats: session.getSortedChats(), sessionId: initialSessionId });

      // Handle client joining / switching sessions
      clientSocket.on('whatsapp:join_session', (data) => {
        const sId = String(data?.sessionId || 'default').trim();
        clientSocket.join(`session_${sId}`);
        const sess = this.getSession(sId);
        clientSocket.emit('whatsapp:status', { status: sess.status, sessionId: sId });
        if (sess.latestQr) {
          clientSocket.emit('whatsapp:qr', { qr: sess.latestQr, sessionId: sId });
        }
        clientSocket.emit('whatsapp:realtime_chats', { chats: sess.getSortedChats(), sessionId: sId });
      });

      clientSocket.on('whatsapp:request_status', (data) => {
        const sId = String(data?.sessionId || initialSessionId).trim();
        const sess = this.getSession(sId);
        clientSocket.emit('whatsapp:status', { status: sess.status, sessionId: sId });
        if (sess.latestQr) {
          clientSocket.emit('whatsapp:qr', { qr: sess.latestQr, sessionId: sId });
        }
        clientSocket.emit('whatsapp:realtime_chats', { chats: sess.getSortedChats(), sessionId: sId });
      });

      clientSocket.on('whatsapp:send_message', async (data) => {
        const sId = String(data?.sessionId || initialSessionId).trim();
        const { jid, text } = data || {};
        if (jid && text) {
          try {
            const sess = this.getSession(sId);
            await sess.sendMessage(jid, text);
          } catch (e) {
            console.error('Socket send_message error:', e.message);
          }
        }
      });
    });
  }

  handleUnhandledError(reason) {
    const errorStr = String(reason?.message || reason || '');
    if (
      errorStr.includes('Session error') ||
      errorStr.includes('Connection Closed') ||
      errorStr.includes('timed out') ||
      errorStr.includes('Stream Errored')
    ) {
      console.warn('[WhatsAppSessionManager] Handled transient connection error:', errorStr);
      return true;
    }
    return false;
  }

  async initOnStartup() {
    console.log('[WhatsAppSessionManager] Initialized multi-session manager.');
    // Check if any existing sessions on disk should be auto-restored
    const fs = require('fs');
    const path = require('path');
    const baseAuthDir = path.resolve(__dirname, '../../.data/whatsapp-auth');
    if (fs.existsSync(baseAuthDir)) {
      const dirs = fs.readdirSync(baseAuthDir);
      for (const d of dirs) {
        const fullPath = path.join(baseAuthDir, d);
        if (d.startsWith('session_') && !d.endsWith('.json') && fs.statSync(fullPath).isDirectory()) {
          const sId = d.replace('session_', '');
          console.log(`[WhatsAppSessionManager] Auto-restoring session: ${sId}`);
          this.getSession(sId);
        }
      }
    }
  }

  // Backward compatibility convenience methods mapping to sessionId
  async connect(sessionId = 'default') {
    return this.getSession(sessionId).connect();
  }

  async disconnect(sessionId = 'default') {
    return this.getSession(sessionId).disconnect();
  }

  getStatus(sessionId = 'default') {
    return this.getSession(sessionId).status;
  }

  getQR(sessionId = 'default') {
    return this.getSession(sessionId).latestQr;
  }

  async requestPairingCode(phoneNumber, sessionId = 'default') {
    return this.getSession(sessionId).requestPairingCode(phoneNumber);
  }

  async sendMessage(jid, text, sessionId = 'default') {
    return this.getSession(sessionId).sendMessage(jid, text);
  }
}

module.exports = new WhatsAppSessionManager();
