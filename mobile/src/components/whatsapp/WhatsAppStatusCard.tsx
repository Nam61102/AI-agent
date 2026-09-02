import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { ConnectionStatus } from '../../services/whatsapp.service';

interface WhatsAppStatusCardProps {
  status: ConnectionStatus;
  onConnectPress: () => void;
  onDisconnectPress?: () => void;
  isConnecting?: boolean;
}

export const WhatsAppStatusCard: React.FC<WhatsAppStatusCardProps> = ({
  status,
  onConnectPress,
  onDisconnectPress,
  isConnecting = false
}) => {
  const isConnected = status === 'CONNECTED';

  const getStatusBadgeStyle = () => {
    switch (status) {
      case 'CONNECTED':
        return styles.badgeConnected;
      case 'CONNECTING':
      case 'QR_READY':
      case 'AUTHENTICATING':
        return styles.badgeConnecting;
      case 'ERROR':
        return styles.badgeError;
      default:
        return styles.badgeDisconnected;
    }
  };

  const getStatusDotStyle = () => {
    switch (status) {
      case 'CONNECTED':
        return styles.dotConnected;
      case 'CONNECTING':
      case 'QR_READY':
      case 'AUTHENTICATING':
        return styles.dotConnecting;
      case 'ERROR':
        return styles.dotError;
      default:
        return styles.dotDisconnected;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'CONNECTED':
        return '✓ Connected';
      case 'CONNECTING':
        return 'Connecting...';
      case 'QR_READY':
        return 'Scan QR Code';
      case 'AUTHENTICATING':
        return 'Authenticating...';
      case 'ERROR':
        return 'Connection Error';
      case 'DISCONNECTED':
        return 'Disconnected';
      default:
        return 'Not Connected';
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.cardTitle}>WhatsApp</Text>
        <View style={[styles.statusBadge, getStatusBadgeStyle()]}>
          <View style={[styles.statusDot, getStatusDotStyle()]} />
          <Text style={styles.statusBadgeText}>{getStatusText()}</Text>
        </View>
      </View>

      <Text style={styles.description}>
        Connect your WhatsApp account to allow NRYN to securely process your conversations.
      </Text>

      {isConnected ? (
        <TouchableOpacity
          style={[styles.button, styles.buttonDisconnect]}
          onPress={onDisconnectPress}
          activeOpacity={0.8}
          accessibilityLabel="Disconnect WhatsApp"
        >
          <Text style={styles.buttonDisconnectText}>Disconnect WhatsApp</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.button, styles.buttonPrimary]}
          onPress={onConnectPress}
          disabled={isConnecting}
          activeOpacity={0.8}
          accessibilityLabel="Connect WhatsApp"
        >
          {isConnecting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.buttonPrimaryText}>
              {status === 'DISCONNECTED' ? 'Reconnect WhatsApp' : 'Connect WhatsApp'}
            </Text>
          )}
        </TouchableOpacity>
      )}

      <Text style={styles.privacyMessage}>
        Your WhatsApp connection is controlled by you.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F8FAFC',
    letterSpacing: -0.3
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F8FAFC'
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6
  },
  badgeConnected: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.4)'
  },
  dotConnected: {
    backgroundColor: '#10B981'
  },
  badgeConnecting: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: 'rgba(245, 158, 11, 0.4)'
  },
  dotConnecting: {
    backgroundColor: '#F59E0B'
  },
  badgeDisconnected: {
    backgroundColor: 'rgba(148, 163, 184, 0.1)',
    borderColor: '#334155'
  },
  dotDisconnected: {
    backgroundColor: '#94A3B8'
  },
  badgeError: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.4)'
  },
  dotError: {
    backgroundColor: '#EF4444'
  },
  description: {
    fontSize: 14,
    color: '#94A3B8',
    lineHeight: 20,
    marginBottom: 20
  },
  button: {
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12
  },
  buttonPrimary: {
    backgroundColor: '#2563EB'
  },
  buttonPrimaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600'
  },
  buttonDisconnect: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#EF4444'
  },
  buttonDisconnectText: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '600'
  },
  privacyMessage: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    fontStyle: 'italic'
  }
});
