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

async function restoreSessionFromDatabase(sessionId = 'default') {
  try {
    const supabase = require('../config/supabase');
    const sId = String(sessionId).trim();
    const res = await supabase.query(
      'SELECT session_data, account_jid FROM whatsapp_sessions WHERE session_id = $1 LIMIT 1',
      [sId]
    );
    if (res.rows.length > 0 && res.rows[0].session_data) {
      const dir = getAuthDir(sessionId);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const files = res.rows[0].session_data;
      for (const [filename, content] of Object.entries(files)) {
        fs.writeFileSync(path.join(dir, filename), JSON.stringify(content, null, 2));
      }
      if (res.rows[0].account_jid) {
        saveSessionOwner(sessionId, res.rows[0].account_jid);
      }
      console.log(`[WhatsAppAuth:${sessionId}] Restored session auth state from Supabase database.`);
      return true;
    }
  } catch (err) {
    console.warn(`[WhatsAppAuth:${sessionId}] Database session restore warning:`, err.message);
  }
  return false;
}

async function syncSessionToDatabase(sessionId = 'default') {
  try {
    const supabase = require('../config/supabase');
    const dir = getAuthDir(sessionId);
    if (!fs.existsSync(dir)) return;

    const files = fs.readdirSync(dir);
    const sessionData = {};
    for (const f of files) {
      if (f.endsWith('.json')) {
        try {
          const content = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'));
          sessionData[f] = content;
        } catch (e) {}
      }
    }

    const sId = String(sessionId).trim();
    const owner = getSessionOwner(sId);

    await supabase.query(
      `INSERT INTO whatsapp_sessions (session_id, account_jid, session_data, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (session_id) DO UPDATE 
       SET account_jid = EXCLUDED.account_jid, session_data = EXCLUDED.session_data, updated_at = NOW()`,
      [sId, owner, JSON.stringify(sessionData)]
    );
  } catch (err) {
    console.warn(`[WhatsAppAuth:${sessionId}] Database session sync warning:`, err.message);
  }
}

async function getAuthState(sessionId = 'default') {
  const dir = getAuthDir(sessionId);
  if (!fs.existsSync(dir) || fs.readdirSync(dir).length === 0) {
    fs.mkdirSync(dir, { recursive: true });
    await restoreSessionFromDatabase(sessionId);
  }

  const { state, saveCreds: baseSaveCreds } = await useMultiFileAuthState(dir);

  const saveCreds = async (update) => {
    await baseSaveCreds(update);
    syncSessionToDatabase(sessionId).catch(() => {});
  };

  return { state, saveCreds };
}

function saveSessionOwner(sessionId = 'default', jid) {
  try {
    const ownerFile = getOwnerFile(sessionId);
    fs.mkdirSync(path.dirname(ownerFile), { recursive: true });
    fs.writeFileSync(ownerFile, JSON.stringify({ owner: jid, updatedAt: new Date().toISOString() }));
    syncSessionToDatabase(sessionId).catch(() => {});
  } catch (err) {
    console.error(`Failed to save session owner for [${sessionId}]:`, err.message);
  }
}

function getSessionOwner(sessionId = 'default') {
  try {
    const ownerFile = getOwnerFile(sessionId);
    if (!fs.existsSync(ownerFile)) {
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
    const supabase = require('../config/supabase');
    supabase.query('DELETE FROM whatsapp_sessions WHERE session_id = $1', [String(sessionId).trim()]).catch(() => {});
  } catch (error) {
    console.error(`Failed to clear WhatsApp session directory for [${sessionId}]:`, error.message);
  }
}

function sessionExists(sessionId = 'default') {
  const dir = getAuthDir(sessionId);
  if (!fs.existsSync(dir)) {
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
  getSessionOwner,
  restoreSessionFromDatabase,
  syncSessionToDatabase
};
