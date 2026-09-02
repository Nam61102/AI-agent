import React from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Switch
} from 'react-native';
import { useWhatsApp } from '../../hooks/useWhatsApp';
import { WhatsAppStatusCard } from '../../components/whatsapp/WhatsAppStatusCard';
import { Card } from '../../components/ui/Card';
import { Typography } from '../../components/ui/Typography';
import { theme } from '../../theme';

interface WhatsAppConnectionScreenProps {
  onNavigateToQR: () => void;
  onNavigateToChats?: () => void;
  onNavigateToExtractions?: () => void;
  onBackPress?: () => void;
}

export const WhatsAppConnectionScreen: React.FC<WhatsAppConnectionScreenProps> = ({
  onNavigateToQR,
  onNavigateToChats,
  onNavigateToExtractions,
  onBackPress
}) => {
  const {
    status,
    isConnecting,
    disconnect,
    connect,
    isMockMode,
    toggleMockMode
  } = useWhatsApp();

  const handleConnectPress = async () => {
    if (status === 'QR_READY') {
      onNavigateToQR();
      return;
    }
    const result = await connect();
    if (
      result.requiresScan ||
      result.status === 'QR_READY' ||
      result.status === 'CONNECTING' ||
      result.status === 'AUTHENTICATING'
    ) {
      onNavigateToQR();
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.background} />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBackPress}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="Back navigation"
        >
          <Typography variant="subtitle" color={theme.colors.textSecondary}>‹ Back</Typography>
        </TouchableOpacity>
        <Typography variant="h3">WhatsApp Connection</Typography>
        <View style={styles.headerRightPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* DEV MOCK MODE TOGGLE */}
        <Card variant="elevated" style={styles.mockToggleCard}>
          <View style={styles.mockToggleRow}>
            <Typography variant="subtitle">Dev Mock Mode</Typography>
            <Switch
              value={isMockMode}
              onValueChange={toggleMockMode}
              trackColor={{ false: theme.colors.textSecondary, true: theme.colors.primary }}
              thumbColor={isMockMode ? theme.colors.surface : theme.colors.textTertiary}
            />
          </View>
          <Typography variant="caption" color={theme.colors.textSecondary} style={styles.mockToggleSubtext}>
            {isMockMode
              ? 'Using standalone UI mock mode (No backend required)'
              : 'Connected to live Express / Baileys backend (127.0.0.1:3000)'}
          </Typography>
        </Card>

        {/* MAIN STATUS CARD */}
        <WhatsAppStatusCard
          status={status}
          onConnectPress={handleConnectPress}
          onDisconnectPress={disconnect}
          onOpenChatsPress={onNavigateToChats}
          isConnecting={isConnecting}
        />

        {/* AI EXTRACTIONS NAV */}
        <View style={{ marginTop: theme.spacing.lg }}>
          <Card variant="elevated" onPress={onNavigateToExtractions} style={styles.extractionCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Typography style={{ fontSize: 20, marginRight: theme.spacing.sm }}>✨</Typography>
              <View>
                <Typography variant="subtitle">AI Extractions</Typography>
                <Typography variant="caption" color={theme.colors.textSecondary} style={{ marginTop: 4 }}>
                  View tasks, events, and insights
                </Typography>
              </View>
            </View>
            <Typography variant="h3" color={theme.colors.textTertiary}>›</Typography>
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surface
  },
  backButton: {
    paddingVertical: 6,
    paddingRight: 12
  },
  headerRightPlaceholder: {
    width: 48
  },
  content: {
    padding: theme.spacing.lg
  },
  mockToggleCard: {
    marginBottom: theme.spacing.lg,
  },
  mockToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  mockToggleSubtext: {
    marginTop: 6
  },
  extractionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  }
});
