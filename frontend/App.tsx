import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { theme } from './src/theme';
import { HomeScreen } from './src/screens/HomeScreen';
import { WhatsAppConnectionScreen } from './src/screens/whatsapp/WhatsAppConnectionScreen';
import { WhatsAppQRScreen } from './src/screens/whatsapp/WhatsAppQRScreen';
import { WhatsAppChatListScreen } from './src/screens/whatsapp/WhatsAppChatListScreen';
import { ExtractionsScreen } from './src/screens/extractions/ExtractionsScreen';

type ScreenName = 'HOME_SCREEN' | 'CONNECTION_SCREEN' | 'QR_SCREEN' | 'CHAT_SCREEN' | 'EXTRACTIONS_SCREEN';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenName>('HOME_SCREEN');

  return (
    <View style={styles.container}>
      {currentScreen === 'HOME_SCREEN' ? (
        <HomeScreen
          onConnect={() => setCurrentScreen('CONNECTION_SCREEN')}
          onPeople={() => setCurrentScreen('CHAT_SCREEN')}
          onActions={() => setCurrentScreen('EXTRACTIONS_SCREEN')}
        />
      ) : currentScreen === 'CONNECTION_SCREEN' ? (
        <WhatsAppConnectionScreen
          onNavigateToQR={() => setCurrentScreen('QR_SCREEN')}
          onNavigateToChats={() => setCurrentScreen('CHAT_SCREEN')}
          onNavigateToExtractions={() => setCurrentScreen('EXTRACTIONS_SCREEN')}
          onBackPress={() => setCurrentScreen('HOME_SCREEN')}
        />
      ) : currentScreen === 'QR_SCREEN' ? (
        <WhatsAppQRScreen
          onBackPress={() => setCurrentScreen('HOME_SCREEN')}
        />
      ) : currentScreen === 'CHAT_SCREEN' ? (
        <WhatsAppChatListScreen
          onBackPress={() => setCurrentScreen('HOME_SCREEN')}
        />
      ) : (
        <ExtractionsScreen 
          onBackPress={() => setCurrentScreen('HOME_SCREEN')}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background
  }
});
