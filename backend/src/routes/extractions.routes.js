const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { formatPhoneNumber } = require('../whatsapp/whatsapp.utils');

// GET /api/extractions
router.get('/', async (req, res) => {
  try {
    const { type, status, contact_id } = req.query;
    
    let query = `
      SELECT e.*, m.text AS source_text, m.sender_jid, m.chat_jid,
        sr.suggested_reply, sr.reason AS reply_reason, sr.tone AS reply_tone,
        chat.name AS db_chat_name,
        sender.name AS db_sender_name,
        m.from_me
      FROM extractions e
      LEFT JOIN messages m ON m.id = e.source_message_id
      LEFT JOIN contacts sender ON sender.jid = m.sender_jid
      LEFT JOIN contacts chat ON chat.jid = m.chat_jid
      LEFT JOIN suggested_replies sr ON sr.source_message_id = m.id AND sr.status = 'pending'
      WHERE e.type != 'none' AND e.confidence >= 0.90`;
    
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

    const formattedData = result.rows.map(row => {
      row.chat_name = row.db_chat_name || (row.chat_jid && row.chat_jid.endsWith('@g.us') ? 'Group' : formatPhoneNumber(row.chat_jid ? row.chat_jid.split('@')[0] : ''));
      row.sender_name = row.from_me ? 'You' : (row.db_sender_name || formatPhoneNumber(row.sender_jid ? row.sender_jid.split('@')[0] : ''));
      return row;
    });

    res.json({
      success: true,
      data: formattedData
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
    if (isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid ID' });

    const result = await supabase.query(
      `SELECT e.*, m.text AS source_text, m.sender_jid, m.chat_jid,
        sr.suggested_reply, sr.reason AS reply_reason, sr.tone AS reply_tone,
        chat.name AS db_chat_name,
        sender.name AS db_sender_name,
        m.from_me
       FROM extractions e
       LEFT JOIN messages m ON m.id = e.source_message_id
       LEFT JOIN contacts sender ON sender.jid = m.sender_jid
       LEFT JOIN contacts chat ON chat.jid = m.chat_jid
      LEFT JOIN suggested_replies sr ON sr.source_message_id = m.id AND sr.status = 'pending'
       WHERE e.id = $1 AND e.type != 'none'`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Extraction not found' });
    }

    const row = result.rows[0];
    row.chat_name = row.db_chat_name || (row.chat_jid && row.chat_jid.endsWith('@g.us') ? 'Group' : formatPhoneNumber(row.chat_jid ? row.chat_jid.split('@')[0] : ''));
    row.sender_name = row.from_me ? 'You' : (row.db_sender_name || formatPhoneNumber(row.sender_jid ? row.sender_jid.split('@')[0] : ''));

    res.json({
      success: true,
      data: row
    });
  } catch (error) {
    console.error('[Extractions API] GET /:id error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/extractions/:id/confirm
router.post('/:id/confirm', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid ID' });
    
    await supabase.query('UPDATE extractions SET status = $1 WHERE id = $2', ['active', id]);
    res.json({ success: true });
  } catch (error) {
    console.error('[Extractions API] POST /:id/confirm error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/extractions/:id/reject
router.post('/:id/reject', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid ID' });
    
    await supabase.query('UPDATE extractions SET status = $1 WHERE id = $2', ['rejected', id]);
    res.json({ success: true });
  } catch (error) {
    console.error('[Extractions API] POST /:id/reject error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/extractions/source-message/:id
router.get('/source-message/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid ID' });
    
    const result = await supabase.query('SELECT text FROM messages WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Message not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
