import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { theme } from './src/theme';
import { SplashScreen } from './src/screens/SplashScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { WhatsAppConnectionScreen } from './src/screens/whatsapp/WhatsAppConnectionScreen';
import { WhatsAppQRScreen } from './src/screens/whatsapp/WhatsAppQRScreen';
import { WhatsAppChatListScreen } from './src/screens/whatsapp/WhatsAppChatListScreen';
import { ExtractionsScreen } from './src/screens/extractions/ExtractionsScreen';
import { PeopleScreen } from './src/screens/PeopleScreen';

type ScreenName = 'HOME_SCREEN' | 'CONNECTION_SCREEN' | 'QR_SCREEN' | 'CHAT_SCREEN' | 'EXTRACTIONS_SCREEN' | 'PEOPLE_SCREEN';

export default function App() {
  const [showSplash, setShowSplash] = useState<boolean>(true);
  const [currentScreen, setCurrentScreen] = useState<ScreenName>('HOME_SCREEN');
  const [targetChatJid, setTargetChatJid] = useState<string | undefined>(undefined);
  const [highlightText, setHighlightText] = useState<string | undefined>(undefined);

  const handleOpenChat = (jid?: string, messageText?: string) => {
    setTargetChatJid(jid);
    setHighlightText(messageText);
    setCurrentScreen('CHAT_SCREEN');
  };

  return (
    <View style={styles.container}>
      {showSplash ? (
        <SplashScreen onFinish={() => setShowSplash(false)} />
      ) : currentScreen === 'HOME_SCREEN' ? (
        <HomeScreen
          onConnect={() => setCurrentScreen('CONNECTION_SCREEN')}
          onOpenChat={handleOpenChat}
          onActions={() => setCurrentScreen('EXTRACTIONS_SCREEN')}
          onNavigatePeople={() => setCurrentScreen('PEOPLE_SCREEN')}
        />
      ) : currentScreen === 'CONNECTION_SCREEN' ? (
        <WhatsAppConnectionScreen
          onNavigateToQR={() => setCurrentScreen('QR_SCREEN')}
          onNavigateToChats={() => setCurrentScreen('CHAT_SCREEN')}
          onNavigateToExtractions={() => setCurrentScreen('EXTRACTIONS_SCREEN')}
          onNavigateHome={() => setCurrentScreen('HOME_SCREEN')}
          onBackPress={() => setCurrentScreen('HOME_SCREEN')}
        />
      ) : currentScreen === 'QR_SCREEN' ? (
        <WhatsAppQRScreen
          onBackPress={() => setCurrentScreen('CONNECTION_SCREEN')}
        />
      ) : currentScreen === 'CHAT_SCREEN' ? (
        <WhatsAppChatListScreen
          initialChatJid={targetChatJid}
          highlightMessageText={highlightText}
          onBackPress={() => {
            setTargetChatJid(undefined);
            setHighlightText(undefined);
            setCurrentScreen('HOME_SCREEN');
          }}
        />
      ) : currentScreen === 'EXTRACTIONS_SCREEN' ? (
        <ExtractionsScreen 
          onBackPress={() => setCurrentScreen('HOME_SCREEN')}
          onNavigateHome={() => setCurrentScreen('HOME_SCREEN')}
          onNavigateSettings={() => setCurrentScreen('CONNECTION_SCREEN')}
          onOpenChat={handleOpenChat}
        />
      ) : (
        <PeopleScreen onBackPress={() => setCurrentScreen('HOME_SCREEN')} />
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
