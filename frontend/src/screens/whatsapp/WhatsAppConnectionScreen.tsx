import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Switch
} from 'react-native';
import { useWhatsApp } from '../../hooks/useWhatsApp';
import { useExtractions } from '../../hooks/useExtractions';
import { WhatsAppStatusCard } from '../../components/whatsapp/WhatsAppStatusCard';
import { Card } from '../../components/ui/Card';
import { Typography } from '../../components/ui/Typography';
import { theme } from '../../theme';

interface WhatsAppConnectionScreenProps {
  onNavigateToQR: () => void;
  onNavigateToChats?: () => void;
  onNavigateToExtractions?: () => void;
  onNavigateHome?: () => void;
  onBackPress?: () => void;
}

export const WhatsAppConnectionScreen: React.FC<WhatsAppConnectionScreenProps> = ({
  onNavigateToQR,
  onNavigateToChats,
  onNavigateToExtractions,
  onNavigateHome,
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

  const { extractions } = useExtractions();

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
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBackPress || onNavigateHome}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="Back navigation"
        >
          <Text style={styles.backButtonText}>‹ Dashboard</Text>
        </TouchableOpacity>
        <Typography variant="h3" style={{ fontWeight: '800', color: '#0F172A' }}>Connection & Settings</Typography>
        <View style={styles.headerRightPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* DEV MOCK MODE TOGGLE */}
        <Card variant="elevated" style={styles.mockToggleCard}>
          <View style={styles.mockToggleRow}>
            <Typography variant="subtitle" style={{ fontWeight: '700', color: '#0F172A' }}>Dev Mock Mode</Typography>
            <Switch
              value={isMockMode}
              onValueChange={toggleMockMode}
              trackColor={{ false: '#E2E8F0', true: '#4F46E5' }}
              thumbColor={isMockMode ? '#FFFFFF' : '#94A3B8'}
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
        <View style={{ marginTop: 16 }}>
          <Card variant="elevated" onPress={onNavigateToExtractions} style={styles.extractionCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Typography style={{ fontSize: 22, marginRight: 12 }}>📌</Typography>
              <View>
                <Typography variant="subtitle" style={{ fontWeight: '700', color: '#0F172A' }}>AI Extractions Knowledge Log</Typography>
                <Typography variant="caption" color={theme.colors.textSecondary} style={{ marginTop: 2 }}>
                  View discovered tasks, meetings, and life events
                </Typography>
              </View>
            </View>
            <Typography variant="h3" color={theme.colors.textTertiary}>›</Typography>
          </Card>
        </View>
      </ScrollView>

      {/* BOTTOM NAVIGATION BAR */}
      <View style={styles.bottomNavBar}>
        <TouchableOpacity style={styles.bottomNavItem} onPress={onNavigateHome || onBackPress} activeOpacity={0.8}>
          <Text style={styles.bottomNavIcon}>⚡</Text>
          <Text style={styles.bottomNavLabel}>Dashboard</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.bottomNavItem} onPress={onNavigateToExtractions} activeOpacity={0.8}>
          <View style={{ position: 'relative' }}>
            <Text style={styles.bottomNavIcon}>📌</Text>
            {extractions.length > 0 && (
              <View style={styles.bottomNavBadge}>
                <Text style={styles.bottomNavBadgeText}>{extractions.length > 9 ? '9+' : extractions.length}</Text>
              </View>
            )}
          </View>
          <Text style={styles.bottomNavLabel}>Extractions</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.bottomNavItem} activeOpacity={0.8}>
          <Text style={[styles.bottomNavIcon, styles.bottomNavIconActive]}>⚙️</Text>
          <Text style={[styles.bottomNavLabel, styles.bottomNavLabelActive]}>Connection</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#EDF2F7'
  },
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#CBD5E1',
    backgroundColor: '#F8FAFC'
  },
  backButton: {
    paddingVertical: 6,
    paddingRight: 12
  },
  backButtonText: {
    color: '#4F46E5',
    fontSize: 13,
    fontWeight: '600'
  },
  headerRightPlaceholder: {
    width: 48
  },
  content: {
    padding: 16,
    paddingBottom: 90
  },
  mockToggleCard: {
    marginBottom: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    padding: 16
  },
  mockToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  mockToggleSubtext: {
    marginTop: 6,
    color: '#64748B'
  },
  extractionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12
  },
  bottomNavBar: {
    height: 60,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: '#CBD5E1',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center'
  },
  bottomNavItem: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 70
  },
  bottomNavIcon: {
    fontSize: 18,
    color: '#64748B'
  },
  bottomNavIconActive: {
    color: '#4F46E5'
  },
  bottomNavLabel: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '600'
  },
  bottomNavLabelActive: {
    color: '#4F46E5',
    fontWeight: '700'
  },
  bottomNavBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: '#4F46E5',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3
  },
  bottomNavBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700'
  }
});
