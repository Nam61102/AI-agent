const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { formatPhoneNumber } = require('../whatsapp/whatsapp.utils');
const { sessionMiddleware } = require('../middleware/session.middleware');

router.use(sessionMiddleware);

// GET /api/extractions
router.get('/', async (req, res) => {
  try {
    const { type, status, contact_id } = req.query;
    const accountJid = req.accountJid;
    
    let query = `
      SELECT e.*, m.text AS source_text, m.sender_jid, m.chat_jid,
        sr.suggested_reply, sr.reason AS reply_reason, sr.tone AS reply_tone,
        chat.name AS db_chat_name,
        sender.name AS db_sender_name,
        m.from_me
      FROM extractions e
      LEFT JOIN messages m ON m.id = e.source_message_id
      LEFT JOIN contacts sender ON sender.jid = m.sender_jid AND sender.account_jid = $1
      LEFT JOIN contacts chat ON chat.jid = m.chat_jid AND chat.account_jid = $1
      LEFT JOIN suggested_replies sr ON sr.source_message_id = m.id AND sr.status = 'pending' AND sr.account_jid = $1
      WHERE e.account_jid = $1
      AND e.type NOT IN ('none', 'ai_auto_reply') 
      AND e.confidence >= 0.90`;
    
    const values = [accountJid];
    let paramIndex = 2;

    if (type) {
      query += ` AND e.type = $${paramIndex++}`;
      values.push(type);
    }
    if (status) {
      query += ` AND e.status = $${paramIndex++}`;
      values.push(status);
    }
    if (contact_id) {
      query += ` AND e.contact_id = $${paramIndex++}`;
      values.push(parseInt(contact_id, 10));
    }

    query += ' ORDER BY e.extracted_at DESC';

    const result = await supabase.query(query, values);
    
    // Deduplicate by 'what_matters' to remove "same meaning" extractions
    const seenMeanings = new Set();
    const uniqueRows = [];
    
    for (const row of result.rows) {
      let meaningStr = '';
      if (row.payload && row.payload.what_matters) {
        meaningStr = row.payload.what_matters.toLowerCase().trim();
      } else if (row.title) {
        meaningStr = row.title.toLowerCase().trim();
      } else {
        meaningStr = row.id.toString();
      }
      
      // Aggressive normalization (strip spaces and punctuation) to catch slight variations
      const normalizedStr = meaningStr.replace(/[^a-z0-9]/g, '');
      
      if (normalizedStr && !seenMeanings.has(normalizedStr)) {
        seenMeanings.add(normalizedStr);
        uniqueRows.push(row);
      } else if (!normalizedStr) {
        uniqueRows.push(row);
      }
    }

    const formattedData = uniqueRows.map(row => {
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
    const accountJid = req.accountJid;
    if (isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid ID' });

    const result = await supabase.query(
      `SELECT e.*, m.text AS source_text, m.sender_jid, m.chat_jid,
        sr.suggested_reply, sr.reason AS reply_reason, sr.tone AS reply_tone,
        chat.name AS db_chat_name,
        sender.name AS db_sender_name,
        m.from_me
       FROM extractions e
       LEFT JOIN messages m ON m.id = e.source_message_id
       LEFT JOIN contacts sender ON sender.jid = m.sender_jid AND sender.account_jid = $2
       LEFT JOIN contacts chat ON chat.jid = m.chat_jid AND chat.account_jid = $2
       LEFT JOIN suggested_replies sr ON sr.source_message_id = m.id AND sr.status = 'pending' AND sr.account_jid = $2
       WHERE e.id = $1 AND e.account_jid = $2 AND e.type NOT IN ('none', 'ai_auto_reply')`,
      [id, accountJid]
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
    const accountJid = req.accountJid;
    if (isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid ID' });
    
    await supabase.query('UPDATE extractions SET status = $1 WHERE id = $2 AND account_jid = $3', ['active', id, accountJid]);
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
    const accountJid = req.accountJid;
    if (isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid ID' });
    
    await supabase.query('UPDATE extractions SET status = $1 WHERE id = $2 AND account_jid = $3', ['rejected', id, accountJid]);
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
    const accountJid = req.accountJid;
    if (isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid ID' });
    
    const result = await supabase.query('SELECT text FROM messages WHERE id = $1 AND account_jid = $2', [id, accountJid]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Message not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/extractions/:jid/historical
router.post('/:jid/historical', async (req, res) => {
  try {
    const { jid } = req.params;
    const accountJid = req.accountJid;
    const profileService = require('../ai/profile.service');

    // Fetch up to 1 year of messages for contact
    const { rows: messages } = await supabase.query(
      "SELECT id, text, from_me, timestamp FROM messages WHERE chat_jid = $1 AND account_jid = $2 AND timestamp >= NOW() - INTERVAL '1 year' ORDER BY timestamp ASC",
      [jid, accountJid]
    );

    if (!messages || messages.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const result = await profileService.extractHistoryInChunks(messages);

    if (result.success && result.data.length > 0) {
      const latestMessageId = messages[messages.length - 1].id;
      
      for (const item of result.data) {
        if (!item.type || !item.title) continue;
        await supabase.query(
          `INSERT INTO extractions (source_message_id, type, title, status, importance, extracted_at, confidence, account_jid) 
           VALUES ($1, $2, $3, $4, $5, NOW(), 0.95, $6)`,
          [latestMessageId, item.type, item.title, item.status || 'pending', item.importance || 'medium', accountJid]
        );
      }
    }

    res.json({ success: true, data: result.data || [] });
  } catch (error) {
    console.error('[Extractions API] POST /:jid/historical error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
