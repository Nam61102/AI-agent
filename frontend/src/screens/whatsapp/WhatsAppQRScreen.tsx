import React, { useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Text
} from 'react-native';
import { useWhatsApp } from '../../hooks/useWhatsApp';
import { WhatsAppConnectionState } from '../../components/whatsapp/WhatsAppConnectionState';
import { Typography } from '../../components/ui/Typography';
import { theme } from '../../theme';

interface WhatsAppQRScreenProps {
  onBackPress?: () => void;
  onLoginSuccess?: () => void;
  isLoginGate?: boolean;
}

export const WhatsAppQRScreen: React.FC<WhatsAppQRScreenProps> = ({
  onBackPress,
  onLoginSuccess,
  isLoginGate = false
}) => {
  const {
    status,
    qrValue,
    pairingCode,
    errorMessage,
    retry,
    requestPairingCode,
    simulateScan,
    isMockMode
  } = useWhatsApp();

  useEffect(() => {
    if (status === 'CONNECTED') {
      const timer = setTimeout(() => {
        if (onLoginSuccess) {
          onLoginSuccess();
        } else if (onBackPress) {
          onBackPress();
        }
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [status, onBackPress, onLoginSuccess]);
  
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      {/* HEADER */}
      <View style={styles.header}>
        {onBackPress && !isLoginGate ? (
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBackPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Back navigation"
          >
            <Text style={styles.backButtonText}>‹ Back</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.logoBadge}>
            <Text style={styles.logoBadgeText}>⚡ NRYN</Text>
          </View>
        )}
        <Typography variant="h3" style={styles.headerTitle}>
          {isLoginGate ? 'Sign In with WhatsApp' : 'Connect WhatsApp'}
        </Typography>
        <View style={styles.headerRightPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {isLoginGate && (
          <View style={styles.welcomeBanner}>
            <Typography variant="h2" style={styles.welcomeTitle}>Welcome to NRYN</Typography>
            <Typography variant="body" color={theme.colors.textSecondary} style={styles.welcomeSubtitle}>
              Link your personal WhatsApp to access your isolated intelligent assistant dashboard.
            </Typography>
          </View>
        )}

        <WhatsAppConnectionState
          status={status}
          qrValue={qrValue}
          pairingCode={pairingCode}
          errorMessage={errorMessage}
          onCancel={!isLoginGate && onBackPress ? onBackPress : undefined}
          onRetry={retry}
          onRequestPairingCode={requestPairingCode}
          onSimulateScan={simulateScan}
          isMockMode={isMockMode}
        />

        <View style={styles.securityBox}>
          <Text style={styles.securityIcon}>🔒</Text>
          <Text style={styles.securityText}>
            End-to-End Isolated Session. Your contacts and messages are private to this device and never shared across users.
          </Text>
        </View>
      </ScrollView>
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
  headerTitle: {
    fontWeight: '800',
    color: '#0F172A'
  },
  backButton: {
    paddingVertical: 6,
    paddingRight: 12
  },
  backButtonText: {
    color: '#4F46E5',
    fontSize: 14,
    fontWeight: '600'
  },
  logoBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C7D2FE'
  },
  logoBadgeText: {
    color: '#4F46E5',
    fontWeight: '800',
    fontSize: 13
  },
  headerRightPlaceholder: {
    width: 48
  },
  content: {
    padding: 16,
    alignItems: 'center'
  },
  welcomeBanner: {
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 12
  },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
    textAlign: 'center'
  },
  welcomeSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18
  },
  securityBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    padding: 12,
    marginTop: 20,
    marginHorizontal: 8
  },
  securityIcon: {
    fontSize: 18,
    marginRight: 10
  },
  securityText: {
    fontSize: 11,
    color: '#64748B',
    flex: 1,
    lineHeight: 16
  }
});
