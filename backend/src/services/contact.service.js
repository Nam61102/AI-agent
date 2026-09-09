const supabase = require('../config/supabase');
const { formatPhoneNumber } = require('../whatsapp/whatsapp.utils');

/**
 * Find contact by WhatsApp JID and account_jid
 * @param {string} jid
 * @param {string} [accountJid]
 */
async function findContactByJid(jid, accountJid) {
  if (!accountJid || !jid) return null;
  const result = await supabase.query(
    'SELECT * FROM contacts WHERE jid = $1 AND account_jid = $2 LIMIT 1',
    [jid, accountJid]
  );
  return result.rows[0] || null;
}

/**
 * Create a new contact scoped to account_jid
 * @param {Object} param0
 * @param {string} param0.jid
 * @param {string} param0.name
 * @param {string} [param0.accountJid]
 */
async function createContact({ jid, name, accountJid }) {
  if (!accountJid) return null;
  const isGroup = jid.endsWith('@g.us');
  const formattedName = name || (isGroup ? 'Group' : formatPhoneNumber(jid.split('@')[0]));
  const result = await supabase.query(
    `INSERT INTO contacts (jid, name, account_jid, layer, city, muted, excluded, vip, created_at, updated_at)
     VALUES ($1, $2, $3, null, null, false, false, false, NOW(), NOW())
     ON CONFLICT (account_jid, jid) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW()
     RETURNING *`,
    [jid, formattedName, accountJid]
  );
  return result.rows[0];
}

/**
 * Find or create contact by JID, scoped to account_jid
 * @param {Object} param0
 * @param {string} param0.jid
 * @param {string} param0.name
 * @param {string} [param0.accountJid]
 */
async function findOrCreateContact({ jid, name, accountJid }) {
  if (!accountJid) return null;
  const existing = await findContactByJid(jid, accountJid);
  const isGroup = jid.endsWith('@g.us');
  const defaultFormatted = isGroup ? 'Group' : formatPhoneNumber(jid.split('@')[0]);
  
  if (existing) {
    if (name && existing.name !== name && (!existing.name || existing.name === jid.split('@')[0] || existing.name === defaultFormatted)) {
      await supabase.query('UPDATE contacts SET name = $1, updated_at = NOW() WHERE id = $2 AND account_jid = $3', [name, existing.id, accountJid]);
      existing.name = name;
    }
    return existing;
  }
  return await createContact({ jid, name, accountJid });
}

/**
 * Fetch all contacts for account_jid
 * @param {string} [accountJid]
 */
async function getAllContacts(accountJid) {
  try {
    if (!accountJid) return [];
    const result = await supabase.query(
      `SELECT jid, name FROM contacts 
       WHERE account_jid = $1 
         AND name IS NOT NULL 
         AND TRIM(name) != ''
         AND name !~ '^[0-9+ ()-]+$'
         AND name NOT LIKE '%@%'
         AND name != 'Group'
         AND name != 'Unknown'`,
      [accountJid]
    );
    return result.rows;
  } catch (err) {
    console.error('Error fetching contacts:', err);
    return [];
  }
}

module.exports = {
  findContactByJid,
  createContact,
  findOrCreateContact,
  getAllContacts
};
