import {
    makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    WASocket,
    WAMessage,
    Chat as BaileysChat,
    fetchLatestBaileysVersion
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import * as QRCode from 'qrcode';
import pino from 'pino';
import * as fs from 'fs';
import * as path from 'path';

export interface Chat {
    jid: string;
    name: string;
    last_message_text: string;
    last_message_timestamp: Date;
    needs_reply: boolean;
    unread_count: number;
}

export interface MessageInfo {
    jid: string;
    pushName: string;
    text: string;
    fromMe: boolean;
    timestamp: Date;
    rawMessage: WAMessage;
}

export type MessageCallback = (msgInfo: MessageInfo) => void;
export type QrCallback = (qrDataUrl: string) => void;
export type ConnectionCallback = (status: string) => void;
export type ChatUpdateCallback = (chats: Chat[]) => void;

const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

class WhatsAppService {
    private static instance: WhatsAppService;
    private socket: WASocket | null = null;
    private readonly authFolder = 'auth_info_baileys';
    
    // In-memory chat storage (Can be backed by PostgreSQL / Supabase)
    private chats: Map<string, Chat> = new Map();

    private onMessageReceived?: MessageCallback;
    private onQrGenerated?: QrCallback;
    private onConnectionUpdate?: ConnectionCallback;
    private onChatsUpdated?: ChatUpdateCallback;
    
    private logger = pino({ level: 'silent' });

    private constructor() {}

    public static getInstance(): WhatsAppService {
        if (!WhatsAppService.instance) {
            WhatsAppService.instance = new WhatsAppService();
        }
        return WhatsAppService.instance;
    }

    public setCallbacks(callbacks: {
        onMessageReceived?: MessageCallback;
        onQrGenerated?: QrCallback;
        onConnectionUpdate?: ConnectionCallback;
        onChatsUpdated?: ChatUpdateCallback;
    }) {
        if (callbacks.onMessageReceived) this.onMessageReceived = callbacks.onMessageReceived;
        if (callbacks.onQrGenerated) this.onQrGenerated = callbacks.onQrGenerated;
        if (callbacks.onConnectionUpdate) this.onConnectionUpdate = callbacks.onConnectionUpdate;
        if (callbacks.onChatsUpdated) this.onChatsUpdated = callbacks.onChatsUpdated;
    }

    public async initialize(): Promise<void> {
        try {
            const { state, saveCreds } = await useMultiFileAuthState(this.authFolder);
            const { version, isLatest } = await fetchLatestBaileysVersion();

            this.socket = makeWASocket({
                version,
                auth: state,
                printQRInTerminal: true,
                browser: ['macOS', 'Chrome', '124.0.0'],
                syncFullHistory: true,
                shouldSyncHistoryMessage: () => true,
                logger: this.logger as any,
            });

            this.socket.ev.on('creds.update', saveCreds);

            // Connection update listener
            this.socket.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr } = update;

                if (qr) {
                    try {
                        const qrDataUrl = await QRCode.toDataURL(qr);
                        if (this.onQrGenerated) this.onQrGenerated(qrDataUrl);
                    } catch (error) {
                        console.error('[WhatsAppService] Error generating QR URL:', error);
                    }
                }

                if (connection === 'close') {
                    const error = (lastDisconnect?.error as Boom)?.output?.statusCode;
                    const isLoggedOut = error === DisconnectReason.loggedOut;
                    
                    if (isLoggedOut) {
                        console.log('[WhatsAppService] Logged out. Clearing auth and resetting...');
                        if (this.onConnectionUpdate) this.onConnectionUpdate('logged_out');
                        this.deleteAuthFolder();
                        this.initialize();
                    } else {
                        console.log(`[WhatsAppService] Connection closed (${error}). Reconnecting in 2s...`);
                        if (this.onConnectionUpdate) this.onConnectionUpdate('AUTHENTICATING');
                        setTimeout(() => this.initialize(), 2000);
                    }
                } else if (connection === 'open') {
                    console.log('[WhatsAppService] Connection opened successfully!');
                    if (this.onConnectionUpdate) this.onConnectionUpdate('open');
                }
            });

            // 1. Initial History Sync Listener (Filtered for < 12 Hours & Ignore Channels)
            this.socket.ev.on('messaging-history.set', ({ chats, messages }) => {
                console.log(`[WhatsAppService] Received history sync with ${messages.length} messages and ${chats.length} chats.`);
                const now = Date.now();

                // Process initial chats
                for (const bChat of chats) {
                    if (bChat.id.endsWith('@newsletter')) continue; // Skip channels/newsletters
                    
                    this.upsertChatMemory({
                        jid: bChat.id,
                        name: bChat.name || bChat.id.split('@')[0],
                        last_message_text: '',
                        last_message_timestamp: new Date(0),
                        needs_reply: false,
                        unread_count: bChat.unreadCount || 0
                    });
                }

                // Process initial messages (12-hour filter)
                for (const msg of messages) {
                    if (!msg.message) continue;
                    const jid = msg.key.remoteJid;
                    if (!jid || jid.endsWith('@newsletter')) continue;

                    const msgTimestampMs = this.getTimestampMs(msg.messageTimestamp);
                    
                    // Filter out messages older than 12 hours
                    if (now - msgTimestampMs > TWELVE_HOURS_MS) {
                        continue; 
                    }

                    const text = this.extractMessageText(msg);
                    if (!text) continue;

                    const fromMe = msg.key.fromMe || false;
                    const msgDate = new Date(msgTimestampMs);

                    this.updateChatFromMessage(jid, text, msgDate, !fromMe, msg.pushName);
                }

                this.notifyChatUpdates();
            });

            // 2. Real-time Incoming Message Listener (12-Hour Fallback & Channel Filter)
            this.socket.ev.on('messages.upsert', async (m) => {
                if (m.type !== 'notify') return;
                const now = Date.now();

                for (const msg of m.messages) {
                    if (!msg.message) continue;

                    const jid = msg.key.remoteJid;
                    if (!jid || jid.endsWith('@newsletter')) continue;

                    const msgTimestampMs = this.getTimestampMs(msg.messageTimestamp);
                    
                    // 12-hour fallback check
                    if (now - msgTimestampMs > TWELVE_HOURS_MS) continue;

                    const text = this.extractMessageText(msg);
                    if (!text) continue;

                    const fromMe = msg.key.fromMe || false;
                    const pushName = msg.pushName || jid.split('@')[0];
                    const msgDate = new Date(msgTimestampMs);

                    // Update chat list state
                    this.updateChatFromMessage(jid, text, msgDate, !fromMe, pushName);

                    // Trigger hook for application layer
                    if (this.onMessageReceived) {
                        this.onMessageReceived({
                            jid,
                            pushName,
                            text,
                            fromMe,
                            timestamp: msgDate,
                            rawMessage: msg
                        });
                    }
                }

                this.notifyChatUpdates();
            });

            // 3. Chat Upsert & Update Listeners
            this.socket.ev.on('chats.upsert', (newChats: BaileysChat[]) => {
                for (const bChat of newChats) {
                    if (bChat.id.endsWith('@newsletter')) continue;
                    const existing = this.chats.get(bChat.id);
                    this.upsertChatMemory({
                        jid: bChat.id,
                        name: bChat.name || existing?.name || bChat.id.split('@')[0],
                        last_message_text: existing?.last_message_text || '',
                        last_message_timestamp: existing?.last_message_timestamp || new Date(),
                        needs_reply: existing?.needs_reply || false,
                        unread_count: bChat.unreadCount || existing?.unread_count || 0
                    });
                }
                this.notifyChatUpdates();
            });

            this.socket.ev.on('chats.update', (updates) => {
                for (const update of updates) {
                    if (!update.id || update.id.endsWith('@newsletter')) continue;
                    const chat = this.chats.get(update.id);
                    if (chat) {
                        if (update.unreadCount !== undefined && update.unreadCount !== null) {
                            chat.unread_count = update.unreadCount;
                        }
                        this.chats.set(chat.jid, chat);
                    }
                }
                this.notifyChatUpdates();
            });

        } catch (error) {
            console.error('[WhatsAppService] Initialization error:', error);
        }
    }

    /**
     * Extracts text cleanly from standard text, extended text, image caption, video caption.
     */
    private extractMessageText(msg: WAMessage): string | null {
        const message = msg.message;
        if (!message) return null;

        if (message.conversation) return message.conversation;
        if (message.extendedTextMessage?.text) return message.extendedTextMessage.text;
        if (message.imageMessage?.caption) return message.imageMessage.caption;
        if (message.videoMessage?.caption) return message.videoMessage.caption;
        return null;
    }

    /**
     * Converts Baileys messageTimestamp (seconds or Long object) into milliseconds timestamp.
     */
    private getTimestampMs(ts: WAMessage['messageTimestamp']): number {
        if (!ts) return Date.now();
        if (typeof ts === 'number') return ts * 1000;
        if (typeof ts === 'object' && 'low' in ts) return ts.low * 1000;
        return Date.now();
    }

    /**
     * Helper to update or insert chat in memory
     */
    private updateChatFromMessage(jid: string, text: string, timestamp: Date, needsReply: boolean, name?: string) {
        const existing = this.chats.get(jid);
        this.chats.set(jid, {
            jid,
            name: name || existing?.name || jid.split('@')[0],
            last_message_text: text,
            last_message_timestamp: timestamp,
            needs_reply: needsReply,
            unread_count: needsReply ? (existing?.unread_count || 0) + 1 : (existing?.unread_count || 0)
        });
    }

    private upsertChatMemory(chat: Chat) {
        if (!this.chats.has(chat.jid)) {
            this.chats.set(chat.jid, chat);
        }
    }

    private notifyChatUpdates() {
        if (this.onChatsUpdated) {
            this.onChatsUpdated(this.getChatsSorted());
        }
    }

    /**
     * 3. Priority on Top Sorting Logic
     * Returns chats sorted so that chats needing reply appear FIRST,
     * followed by last_message_timestamp in DESCENDING order.
     */
    public getChatsSorted(): Chat[] {
        const chatList = Array.from(this.chats.values());
        
        return chatList.sort((a, b) => {
            // Priority 1: Put chats that need reply on top
            if (a.needs_reply && !b.needs_reply) return -1;
            if (!a.needs_reply && b.needs_reply) return 1;

            // Priority 2: Sort remaining by newest last_message_timestamp (DESC)
            return b.last_message_timestamp.getTime() - a.last_message_timestamp.getTime();
        });
    }

    /**
     * 4. Sending Replies
     * Sends a text message and clears the needs_reply flag for the chat.
     */
    public async sendMessage(jid: string, text: string): Promise<void> {
        if (!this.socket) {
            throw new Error('[WhatsAppService] Socket is not initialized.');
        }

        try {
            await this.socket.sendMessage(jid, { text });
            console.log(`[WhatsAppService] Message sent to ${jid}`);

            // Update chat state: needs_reply is now FALSE
            const existing = this.chats.get(jid);
            this.chats.set(jid, {
                jid,
                name: existing?.name || jid.split('@')[0],
                last_message_text: text,
                last_message_timestamp: new Date(),
                needs_reply: false, // Priority resolved
                unread_count: 0
            });

            this.notifyChatUpdates();
        } catch (error) {
            console.error(`[WhatsAppService] Failed to send message to ${jid}:`, error);
            throw error;
        }
    }

    private deleteAuthFolder(): void {
        try {
            const folderPath = path.resolve(process.cwd(), this.authFolder);
            if (fs.existsSync(folderPath)) {
                fs.rmSync(folderPath, { recursive: true, force: true });
                console.log(`[WhatsAppService] Auth folder '${this.authFolder}' deleted.`);
            }
        } catch (err) {
            console.error(`[WhatsAppService] Failed to delete auth folder '${this.authFolder}':`, err);
        }
    }
}

export default WhatsAppService.getInstance();
