const supabase = require('../config/supabase');
const { formatPhoneNumber } = require('../whatsapp/whatsapp.utils');

/**
 * Find contact by WhatsApp JID
 * @param {string} jid
 */
async function findContactByJid(jid) {
  const result = await supabase.query(
    'SELECT * FROM contacts WHERE jid = $1 LIMIT 1',
    [jid]
  );
  return result.rows[0] || null;
}

/**
 * Create a new contact
 * @param {Object} param0
 * @param {string} param0.jid
 * @param {string} param0.name
 */
async function createContact({ jid, name }) {
  const isGroup = jid.endsWith('@g.us');
  const formattedName = name || (isGroup ? 'Group' : formatPhoneNumber(jid.split('@')[0]));
  const result = await supabase.query(
    `INSERT INTO contacts (jid, name, layer, city, muted, excluded, vip, created_at, updated_at)
     VALUES ($1, $2, null, null, false, false, false, NOW(), NOW())
     RETURNING *`,
    [jid, formattedName]
  );
  return result.rows[0];
}

/**
 * Find or create contact by JID, and update the name if necessary
 * @param {Object} param0
 * @param {string} param0.jid
 * @param {string} param0.name
 */
async function findOrCreateContact({ jid, name }) {
  const existing = await findContactByJid(jid);
  const isGroup = jid.endsWith('@g.us');
  const defaultFormatted = isGroup ? 'Group' : formatPhoneNumber(jid.split('@')[0]);
  
  if (existing) {
    // If we have a valid new name and it's different from the existing one, update it.
    // Also update if the existing name was just the phone number (or missing) and we now have a real name.
    if (name && existing.name !== name && (existing.name === jid.split('@')[0] || existing.name === defaultFormatted)) {
      await supabase.query('UPDATE contacts SET name = $1, updated_at = NOW() WHERE jid = $2', [name, jid]);
      existing.name = name;
    }
    return existing;
  }
  try {
    return await createContact({ jid, name });
  } catch (error) {
    // In case of race condition on unique jid constraint
    if (error.code === '23505') {
      const retry = await findContactByJid(jid);
      if (retry) return retry;
    }
    throw error;
  }
}

/**
 * Fetch all contacts
 */
async function getAllContacts() {
  try {
    const result = await supabase.query('SELECT jid, name FROM contacts WHERE name IS NOT NULL');
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
