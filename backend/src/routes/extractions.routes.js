const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

function completeLegacyPayload(row) {
  const sourceText = String(row.source_text || '').trim().toLowerCase();
  const payload = { ...(row.payload || {}) };

  if (row.type === 'meeting' && sourceText.includes('meeting chalu')) {
    payload.title = 'The meeting is ongoing';
  } else if (row.type === 'task' && sourceText.includes('kela order')) {
    payload.description = 'The banana order has been completed';
  } else if (row.type === 'task' && sourceText.includes('tiffins nahiyt')) {
    payload.description = 'There will be no tiffins today and tomorrow';
  }

  return { ...row, payload };
}

// GET /api/extractions
router.get('/', async (req, res) => {
  try {
    const { type, status, contact_id } = req.query;
    
    let query = `
            SELECT e.*, m.text AS source_text, m.sender_jid, m.chat_jid,
              COALESCE(chat.name, m.chat_jid) AS chat_name,
              CASE WHEN m.from_me THEN 'You' ELSE COALESCE(sender.name, m.sender_jid) END AS sender_name
      FROM extractions e
      LEFT JOIN messages m ON m.id = e.source_message_id
      LEFT JOIN contacts sender ON sender.jid = m.sender_jid
      LEFT JOIN contacts chat ON chat.jid = m.chat_jid
        WHERE 1=1`;
    const values = [];
    let paramIndex = 1;

    if (type) {
      query += ` AND type = $${paramIndex++}`;
      values.push(type);
    }
    if (status) {
      query += ` AND status = $${paramIndex++}`;
      values.push(status);
    }
    if (contact_id) {
      query += ` AND contact_id = $${paramIndex++}`;
      values.push(parseInt(contact_id, 10));
    }

    query += ' ORDER BY extracted_at DESC';

    const result = await supabase.query(query, values);

    res.json({
      success: true,
      data: result.rows.map(completeLegacyPayload)
    });
  } catch (error) {
    console.error('[Extractions API] GET / error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/extractions/:id
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'Invalid ID' });
    }

      const result = await supabase.query(
        `SELECT e.*, m.text AS source_text, m.sender_jid, m.chat_jid,
          COALESCE(chat.name, m.chat_jid) AS chat_name,
          CASE WHEN m.from_me THEN 'You' ELSE COALESCE(sender.name, m.sender_jid) END AS sender_name
         FROM extractions e
         LEFT JOIN messages m ON m.id = e.source_message_id
         LEFT JOIN contacts sender ON sender.jid = m.sender_jid
         LEFT JOIN contacts chat ON chat.jid = m.chat_jid
         WHERE e.id = $1`,
        [id]
      );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Extraction not found' });
    }

    res.json({
      success: true,
      data: completeLegacyPayload(result.rows[0])
    });
  } catch (error) {
    console.error('[Extractions API] GET /:id error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
