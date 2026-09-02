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
  onCancel: () => void;
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
    case 'AUTHENTICATING':
      return (
        <View style={styles.stateContainer}>
          <ActivityIndicator size="large" color="#10B981" style={styles.spinner} />
          <Text style={[styles.stateTitle, { color: '#34D399' }]}>Connecting WhatsApp...</Text>
          <Text style={styles.subtext}>Authenticating linked device session</Text>
        </View>
      );

    case 'CONNECTED':
      return (
        <View style={styles.stateContainer}>
          <View style={styles.successCircle}>
            <Text style={styles.checkmark}>✓</Text>
          </View>
          <Text style={[styles.stateTitle, { color: '#34D399' }]}>WhatsApp Connected</Text>
          <Text style={styles.subtext}>Device paired successfully. Redirecting...</Text>
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

            <TouchableOpacity
              style={[styles.actionBtn, styles.cancelBtnSecondary]}
              onCancel={onCancel}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      );

    case 'NOT_CONNECTED':
    case 'DISCONNECTED':
    case 'LOGGED_OUT':
    case 'CONNECTING':
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
              <Text style={styles.subtitle}>Scan this QR code with WhatsApp</Text>

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
                <Text style={styles.instructionHeading}>How to connect:</Text>
                <Text style={styles.stepText}>1. Open <Text style={styles.boldText}>WhatsApp</Text> on your phone</Text>
                <Text style={styles.stepText}>2. Tap <Text style={styles.boldText}>Settings</Text> or <Text style={styles.boldText}>Menu (⋮)</Text></Text>
                <Text style={styles.stepText}>3. Tap <Text style={styles.boldText}>Linked Devices</Text></Text>
                <Text style={styles.stepText}>4. Tap <Text style={styles.boldText}>Link a Device</Text></Text>
                <Text style={styles.stepText}>5. Point your camera at this QR code</Text>
              </View>
            </>
          ) : (
            <View style={styles.phonePairingCard}>
              <Text style={styles.instructionHeading}>Link with Phone Number:</Text>
              <Text style={styles.stepText}>Enter your 10-digit mobile number:</Text>

              <TextInput
                style={styles.phoneInput}
                placeholder="e.g. 9876543210"
                placeholderTextColor="#64748B"
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
                  <Text style={styles.getCodeBtnText}>Get Pairing Code</Text>
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

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onCancel}
            activeOpacity={0.8}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
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
    color: '#F8FAFC',
    textAlign: 'center',
    marginBottom: 6
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#CBD5E1',
    textAlign: 'center',
    marginBottom: 16
  },
  subtext: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center'
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
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
    backgroundColor: '#2563EB'
  },
  tabText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600'
  },
  activeTabText: {
    color: '#FFFFFF'
  },
  qrWrapper: {
    marginVertical: 8
  },
  mockScanButton: {
    backgroundColor: '#3B82F6',
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
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#334155'
  },
  phonePairingCard: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#334155'
  },
  instructionHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 8
  },
  stepText: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 6,
    lineHeight: 18
  },
  boldText: {
    color: '#F8FAFC',
    fontWeight: '600'
  },
  phoneInput: {
    backgroundColor: '#1E293B',
    color: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#334155',
    marginVertical: 10
  },
  errorTextSmall: {
    color: '#EF4444',
    fontSize: 12,
    marginBottom: 8
  },
  getCodeBtn: {
    backgroundColor: '#2563EB',
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
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
    borderWidth: 2,
    borderColor: '#10B981'
  },
  codeLabel: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1
  },
  codeText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 3,
    marginVertical: 8
  },
  codeInstruction: {
    color: '#CBD5E1',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18
  },
  cancelButton: {
    width: '100%',
    height: 44,
    borderRadius: 10,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12
  },
  cancelButtonText: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '600'
  },
  successCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
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
    color: '#94A3B8',
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
    backgroundColor: '#2563EB'
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600'
  },
  cancelBtnSecondary: {
    backgroundColor: '#334155'
  },
  cancelBtnText: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '600'
  }
});
