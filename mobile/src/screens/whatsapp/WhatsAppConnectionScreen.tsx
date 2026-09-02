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
import { WhatsAppStatusCard } from '../../components/whatsapp/WhatsAppStatusCard';

interface WhatsAppConnectionScreenProps {
  onNavigateToQR: () => void;
  onBackPress?: () => void;
}

export const WhatsAppConnectionScreen: React.FC<WhatsAppConnectionScreenProps> = ({
  onNavigateToQR,
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
    onNavigateToQR();
    connect();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBackPress}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="Back navigation"
        >
          <Text style={styles.backButtonText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>WhatsApp Connection</Text>
        <View style={styles.headerRightPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* DEV MOCK MODE TOGGLE */}
        <View style={styles.mockToggleCard}>
          <View style={styles.mockToggleRow}>
            <Text style={styles.mockToggleLabel}>Dev Mock Mode</Text>
            <Switch
              value={isMockMode}
              onValueChange={toggleMockMode}
              trackColor={{ false: '#334155', true: '#2563EB' }}
              thumbColor={isMockMode ? '#FFFFFF' : '#94A3B8'}
            />
          </View>
          <Text style={styles.mockToggleSubtext}>
            {isMockMode
              ? 'Using standalone UI mock mode (No backend required)'
              : 'Connected to live Express / Baileys backend (127.0.0.1:3000)'}
          </Text>
        </View>

        {/* MAIN STATUS CARD */}
        <WhatsAppStatusCard
          status={status}
          onConnectPress={handleConnectPress}
          onDisconnectPress={disconnect}
          isConnecting={isConnecting}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F172A'
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B'
  },
  backButton: {
    paddingVertical: 6,
    paddingRight: 12
  },
  backButtonText: {
    color: '#60A5FA',
    fontSize: 16,
    fontWeight: '600'
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 17,
    fontWeight: '700'
  },
  headerRightPlaceholder: {
    width: 48
  },
  content: {
    padding: 20
  },
  mockToggleCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155'
  },
  mockToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  mockToggleLabel: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600'
  },
  mockToggleSubtext: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 4
  }
});
