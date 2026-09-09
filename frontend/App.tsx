import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { theme } from './src/theme';
import { SplashScreen } from './src/screens/SplashScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { WhatsAppConnectionScreen } from './src/screens/whatsapp/WhatsAppConnectionScreen';
import { WhatsAppQRScreen } from './src/screens/whatsapp/WhatsAppQRScreen';
import { WhatsAppChatListScreen } from './src/screens/whatsapp/WhatsAppChatListScreen';
import { ExtractionsScreen } from './src/screens/extractions/ExtractionsScreen';
import { PeopleScreen } from './src/screens/PeopleScreen';
import { useWhatsApp } from './src/hooks/useWhatsApp';

type ScreenName = 'HOME_SCREEN' | 'CONNECTION_SCREEN' | 'QR_SCREEN' | 'CHAT_SCREEN' | 'EXTRACTIONS_SCREEN' | 'PEOPLE_SCREEN';

export default function App() {
  const { isConnected, status, connect } = useWhatsApp();
  const [showSplash, setShowSplash] = useState<boolean>(true);
  const [currentScreen, setCurrentScreen] = useState<ScreenName>('HOME_SCREEN');
  const [targetChatJid, setTargetChatJid] = useState<string | undefined>(undefined);
  const [highlightText, setHighlightText] = useState<string | undefined>(undefined);

  // Attempt auto-connect check on startup
  useEffect(() => {
    connect();
  }, [connect]);

  const handleOpenChat = (jid?: string, messageText?: string) => {
    setTargetChatJid(jid);
    setHighlightText(messageText);
    setCurrentScreen('CHAT_SCREEN');
  };

  // If splash screen is playing on launch
  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  // Pure WhatsApp QR Scan Authentication Gate:
  // If this device's session is not connected, show the QR Login Screen
  if (!isConnected) {
    return (
      <View style={styles.container}>
        <WhatsAppQRScreen
          isLoginGate={true}
          onLoginSuccess={() => setCurrentScreen('HOME_SCREEN')}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {currentScreen === 'HOME_SCREEN' ? (
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
          onNavigatePeople={() => setCurrentScreen('PEOPLE_SCREEN')}
          onNavigateHome={() => setCurrentScreen('HOME_SCREEN')}
          onBackPress={() => setCurrentScreen('HOME_SCREEN')}
        />
      ) : currentScreen === 'QR_SCREEN' ? (
        <WhatsAppQRScreen
          onBackPress={() => setCurrentScreen('CONNECTION_SCREEN')}
          onLoginSuccess={() => setCurrentScreen('HOME_SCREEN')}
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
          onNavigatePeople={() => setCurrentScreen('PEOPLE_SCREEN')}
          onNavigateSettings={() => setCurrentScreen('CONNECTION_SCREEN')}
          onOpenChat={handleOpenChat}
        />
      ) : (
        <PeopleScreen 
          onBackPress={() => setCurrentScreen('HOME_SCREEN')}
          onNavigateHome={() => setCurrentScreen('HOME_SCREEN')}
          onNavigatePeople={() => setCurrentScreen('PEOPLE_SCREEN')}
          onNavigateExtractions={() => setCurrentScreen('EXTRACTIONS_SCREEN')}
          onNavigateConnection={() => setCurrentScreen('CONNECTION_SCREEN')}
          onOpenChat={handleOpenChat}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EDF2F7'
  }
});
