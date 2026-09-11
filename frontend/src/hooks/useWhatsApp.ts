import { useState, useEffect, useCallback } from 'react';
import {
  whatsappService,
  ConnectionStatus
} from '../services/whatsapp.service';

export function useWhatsApp() {
  const [status, setStatus] = useState<ConnectionStatus>('NOT_CONNECTED');
  const [qrValue, setQrValue] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMockMode, setIsMockMode] = useState<boolean>(whatsappService.getIsMockMode());

  useEffect(() => {
    const unsubscribe = whatsappService.subscribe({
      onStatusChange: (newStatus) => {
        setStatus(newStatus);
        if (newStatus !== 'ERROR') {
          setErrorMessage(null);
        }
      },
      onQRReceived: (qr) => {
        setQrValue(qr);
      },
      onPairingCodeReceived: (code) => {
        setPairingCode(code);
      },
      onError: (err) => {
        setErrorMessage(err);
      }
    });

    const pollStatus = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return;
      }
      const currentStatus = whatsappService.getStatus();
      if (
        currentStatus === 'CONNECTING' ||
        currentStatus === 'QR_READY' ||
        currentStatus === 'AUTHENTICATING'
      ) {
        whatsappService.checkStatus();
      }
    };

    const statusPoll = setInterval(pollStatus, 5000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        pollStatus();
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      unsubscribe();
      clearInterval(statusPoll);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, []);

  const connect = useCallback(async () => {
    setErrorMessage(null);
    return await whatsappService.connect();
  }, []);

  const requestPairingCode = useCallback(async (phoneNumber: string) => {
    setErrorMessage(null);
    return await whatsappService.requestPairingCode(phoneNumber);
  }, []);

  const disconnect = useCallback(async () => {
    await whatsappService.disconnect();
  }, []);

  const retry = useCallback(async () => {
    setErrorMessage(null);
    await whatsappService.connect();
  }, []);

  const simulateScan = useCallback(() => {
    whatsappService.simulateMockScanSuccess();
  }, []);

  const toggleMockMode = useCallback((enabled: boolean) => {
    whatsappService.setMockMode(enabled);
    setIsMockMode(enabled);
  }, []);

  return {
    status,
    qrValue,
    pairingCode,
    errorMessage,
    isConnecting: status === 'CONNECTING' || status === 'AUTHENTICATING',
    isConnected: status === 'CONNECTED',
    isMockMode,
    connect,
    requestPairingCode,
    disconnect,
    retry,
    simulateScan,
    toggleMockMode
  };
}
