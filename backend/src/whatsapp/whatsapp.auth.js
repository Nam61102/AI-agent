const path = require('path');
const fs = require('fs');
const { useMultiFileAuthState } = require('@whiskeysockets/baileys');

const AUTH_DIR = path.join(__dirname, '../../.data/whatsapp-auth');

async function getAuthState() {
  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  }
  return await useMultiFileAuthState(AUTH_DIR);
}

function clearSession() {
  try {
    if (fs.existsSync(AUTH_DIR)) {
      fs.rmSync(AUTH_DIR, { recursive: true, force: true });
      fs.mkdirSync(AUTH_DIR, { recursive: true });
      console.log('WhatsApp local session cleared');
    }
  } catch (error) {
    console.error('Failed to clear WhatsApp session directory:', error.message);
  }
}

function sessionExists() {
  if (!fs.existsSync(AUTH_DIR)) return false;
  const files = fs.readdirSync(AUTH_DIR);
  return files.length > 0;
}

module.exports = {
  AUTH_DIR,
  getAuthState,
  clearSession,
  sessionExists
};
