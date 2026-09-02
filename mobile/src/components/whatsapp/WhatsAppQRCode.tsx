import React from 'react';
import { View, StyleSheet, Image, Text } from 'react-native';

interface WhatsAppQRCodeProps {
  qrValue: string | null;
  size?: number;
}

export const WhatsAppQRCode: React.FC<WhatsAppQRCodeProps> = ({
  qrValue,
  size = 260
}) => {
  if (!qrValue) {
    return (
      <View style={[styles.placeholderContainer, { width: size, height: size }]}>
        <Text style={styles.placeholderText}>Generating QR Code...</Text>
      </View>
    );
  }

  const imageSourceUri = qrValue.startsWith('data:image')
    ? qrValue
    : `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=10&data=${encodeURIComponent(
        qrValue
      )}`;

  return (
    <View style={styles.container}>
      <Image
        key={qrValue}
        source={{ uri: imageSourceUri }}
        style={{ width: size, height: size, borderRadius: 12 }}
        resizeMode="contain"
        accessibilityLabel="WhatsApp Connection QR Code"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#FFFFFF'
  },
  placeholderContainer: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#334155',
    borderStyle: 'dashed'
  },
  placeholderText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600'
  }
});
