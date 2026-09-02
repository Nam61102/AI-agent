import React, { useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView
} from 'react-native';
import { useWhatsApp } from '../../hooks/useWhatsApp';
import { WhatsAppConnectionState } from '../../components/whatsapp/WhatsAppConnectionState';
import { Typography } from '../../components/ui/Typography';
import { theme } from '../../theme';

interface WhatsAppQRScreenProps {
  onBackPress: () => void;
}

export const WhatsAppQRScreen: React.FC<WhatsAppQRScreenProps> = ({
  onBackPress
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
        onBackPress();
      }, 1800);
      return () => clearTimeout(timer);
    }
  }, [status, onBackPress]);
  
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
        <Typography variant="h3">Connect WhatsApp</Typography>
        <View style={styles.headerRightPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <WhatsAppConnectionState
          status={status}
          qrValue={qrValue}
          pairingCode={pairingCode}
          errorMessage={errorMessage}
          onCancel={onBackPress}
          onRetry={retry}
          onRequestPairingCode={requestPairingCode}
          onSimulateScan={simulateScan}
          isMockMode={isMockMode}
        />

        <Typography variant="small" color={theme.colors.textTertiary} align="center" style={styles.securityNote}>
          NRYN will only use this connection for the features you enable.
        </Typography>
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
    padding: theme.spacing.lg,
    alignItems: 'center'
  },
  securityNote: {
    marginTop: theme.spacing.xl,
    marginHorizontal: theme.spacing.lg
  }
});
