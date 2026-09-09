const supabase = require('../config/supabase');
const { formatPhoneNumber, getCanonicalJid } = require('../whatsapp/whatsapp.utils');

/**
 * Save a normalized WhatsApp message to database.
 * Ignores duplicate messages based on (account_jid, whatsapp_message_id) constraint.
 * 
 * @param {Object} msg Data object containing normalized message fields
 * @returns {Promise<Object|null>} Saved message record or null if duplicate/ignored
 */
async function saveMessage(msg) {
  const {
    account_jid,
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

  const resolvedAccountJid = account_jid || 'default_user';

  const query = `
    INSERT INTO messages (
      account_jid,
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
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
    ON CONFLICT (account_jid, whatsapp_message_id) DO NOTHING
    RETURNING *;
  `;

  const values = [
    resolvedAccountJid,
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
      return null;
    }
    return result.rows[0];
  } catch (error) {
    if (error.code === '23505') {
      return null;
    }
    console.error('[MessageService] Failed to save message:', error.message);
    throw error;
  }
}

/**
 * Fetch active chats for account_jid ordered by timestamp DESC
 */
async function getChats(accountJid, limitHours = 24) {
  if (!accountJid) return [];

  const params = [accountJid];
  let timeFilter = '';
  if (limitHours && parseInt(limitHours, 10) > 0) {
    timeFilter = `AND timestamp >= NOW() - INTERVAL '${parseInt(limitHours, 10)} hours'`;
  }

  const query = `
    SELECT 
      m.chat_jid AS jid,
      c.name AS db_name,
      (m.chat_jid LIKE '%@g.us') AS is_group,
      m.text AS last_message_text,
      m.timestamp AS last_message_timestamp,
      (NOT m.from_me) AS needs_reply
    FROM (
      SELECT DISTINCT ON (chat_jid) chat_jid, text, timestamp, from_me, account_jid
      FROM messages
      WHERE chat_jid NOT LIKE '%@newsletter'
        AND chat_jid NOT LIKE '%@lid'
        AND account_jid = $1
        ${timeFilter}
      ORDER BY chat_jid, timestamp DESC
    ) m
    LEFT JOIN contacts c ON m.chat_jid = c.jid AND m.account_jid = c.account_jid
    ORDER BY 
      m.timestamp DESC;
  `;

  try {
    let result = await supabase.query(query, params);
    
    // If no chats in specific hours window and timeFilter was applied, fallback to latest chats
    if (result.rows.length === 0 && timeFilter) {
      const fallbackQuery = `
        SELECT 
          m.chat_jid AS jid,
          c.name AS db_name,
          (m.chat_jid LIKE '%@g.us') AS is_group,
          m.text AS last_message_text,
          m.timestamp AS last_message_timestamp,
          (NOT m.from_me) AS needs_reply
        FROM (
          SELECT DISTINCT ON (chat_jid) chat_jid, text, timestamp, from_me, account_jid
          FROM messages
          WHERE chat_jid NOT LIKE '%@newsletter'
            AND chat_jid NOT LIKE '%@lid'
            AND account_jid = $1
          ORDER BY chat_jid, timestamp DESC
          LIMIT 50
        ) m
        LEFT JOIN contacts c ON m.chat_jid = c.jid AND m.account_jid = c.account_jid
        ORDER BY 
          m.timestamp DESC;
      `;
      result = await supabase.query(fallbackQuery, params);
    }

    return result.rows.map(row => {
      let finalName = row.db_name;
      const canonical = getCanonicalJid(row.jid);
      const isGroup = canonical.endsWith('@g.us');
      const rawNum = canonical.split('@')[0];

      if (!finalName || /^\d+$/.test(finalName) || finalName.includes('@')) {
        if (isGroup) {
          finalName = finalName || 'Group';
        } else {
          finalName = formatPhoneNumber(rawNum);
        }
      }

      return {
        jid: row.jid,
        name: finalName,
        is_group: row.is_group,
        last_message_text: row.last_message_text || '',
        last_message_timestamp: row.last_message_timestamp,
        needs_reply: row.needs_reply
      };
    });
  } catch (error) {
    console.error('[MessageService] Error fetching chats:', error.message);
    return [];
  }
}

/**
 * Get recent messages for a specific chat, scoped strictly to account_jid.
 * Supports limit and optional hours filter (default: last 6 hours or up to limit messages).
 */
async function getChatMessages(chatJid, limit = 50, accountJid, hours = null) {
  if (!accountJid || !chatJid) return [];

  const canonicalJid = getCanonicalJid(chatJid);
  const params = [canonicalJid, accountJid, limit];

  let timeFilter = '';
  if (hours && parseInt(hours, 10) > 0) {
    timeFilter = `AND timestamp >= NOW() - INTERVAL '${parseInt(hours, 10)} hours'`;
  }

  const query = `
    SELECT 
      id,
      chat_jid,
      sender_jid,
      from_me,
      text,
      message_type,
      has_media,
      timestamp,
      whatsapp_message_id
    FROM messages
    WHERE chat_jid = $1
      AND account_jid = $2
      ${timeFilter}
    ORDER BY timestamp DESC
    LIMIT $3;
  `;

  try {
    let result = await supabase.query(query, params);

    // If hours filter was applied and returned 0 messages, fetch the latest messages up to limit
    if (result.rows.length === 0 && timeFilter) {
      const fallbackQuery = `
        SELECT 
          id,
          chat_jid,
          sender_jid,
          from_me,
          text,
          message_type,
          has_media,
          timestamp,
          whatsapp_message_id
        FROM messages
        WHERE chat_jid = $1
          AND account_jid = $2
        ORDER BY timestamp DESC
        LIMIT $3;
      `;
      result = await supabase.query(fallbackQuery, params);
    }

    return result.rows.reverse();
  } catch (error) {
    console.error('[MessageService] Error fetching chat messages:', error.message);
    return [];
  }
}

/**
 * Get recent messages thread history for AI context
 */
async function getRecentThreadHistory(chatJid, limit = 10, beforeMessageId = null, accountJid) {
  if (!accountJid || !chatJid) return [];

  const canonicalJid = getCanonicalJid(chatJid);
  const params = [canonicalJid, accountJid];
  let beforeFilter = '';
  if (beforeMessageId) {
    params.push(beforeMessageId);
    beforeFilter = `AND id < $${params.length}`;
  }
  params.push(limit);
  const limitParam = `$${params.length}`;

  const query = `
    SELECT 
      id,
      chat_jid,
      sender_jid,
      from_me,
      text,
      message_type,
      has_media,
      timestamp
    FROM messages
    WHERE chat_jid = $1
      AND account_jid = $2
      ${beforeFilter}
      AND text IS NOT NULL
      AND TRIM(text) != ''
    ORDER BY timestamp DESC
    LIMIT ${limitParam};
  `;

  try {
    const result = await supabase.query(query, params);
    return result.rows.reverse();
  } catch (error) {
    console.error('[MessageService] Error fetching thread history:', error.message);
    return [];
  }
}

module.exports = {
  saveMessage,
  getChats,
  getChatMessages,
  getRecentThreadHistory
};
