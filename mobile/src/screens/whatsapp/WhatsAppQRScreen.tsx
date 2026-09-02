import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView
} from 'react-native';
import { useWhatsApp } from '../../hooks/useWhatsApp';
import { WhatsAppConnectionState } from '../../components/whatsapp/WhatsAppConnectionState';

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
        <Text style={styles.headerTitle}>Connect WhatsApp</Text>
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

        <Text style={styles.securityNote}>
          NRYN will only use this connection for the features you enable.
        </Text>
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
    padding: 20,
    alignItems: 'center'
  },
  securityNote: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 24,
    marginHorizontal: 20
  }
});
