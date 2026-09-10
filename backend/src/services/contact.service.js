const supabase = require('../config/supabase');
const { formatPhoneNumber } = require('../whatsapp/whatsapp.utils');

/**
 * Find contact by WhatsApp JID and account_jid
 * @param {string} jid
 * @param {string} [accountJid]
 */
async function findContactByJid(jid, accountJid) {
  if (accountJid) {
    const result = await supabase.query(
      'SELECT * FROM contacts WHERE jid = $1 AND account_jid = $2 LIMIT 1',
      [jid, accountJid]
    );
    return result.rows[0] || null;
  }
  const result = await supabase.query(
    'SELECT * FROM contacts WHERE jid = $1 LIMIT 1',
    [jid]
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
  const isGroup = jid.endsWith('@g.us');
  const formattedName = name || (isGroup ? 'Group' : formatPhoneNumber(jid.split('@')[0]));
  const result = await supabase.query(
    `INSERT INTO contacts (jid, name, account_jid, layer, city, muted, excluded, vip, created_at, updated_at)
     VALUES ($1, $2, $3, null, null, false, false, false, NOW(), NOW())
     ON CONFLICT (account_jid, jid) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW()
     RETURNING *`,
    [jid, formattedName, accountJid || 'default_user']
  );
  return result.rows[0];
}

function isPhoneNumberOrDefault(nameStr, jid) {
  if (!nameStr || !nameStr.trim()) return true;
  const trimmed = nameStr.trim();
  if (trimmed === 'Unknown' || trimmed === 'Group') return true;
  if (/^[0-9+\s()-]+$/.test(trimmed)) return true;
  if (jid) {
    const rawNum = jid.split('@')[0];
    if (trimmed.includes(rawNum)) return true;
  }
  return false;
}

/**
 * Find or create contact by JID, scoped to account_jid
 * @param {Object} param0
 * @param {string} param0.jid
 * @param {string} param0.name
 * @param {string} [param0.accountJid]
 */
async function findOrCreateContact({ jid, name, accountJid, isAddressBook = false }) {
  const existing = await findContactByJid(jid, accountJid);
  
  if (existing) {
    if (name && name.trim() !== '' && existing.name !== name.trim()) {
      const currentNameIsPhoneOrDefault = isPhoneNumberOrDefault(existing.name, jid);

      // Only update name if current name is a phone number/default, OR if update is explicitly from mobile address book sync
      if (currentNameIsPhoneOrDefault || isAddressBook) {
        await supabase.query('UPDATE contacts SET name = $1, updated_at = NOW() WHERE id = $2', [name.trim(), existing.id]);
        existing.name = name.trim();
      }
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
    if (accountJid) {
      const result = await supabase.query(
        `SELECT jid, name FROM contacts 
         WHERE account_jid = $1 
           AND name IS NOT NULL 
           AND TRIM(name) != ''
           AND name != 'Group'
           AND name != 'Unknown'`,
        [accountJid]
      );
      return result.rows;
    }
    const result = await supabase.query(
      `SELECT jid, name FROM contacts 
       WHERE name IS NOT NULL 
         AND TRIM(name) != ''
         AND name != 'Group'
         AND name != 'Unknown'`
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
