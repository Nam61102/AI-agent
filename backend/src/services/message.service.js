const supabase = require('../config/supabase');

/**
 * Save a normalized WhatsApp message to Supabase database.
 * Ignores duplicate messages based on whatsapp_message_id constraint.
 * 
 * @param {Object} msg Data object containing normalized message fields
 * @returns {Promise<Object|null>} Saved message record or null if duplicate/ignored
 */
async function saveMessage(msg) {
  const {
    contact_id,
    chat_jid,
    sender_jid,
    from_me,
    timestamp,
    text,
    message_type,
    has_media,
    whatsapp_message_id
  } = msg;

  const query = `
    INSERT INTO messages (
      contact_id,
      chat_jid,
      sender_jid,
      from_me,
      timestamp,
      text,
      message_type,
      has_media,
      whatsapp_message_id,
      created_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
    ON CONFLICT (whatsapp_message_id) DO NOTHING
    RETURNING *;
  `;

  const values = [
    contact_id,
    chat_jid,
    sender_jid,
    from_me,
    timestamp,
    text || '',
    message_type || 'text',
    Boolean(has_media),
    whatsapp_message_id
  ];

  try {
    const result = await supabase.query(query, values);
    if (result.rows.length === 0) {
      console.log(`[MessageService] Duplicate message ignored: ${whatsapp_message_id}`);
      return null;
    }
    console.log(`[MessageService] Message saved successfully. DB ID: ${result.rows[0].id}, WA ID: ${whatsapp_message_id}`);
    return result.rows[0];
  } catch (error) {
    if (error.code === '23505') {
      console.log(`[MessageService] Duplicate message key error (ignored): ${whatsapp_message_id}`);
      return null;
    }
    console.error('[MessageService] Failed to save message:', error.message);
    throw error;
  }
}

/**
 * Fetch all active chats ordered with Priority on Top (Filtered for last 12 hours)
 */
const { formatPhoneNumber, getCanonicalJid } = require('../whatsapp/whatsapp.utils');

async function getChats() {
  const query = `
    SELECT 
      m.chat_jid AS jid,
      c.name AS db_name,
      (m.chat_jid LIKE '%@g.us') AS is_group,
      m.text AS last_message_text,
      m.timestamp AS last_message_timestamp,
      (NOT m.from_me) AS needs_reply
    FROM (
      SELECT DISTINCT ON (chat_jid) chat_jid, text, timestamp, from_me
      FROM messages
      WHERE chat_jid NOT LIKE '%@newsletter'
        AND timestamp >= NOW() - INTERVAL '12 hours'
      ORDER BY chat_jid, timestamp DESC
    ) m
    LEFT JOIN contacts c ON m.chat_jid = c.jid
    ORDER BY 
      m.timestamp DESC;
  `;
  try {
    const result = await supabase.query(query);
    // Format fallback names properly
    return result.rows.map(row => {
      let finalName = row.db_name;
      if (!finalName) {
         const rawId = row.jid.split('@')[0];
         finalName = row.is_group ? 'Group' : formatPhoneNumber(rawId);
      }
      return { ...row, name: finalName };
    });
  } catch (error) {
    console.error('[MessageService] Failed to fetch chats:', error.message);
    return [];
  }
}

async function getChatMessages(jid, hours = 6) {
  const canonicalJid = getCanonicalJid(jid);
  const query = `
    SELECT 
      id, chat_jid, sender_jid, from_me, text, timestamp, message_type
    FROM messages
    WHERE chat_jid = $1
      AND text IS NOT NULL
      AND TRIM(text) != ''
      AND timestamp >= NOW() - INTERVAL '${hours} hours'
    ORDER BY timestamp ASC;
  `;
  try {
    const result = await supabase.query(query, [canonicalJid]);
    return result.rows;
  } catch (error) {
    console.error('[MessageService] Failed to fetch chat messages:', error.message);
    throw error;
  }
}

async function getRecentThreadHistory(chatJid, limit = 8, beforeMessageId = null) {
  const canonicalJid = getCanonicalJid(chatJid);
  let query = `
    SELECT 
      m.id, m.chat_jid, m.sender_jid, m.from_me, m.text, m.timestamp,
      c.name AS sender_name
    FROM (
      SELECT * FROM messages
      WHERE chat_jid = $1
        AND text IS NOT NULL
        AND TRIM(text) != ''
        ${beforeMessageId ? 'AND id < $3' : ''}
      ORDER BY timestamp DESC
      LIMIT $2
    ) m
    LEFT JOIN contacts c ON m.sender_jid = c.jid
    ORDER BY m.timestamp ASC;
  `;

  try {
    const params = beforeMessageId ? [canonicalJid, limit, beforeMessageId] : [canonicalJid, limit];
    const result = await supabase.query(query, params);
    return result.rows.map(row => ({
      id: row.id,
      from_me: Boolean(row.from_me),
      sender: row.from_me ? 'You' : (row.sender_name || formatPhoneNumber(row.sender_jid.split('@')[0])),
      text: row.text,
      timestamp: row.timestamp
    }));
  } catch (error) {
    console.error('[MessageService] Failed to fetch thread history:', error.message);
    return [];
  }
}

module.exports = {
  saveMessage,
  getChats,
  getChatMessages,
  getRecentThreadHistory
};
