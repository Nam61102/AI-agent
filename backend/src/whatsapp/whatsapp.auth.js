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

const OWNER_FILE = path.join(__dirname, '../../.data/session_owner.json');

function saveSessionOwner(jid) {
  try {
    fs.mkdirSync(path.dirname(OWNER_FILE), { recursive: true });
    fs.writeFileSync(OWNER_FILE, JSON.stringify({ owner: jid, updatedAt: new Date().toISOString() }));
  } catch (err) {
    console.error('Failed to save session owner:', err.message);
  }
}

function getSessionOwner() {
  try {
    if (!fs.existsSync(OWNER_FILE)) return null;
    const data = JSON.parse(fs.readFileSync(OWNER_FILE, 'utf-8'));
    return data.owner || null;
  } catch (err) {
    return null;
  }
}

function clearSession() {
  try {
    if (fs.existsSync(AUTH_DIR)) {
      fs.rmSync(AUTH_DIR, { recursive: true, force: true });
      fs.mkdirSync(AUTH_DIR, { recursive: true });
      console.log('WhatsApp local session cleared');
    }
    if (fs.existsSync(OWNER_FILE)) {
      fs.rmSync(OWNER_FILE, { force: true });
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
  sessionExists,
  saveSessionOwner,
  getSessionOwner
};
