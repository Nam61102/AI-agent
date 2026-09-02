import { io, Socket } from 'socket.io-client';

export type ConnectionStatus =
  | 'NOT_CONNECTED'
  | 'CONNECTING'
  | 'QR_READY'
  | 'AUTHENTICATING'
  | 'CONNECTED'
  | 'DISCONNECTED'
  | 'LOGGED_OUT'
  | 'ERROR';

export interface WhatsAppServiceListener {
  onStatusChange?: (status: ConnectionStatus) => void;
  onQRReceived?: (qrString: string) => void;
  onPairingCodeReceived?: (code: string) => void;
  onError?: (errorMessage: string) => void;
}

const BACKEND_URL = 'http://127.0.0.1:3000';

class WhatsAppService {
  private socket: Socket | null = null;
  private listeners: Set<WhatsAppServiceListener> = new Set();
  private currentStatus: ConnectionStatus = 'NOT_CONNECTED';
  private currentQR: string | null = null;
  private currentPairingCode: string | null = null;
  private isMockMode: boolean = false;
  private mockTimer: any = null;

  constructor() {
    this.initSocket();
  }

  private initSocket() {
    if (this.socket) return;

    try {
      this.socket = io(BACKEND_URL, {
        transports: ['polling', 'websocket'],
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 3000,
        timeout: 5000
      });

      this.socket.on('connect', () => {
        console.log('[WhatsAppService] Socket connected to backend');
        this.socket?.emit('whatsapp:request_status');
      });

      this.socket.on('connect_error', () => {
        if (!this.isMockMode && this.currentStatus === 'NOT_CONNECTED') {
          console.warn('[WhatsAppService] Backend server at 127.0.0.1:3000 is currently offline.');
        }
      });

      this.socket.on('whatsapp:status', (data: { status: ConnectionStatus }) => {
        if (!this.isMockMode && data?.status) {
          this.updateStatus(data.status);
        }
      });

      this.socket.on('whatsapp:qr', (data: { qr: string }) => {
        if (!this.isMockMode && data?.qr) {
          this.currentQR = data.qr;
          this.updateStatus('QR_READY');
          this.notifyQR(data.qr);
        }
      });

      this.socket.on('whatsapp:pairing_code', (data: { code: string }) => {
        if (data?.code) {
          this.currentPairingCode = data.code;
          this.notifyPairingCode(data.code);
        }
      });

      this.socket.on('whatsapp:connecting', () => {
        if (!this.isMockMode) this.updateStatus('CONNECTING');
      });

      this.socket.on('whatsapp:connected', () => {
        if (!this.isMockMode) {
          this.currentQR = null;
          this.currentPairingCode = null;
          this.updateStatus('CONNECTED');
        }
      });

      this.socket.on('whatsapp:disconnected', () => {
        if (!this.isMockMode) this.updateStatus('DISCONNECTED');
      });

      this.socket.on('whatsapp:logged_out', () => {
        if (!this.isMockMode) {
          this.currentQR = null;
          this.currentPairingCode = null;
          this.updateStatus('LOGGED_OUT');
        }
      });

      this.socket.on('whatsapp:error', (data: { message?: string }) => {
        if (!this.isMockMode) {
          this.updateStatus('ERROR');
          this.notifyError(data?.message || 'WhatsApp connection error');
        }
      });
    } catch (err) {
      console.warn('[WhatsAppService] Socket initialization warning:', err);
    }
  }

  public subscribe(listener: WhatsAppServiceListener): () => void {
    this.listeners.add(listener);
    listener.onStatusChange?.(this.currentStatus);
    if (this.currentQR) {
      listener.onQRReceived?.(this.currentQR);
    }
    if (this.currentPairingCode) {
      listener.onPairingCodeReceived?.(this.currentPairingCode);
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  private updateStatus(newStatus: ConnectionStatus) {
    this.currentStatus = newStatus;
    this.listeners.forEach((l) => l.onStatusChange?.(newStatus));
  }

  private notifyQR(qr: string) {
    this.listeners.forEach((l) => l.onQRReceived?.(qr));
  }

  private notifyPairingCode(code: string) {
    this.listeners.forEach((l) => l.onPairingCodeReceived?.(code));
  }

  private notifyError(msg: string) {
    this.listeners.forEach((l) => l.onError?.(msg));
  }

  public async connect(): Promise<{ success: boolean; status: ConnectionStatus }> {
    if (this.isMockMode) {
      return this.runMockConnectionFlow();
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/whatsapp/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      if (data.success) {
        this.updateStatus('CONNECTING');
        return { success: true, status: this.currentStatus };
      } else {
        this.updateStatus('ERROR');
        this.notifyError(data.error || 'Connection failed');
        return { success: false, status: 'ERROR' };
      }
    } catch (err: any) {
      console.warn('[WhatsAppService] Real backend unreachable. Falling back to Mock Mode for UI testing.');
      this.isMockMode = true;
      return this.runMockConnectionFlow();
    }
  }

  public async requestPairingCode(phoneNumber: string): Promise<{ success: boolean; code?: string; error?: string }> {
    if (this.isMockMode) {
      const mockCode = 'ABCD-1234';
      this.currentPairingCode = mockCode;
      this.notifyPairingCode(mockCode);
      return { success: true, code: mockCode };
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/whatsapp/pairing-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber })
      });
      const data = await response.json();
      if (data.success && data.code) {
        this.currentPairingCode = data.code;
        this.notifyPairingCode(data.code);
        return { success: true, code: data.code };
      } else {
        const err = data.error || 'Failed to generate pairing code';
        this.notifyError(err);
        return { success: false, error: err };
      }
    } catch (err: any) {
      const msg = err.message || 'Network error requesting pairing code';
      this.notifyError(msg);
      return { success: false, error: msg };
    }
  }

  public async getStatus(): Promise<ConnectionStatus> {
    if (this.isMockMode) return this.currentStatus;

    try {
      const response = await fetch(`${BACKEND_URL}/api/whatsapp/status`);
      const data = await response.json();
      if (data.success && data.status) {
        this.updateStatus(data.status);
      }
    } catch (err) {
      console.warn('[WhatsAppService] Unable to fetch status from backend.');
    }
    return this.currentStatus;
  }

  public async disconnect(): Promise<{ success: boolean }> {
    if (this.isMockMode) {
      if (this.mockTimer) clearTimeout(this.mockTimer);
      this.currentQR = null;
      this.currentPairingCode = null;
      this.updateStatus('NOT_CONNECTED');
      return { success: true };
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/whatsapp/disconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      if (data.success) {
        this.currentQR = null;
        this.currentPairingCode = null;
        this.updateStatus('NOT_CONNECTED');
        return { success: true };
      }
    } catch (err) {
      console.error('[WhatsAppService] Failed to disconnect:', err);
    }
    return { success: false };
  }

  public setMockMode(enabled: boolean) {
    this.isMockMode = enabled;
  }

  public getIsMockMode(): boolean {
    return this.isMockMode;
  }

  private runMockConnectionFlow(): Promise<{ success: boolean; status: ConnectionStatus }> {
    if (this.mockTimer) clearTimeout(this.mockTimer);

    this.updateStatus('CONNECTING');

    this.mockTimer = setTimeout(() => {
      const mockQR = '2@1A2B3C4D5E6F7G8H9I0J,mock_whatsapp_qr_key_for_mobile_ui_testing,1==';
      this.currentQR = mockQR;
      this.updateStatus('QR_READY');
      this.notifyQR(mockQR);
    }, 1000);

    return Promise.resolve({ success: true, status: 'CONNECTING' });
  }

  public simulateMockScanSuccess() {
    if (this.mockTimer) clearTimeout(this.mockTimer);

    this.updateStatus('AUTHENTICATING');

    this.mockTimer = setTimeout(() => {
      this.currentQR = null;
      this.currentPairingCode = null;
      this.updateStatus('CONNECTED');
    }, 2000);
  }
}

export const whatsappService = new WhatsAppService();
