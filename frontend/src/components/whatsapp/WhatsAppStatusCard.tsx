import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ConnectionStatus } from '../../services/whatsapp.service';
import { Card } from '../ui/Card';
import { Typography } from '../ui/Typography';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { theme } from '../../theme';

interface WhatsAppStatusCardProps {
  status: ConnectionStatus;
  onConnectPress: () => void;
  onDisconnectPress?: () => void;
  onOpenChatsPress?: () => void;
  isConnecting?: boolean;
}

export const WhatsAppStatusCard: React.FC<WhatsAppStatusCardProps> = ({
  status,
  onConnectPress,
  onDisconnectPress,
  onOpenChatsPress,
  isConnecting = false
}) => {
  const isConnected = status === 'CONNECTED';

  const renderStatusBadge = () => {
    switch (status) {
      case 'CONNECTED':
        return <Badge label="✓ Connected" variant="success" />;
      case 'CONNECTING':
      case 'QR_READY':
      case 'AUTHENTICATING':
        return <Badge label={status === 'QR_READY' ? 'Scan QR Code' : 'Connecting...'} variant="warning" />;
      case 'ERROR':
        return <Badge label="Connection Error" variant="error" />;
      default:
        return <Badge label="Not Connected" variant="neutral" />;
    }
  };

  return (
    <Card variant="elevated">
      <View style={styles.headerRow}>
        <Typography variant="h3">WhatsApp</Typography>
        {renderStatusBadge()}
      </View>

      <Typography variant="body" color={theme.colors.textSecondary} style={styles.description}>
        Connect your WhatsApp account to allow NRYN to securely process your conversations.
      </Typography>

      {isConnected ? (
        <View>
          <Button
            label="💬 Open WhatsApp Chats"
            variant="primary"
            onPress={onOpenChatsPress || (() => {})}
            style={styles.buttonSpacing}
          />
          <Button
            label="Disconnect WhatsApp"
            variant="danger"
            onPress={onDisconnectPress || (() => {})}
          />
        </View>
      ) : (
        <Button
          label={status === 'QR_READY' ? 'Show QR Code' : status === 'DISCONNECTED' ? 'Reconnect WhatsApp' : 'Connect WhatsApp'}
          variant="primary"
          onPress={onConnectPress}
          loading={isConnecting}
        />
      )}

      <Typography variant="caption" color={theme.colors.textTertiary} align="center" style={styles.privacyMessage}>
        Your WhatsApp connection is controlled by you.
      </Typography>
    </Card>
  );
};

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md
  },
  description: {
    marginBottom: theme.spacing.lg
  },
  buttonSpacing: {
    marginBottom: theme.spacing.sm
  },
  privacyMessage: {
    marginTop: theme.spacing.md
  }
});
