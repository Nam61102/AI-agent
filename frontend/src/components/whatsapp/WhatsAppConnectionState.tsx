import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  TextInput
} from 'react-native';
import { ConnectionStatus } from '../../services/whatsapp.service';
import { WhatsAppQRCode } from './WhatsAppQRCode';

interface WhatsAppConnectionStateProps {
  status: ConnectionStatus;
  qrValue: string | null;
  pairingCode?: string | null;
  errorMessage?: string | null;
  onCancel?: () => void;
  onRetry: () => void;
  onRequestPairingCode?: (phone: string) => Promise<any>;
  onSimulateScan?: () => void;
  isMockMode?: boolean;
}

export const WhatsAppConnectionState: React.FC<WhatsAppConnectionStateProps> = ({
  status,
  qrValue,
  pairingCode: activePairingCode,
  errorMessage,
  onCancel,
  onRetry,
  onRequestPairingCode,
  onSimulateScan,
  isMockMode = false
}) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [pairingCodeState, setPairingCodeState] = useState<string | null>(activePairingCode || null);
  const [loadingCode, setLoadingCode] = useState(false);
  const [pairingError, setPairingError] = useState<string | null>(null);
  const [mode, setMode] = useState<'QR' | 'PHONE'>('QR');

  const handleGetPairingCode = async () => {
    if (!phoneNumber || phoneNumber.trim().length < 8) {
      setPairingError('Please enter a valid 10-digit mobile number');
      return;
    }
    setPairingError(null);
    setLoadingCode(true);
    try {
      if (onRequestPairingCode) {
        const res = await onRequestPairingCode(phoneNumber);
        if (res.success && res.code) {
          setPairingCodeState(res.code);
        } else {
          setPairingError(res.error || 'Failed to generate code');
        }
      }
    } catch (e: any) {
      setPairingError(e.message || 'Error requesting code');
    } finally {
      setLoadingCode(false);
    }
  };

  switch (status) {
    case 'CONNECTED':
      return (
        <View style={styles.stateContainer}>
          <View style={styles.successCircle}>
            <Text style={styles.checkmark}>✓</Text>
          </View>
          <Text style={[styles.stateTitle, { color: '#10B981' }]}>WhatsApp Connected</Text>
          <Text style={styles.subtext}>Account verified! Loading your dashboard...</Text>
        </View>
      );

    case 'ERROR':
      return (
        <View style={styles.stateContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={[styles.stateTitle, { color: '#EF4444' }]}>Unable to connect WhatsApp</Text>
          <Text style={styles.errorDescription}>
            {errorMessage || 'Something went wrong while connecting your WhatsApp account.'}
          </Text>

          <View style={styles.errorButtonRow}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.retryBtn]}
              onPress={onRetry}
              activeOpacity={0.8}
            >
              <Text style={styles.retryBtnText}>Try Again</Text>
            </TouchableOpacity>

            {onCancel && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.cancelBtnSecondary]}
                onPress={onCancel}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      );

    case 'NOT_CONNECTED':
    case 'DISCONNECTED':
    case 'LOGGED_OUT':
    case 'QR_READY':
    default:
      return (
        <View style={styles.stateContainer}>
          {/* TAB SWITCHER: QR vs PHONE NUMBER */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tabButton, mode === 'QR' && styles.activeTabButton]}
              onPress={() => setMode('QR')}
            >
              <Text style={[styles.tabText, mode === 'QR' && styles.activeTabText]}>Scan QR Code</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, mode === 'PHONE' && styles.activeTabButton]}
              onPress={() => setMode('PHONE')}
            >
              <Text style={[styles.tabText, mode === 'PHONE' && styles.activeTabText]}>Link via Phone Number</Text>
            </TouchableOpacity>
          </View>

          {mode === 'QR' ? (
            <>
              <Text style={styles.subtitle}>Scan this QR code with your WhatsApp</Text>

              <View style={styles.qrWrapper}>
                <WhatsAppQRCode qrValue={qrValue} size={220} />
              </View>

              {isMockMode && onSimulateScan && (
                <TouchableOpacity
                  style={styles.mockScanButton}
                  onPress={onSimulateScan}
                  activeOpacity={0.8}
                >
                  <Text style={styles.mockScanText}>⚡ Simulate QR Scan (Mock Mode)</Text>
                </TouchableOpacity>
              )}

              <View style={styles.instructionsCard}>
                <Text style={styles.instructionHeading}>How to link your account:</Text>
                <Text style={styles.stepText}>1. Open <Text style={styles.boldText}>WhatsApp</Text> on your phone</Text>
                <Text style={styles.stepText}>2. Tap <Text style={styles.boldText}>Settings</Text> or <Text style={styles.boldText}>Menu (⋮)</Text></Text>
                <Text style={styles.stepText}>3. Tap <Text style={styles.boldText}>Linked Devices</Text></Text>
                <Text style={styles.stepText}>4. Tap <Text style={styles.boldText}>Link a Device</Text></Text>
                <Text style={styles.stepText}>5. Point your phone camera at this QR code</Text>
              </View>
            </>
          ) : (
            <View style={styles.phonePairingCard}>
              <Text style={styles.instructionHeading}>Link with Phone Number:</Text>
              <Text style={styles.stepText}>Enter your 10-digit mobile number with country code:</Text>

              <TextInput
                style={styles.phoneInput}
                placeholder="e.g. 919876543210"
                placeholderTextColor="#94A3B8"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                keyboardType="phone-pad"
              />

              {pairingError && <Text style={styles.errorTextSmall}>{pairingError}</Text>}

              <TouchableOpacity
                style={styles.getCodeBtn}
                onPress={handleGetPairingCode}
                disabled={loadingCode}
              >
                {loadingCode ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.getCodeBtnText}>Get 8-Digit Pairing Code</Text>
                )}
              </TouchableOpacity>

              {(pairingCodeState || activePairingCode) && (
                <View style={styles.codeDisplayBox}>
                  <Text style={styles.codeLabel}>YOUR WHATSAPP PAIRING CODE:</Text>
                  <Text style={styles.codeText}>
                    {(pairingCodeState || activePairingCode)?.replace(/(.{4})/, '$1 - ')}
                  </Text>
                  <Text style={styles.codeInstruction}>
                    On your phone: Open WhatsApp &gt; Linked Devices &gt; <Text style={styles.boldText}>Link with phone number instead</Text> &gt; enter code.
                  </Text>
                </View>
              )}
            </View>
          )}

          {onCancel && (
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onCancel}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>
      );
  }
};

const styles = StyleSheet.create({
  stateContainer: {
    alignItems: 'center',
    paddingVertical: 10,
    width: '100%'
  },
  spinner: {
    marginVertical: 20
  },
  stateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 6
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#475569',
    textAlign: 'center',
    marginBottom: 16
  },
  subtext: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center'
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    width: '100%'
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8
  },
  activeTabButton: {
    backgroundColor: '#4F46E5'
  },
  tabText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600'
  },
  activeTabText: {
    color: '#FFFFFF'
  },
  qrWrapper: {
    marginVertical: 8,
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2
  },
  mockScanButton: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginVertical: 8
  },
  mockScanText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600'
  },
  instructionsCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1'
  },
  phonePairingCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1'
  },
  instructionHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8
  },
  stepText: {
    fontSize: 13,
    color: '#475569',
    marginBottom: 6,
    lineHeight: 18
  },
  boldText: {
    color: '#0F172A',
    fontWeight: '600'
  },
  phoneInput: {
    backgroundColor: '#FFFFFF',
    color: '#0F172A',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginVertical: 10
  },
  errorTextSmall: {
    color: '#EF4444',
    fontSize: 12,
    marginBottom: 8
  },
  getCodeBtn: {
    backgroundColor: '#4F46E5',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4
  },
  getCodeBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700'
  },
  codeDisplayBox: {
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
    borderWidth: 2,
    borderColor: '#4F46E5'
  },
  codeLabel: {
    color: '#4F46E5',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1
  },
  codeText: {
    color: '#1E1B4B',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 3,
    marginVertical: 8
  },
  codeInstruction: {
    color: '#475569',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18
  },
  cancelButton: {
    width: '100%',
    height: 44,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12
  },
  cancelButtonText: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '600'
  },
  successCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 2,
    borderColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16
  },
  checkmark: {
    fontSize: 30,
    color: '#10B981',
    fontWeight: 'bold'
  },
  errorIcon: {
    fontSize: 40,
    marginVertical: 12
  },
  errorDescription: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginHorizontal: 16,
    marginBottom: 20,
    lineHeight: 20
  },
  errorButtonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%'
  },
  actionBtn: {
    flex: 1,
    height: 46,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  retryBtn: {
    backgroundColor: '#4F46E5'
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600'
  },
  cancelBtnSecondary: {
    backgroundColor: '#E2E8F0'
  },
  cancelBtnText: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '600'
  }
});
