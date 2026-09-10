import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { getAuthHeaders } from '../services/session.service';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL as string || 'http://localhost:3000';

let Device: any = null;
let Notifications: any = null;

if (Platform.OS !== 'web') {
  try {
    Device = require('expo-device');
    Notifications = require('expo-notifications');
    
    if (Notifications?.setNotificationHandler) {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });
    }
  } catch (e) {
    console.warn('Push notification native packages not available:', e);
  }
}

export function usePushNotifications() {
  const [expoPushToken, setExpoPushToken] = useState<string>('');
  const [notification, setNotification] = useState<any>(false);
  const notificationListener = useRef<any>();
  const responseListener = useRef<any>();

  useEffect(() => {
    if (Platform.OS === 'web' || !Notifications) return;

    registerForPushNotificationsAsync().then(token => {
      if (token) {
        setExpoPushToken(token);
        fetch(`${BACKEND_URL}/api/alerts/push-token`, {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ token })
        }).catch(err => console.error('Failed to register push token:', err));
      }
    });

    if (Notifications.addNotificationReceivedListener) {
      notificationListener.current = Notifications.addNotificationReceivedListener((notification: any) => {
        setNotification(notification);
      });
    }

    if (Notifications.addNotificationResponseReceivedListener) {
      responseListener.current = Notifications.addNotificationResponseReceivedListener((response: any) => {
        console.log('Notification Response:', response);
      });
    }

    return () => {
      if (notificationListener.current?.remove) notificationListener.current.remove();
      if (responseListener.current?.remove) responseListener.current.remove();
    };
  }, []);

  return { expoPushToken, notification };
}

async function registerForPushNotificationsAsync() {
  if (Platform.OS === 'web' || !Notifications || !Device) return;
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const existingStatus: any = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus.status || (existingStatus.granted ? 'granted' : 'denied');
    if (finalStatus !== 'granted') {
      const statusObj: any = await Notifications.requestPermissionsAsync();
      finalStatus = statusObj.status || (statusObj.granted ? 'granted' : 'denied');
    }
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return;
    }
    try {
      token = (await Notifications.getExpoPushTokenAsync({
        projectId: 'your-project-id',
      })).data;
    } catch (e) {
      console.log('Error getting push token:', e);
    }
  } else {
    console.log('Must use physical device for Push Notifications');
  }

  return token;
}