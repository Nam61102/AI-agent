const path = require('path');
const fs = require('fs');
const { useMultiFileAuthState } = require('@whiskeysockets/baileys');

const BASE_AUTH_DIR = path.join(__dirname, '../../.data/whatsapp-auth');

function getAuthDir(sessionId = 'default') {
  const sanitized = String(sessionId).replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(BASE_AUTH_DIR, `session_${sanitized}`);
}

function getOwnerFile(sessionId = 'default') {
  const sanitized = String(sessionId).replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(BASE_AUTH_DIR, `session_${sanitized}_owner.json`);
}

async function getAuthState(sessionId = 'default') {
  const dir = getAuthDir(sessionId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return await useMultiFileAuthState(dir);
}

function saveSessionOwner(sessionId = 'default', jid) {
  try {
    const ownerFile = getOwnerFile(sessionId);
    fs.mkdirSync(path.dirname(ownerFile), { recursive: true });
    fs.writeFileSync(ownerFile, JSON.stringify({ owner: jid, updatedAt: new Date().toISOString() }));
  } catch (err) {
    console.error(`Failed to save session owner for [${sessionId}]:`, err.message);
  }
}

function getSessionOwner(sessionId = 'default') {
  try {
    const ownerFile = getOwnerFile(sessionId);
    if (!fs.existsSync(ownerFile)) {
      // Check legacy single-tenant owner file for backward compatibility if default
      if (sessionId === 'default') {
        const legacyFile = path.join(__dirname, '../../.data/session_owner.json');
        if (fs.existsSync(legacyFile)) {
          const data = JSON.parse(fs.readFileSync(legacyFile, 'utf-8'));
          return data.owner || null;
        }
      }
      return null;
    }
    const data = JSON.parse(fs.readFileSync(ownerFile, 'utf-8'));
    return data.owner || null;
  } catch (err) {
    return null;
  }
}

function clearSession(sessionId = 'default') {
  try {
    const dir = getAuthDir(sessionId);
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
      fs.mkdirSync(dir, { recursive: true });
      console.log(`WhatsApp local session for [${sessionId}] cleared`);
    }
    const ownerFile = getOwnerFile(sessionId);
    if (fs.existsSync(ownerFile)) {
      fs.rmSync(ownerFile, { force: true });
    }
  } catch (error) {
    console.error(`Failed to clear WhatsApp session directory for [${sessionId}]:`, error.message);
  }
}

function sessionExists(sessionId = 'default') {
  const dir = getAuthDir(sessionId);
  if (!fs.existsSync(dir)) {
    // Check legacy default directory if default
    if (sessionId === 'default' && fs.existsSync(BASE_AUTH_DIR)) {
      const creds = path.join(BASE_AUTH_DIR, 'creds.json');
      if (fs.existsSync(creds)) return true;
    }
    return false;
  }
  const files = fs.readdirSync(dir);
  return files.length > 0;
}

module.exports = {
  BASE_AUTH_DIR,
  getAuthDir,
  getAuthState,
  clearSession,
  sessionExists,
  saveSessionOwner,
  getSessionOwner
};
