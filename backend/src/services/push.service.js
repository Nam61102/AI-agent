const { Expo } = require('expo-server-sdk');
const pool = require('../config/supabase');

// Create a new Expo SDK client
const expo = new Expo();

class PushService {
  async sendPushNotification(accountJid, title, body, data = {}) {
    try {
      // Get all tokens for this account
      const { rows } = await pool.query(
        'SELECT token FROM push_tokens WHERE account_jid = $1 OR account_jid = $2',
        [accountJid, 'default_user']
      );

      if (!rows || rows.length === 0) {
        console.log('[Push] No push tokens found for account:', accountJid);
        return { success: false, reason: 'No push tokens found' };
      }

      const messages = [];
      for (const row of rows) {
        const pushToken = row.token;
        if (!Expo.isExpoPushToken(pushToken)) {
          console.error(`[Push] Token ${pushToken} is not a valid Expo push token`);
          continue;
        }

        messages.push({
          to: pushToken,
          sound: 'default',
          title: title,
          body: body,
          data: data,
        });
      }

      const chunks = expo.chunkPushNotifications(messages);
      const tickets = [];

      for (const chunk of chunks) {
        try {
          const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
          tickets.push(...ticketChunk);
        } catch (error) {
          console.error('[Push] Error sending push chunk:', error);
        }
      }

      return { success: true, tickets };
    } catch (error) {
      console.error('[Push] Error in PushService:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new PushService();