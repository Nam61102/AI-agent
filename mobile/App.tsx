import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { HomeScreen } from './src/screens/HomeScreen';
import { WhatsAppConnectionScreen } from './src/screens/whatsapp/WhatsAppConnectionScreen';
import { WhatsAppQRScreen } from './src/screens/whatsapp/WhatsAppQRScreen';

type ScreenName = 'HOME_SCREEN' | 'CONNECTION_SCREEN' | 'QR_SCREEN';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenName>('HOME_SCREEN');

  return (
    <View style={styles.container}>
      {currentScreen === 'HOME_SCREEN' ? (
        <HomeScreen
          onConnect={() => setCurrentScreen('CONNECTION_SCREEN')}
          onPeople={() => console.log('People dashboard selected')}
          onActions={() => console.log('Actions dashboard selected')}
        />
      ) : currentScreen === 'CONNECTION_SCREEN' ? (
        <WhatsAppConnectionScreen
          onNavigateToQR={() => setCurrentScreen('QR_SCREEN')}
          onBackPress={() => setCurrentScreen('HOME_SCREEN')}
        />
      ) : (
        <WhatsAppQRScreen
          onBackPress={() => setCurrentScreen('HOME_SCREEN')}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A'
  }
});
