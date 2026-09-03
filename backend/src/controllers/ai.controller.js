const supabase = require('../config/supabase');
const { formatPhoneNumber } = require('../whatsapp/whatsapp.utils');

async function getActions(req, res) {
  try {
    const { status = 'active', limit = 50 } = req.query;

    const query = `
      SELECT DISTINCT ON (a.chat_jid)
        a.id AS action_id,
        a.type AS action_type,
        a.title,
        a.description,
        a.status AS action_status,
        a.priority,
        a.created_at AS action_created_at,
        c.id AS contact_id,
        c.name AS db_contact_name,
        a.chat_jid,
        m.id AS source_message_id,
        m.text AS source_message_text,
        m.timestamp AS source_message_timestamp,
        m.from_me AS source_from_me,
        sr.id AS suggested_reply_id,
        sr.suggested_reply,
        sr.reason,
        sr.tone
      FROM ai_actions a
      LEFT JOIN contacts c ON a.contact_id = c.id
      LEFT JOIN messages m ON a.source_message_id = m.id
      LEFT JOIN suggested_replies sr ON a.suggested_reply_id = sr.id
      WHERE a.status = $1
      ORDER BY a.chat_jid, a.created_at DESC
      LIMIT $2;
    `;

    const result = await supabase.query(query, [status, limit]);

    const actions = result.rows.map(row => {
      const isGroup = row.chat_jid && row.chat_jid.endsWith('@g.us');
      const rawNumber = row.chat_jid ? row.chat_jid.split('@')[0] : '';
      const contactName = row.db_contact_name || (isGroup ? 'Group' : formatPhoneNumber(rawNumber));

      return {
        id: row.action_id,
        type: row.action_type,
        title: row.title || (row.action_type === 'birthday' ? 'Birthday' : row.action_type === 'follow_up' ? 'Follow Up' : 'Reply Needed'),
        description: row.description,
        status: row.action_status,
        priority: row.priority,
        createdAt: row.action_created_at,
        contact: {
          id: row.contact_id,
          name: contactName,
          jid: row.chat_jid
        },
        sourceMessage: {
          id: row.source_message_id,
          text: row.source_message_text,
          timestamp: row.source_message_timestamp,
          fromMe: row.source_from_me
        },
        suggestedReply: {
          id: row.suggested_reply_id,
          text: row.suggested_reply,
          reason: row.reason,
          tone: row.tone
        }
      };
    });

    return res.status(200).json({
      success: true,
      actions
    });
  } catch (error) {
    console.error('[AIController] getActions error:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
}

async function getActionById(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'Invalid action ID' });
    }

    const query = `
      SELECT 
        a.id AS action_id,
        a.type AS action_type,
        a.title,
        a.description,
        a.status AS action_status,
        a.priority,
        a.created_at AS action_created_at,
        c.id AS contact_id,
        c.name AS db_contact_name,
        a.chat_jid,
        m.id AS source_message_id,
        m.text AS source_message_text,
        m.timestamp AS source_message_timestamp,
        sr.id AS suggested_reply_id,
        sr.suggested_reply,
        sr.reason,
        sr.tone
      FROM ai_actions a
      LEFT JOIN contacts c ON a.contact_id = c.id
      LEFT JOIN messages m ON a.source_message_id = m.id
      LEFT JOIN suggested_replies sr ON a.suggested_reply_id = sr.id
      WHERE a.id = $1
      LIMIT 1;
    `;

    const result = await supabase.query(query, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Action not found' });
    }

    const row = result.rows[0];
    const isGroup = row.chat_jid && row.chat_jid.endsWith('@g.us');
    const rawNumber = row.chat_jid ? row.chat_jid.split('@')[0] : '';
    const contactName = row.db_contact_name || (isGroup ? 'Group' : formatPhoneNumber(rawNumber));

    return res.status(200).json({
      success: true,
      action: {
        id: row.action_id,
        type: row.action_type,
        title: row.title,
        description: row.description,
        status: row.action_status,
        createdAt: row.action_created_at,
        contact: {
          id: row.contact_id,
          name: contactName,
          jid: row.chat_jid
        },
        sourceMessage: {
          id: row.source_message_id,
          text: row.source_message_text,
          timestamp: row.source_message_timestamp
        },
        suggestedReply: {
          id: row.suggested_reply_id,
          text: row.suggested_reply,
          reason: row.reason,
          tone: row.tone
        }
      }
    });
  } catch (error) {
    console.error('[AIController] getActionById error:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
}

async function dismissAction(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'Invalid action ID' });
    }

    const updateActionQuery = `
      UPDATE ai_actions
      SET status = 'dismissed', updated_at = NOW()
      WHERE id = $1
      RETURNING suggested_reply_id;
    `;
    const actionRes = await supabase.query(updateActionQuery, [id]);

    if (actionRes.rows.length > 0 && actionRes.rows[0].suggested_reply_id) {
      await supabase.query(
        `UPDATE suggested_replies SET status = 'dismissed', updated_at = NOW() WHERE id = $1`,
        [actionRes.rows[0].suggested_reply_id]
      );
    }

    return res.status(200).json({ success: true, message: 'Action dismissed' });
  } catch (error) {
    console.error('[AIController] dismissAction error:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
}

async function getDashboardSummary(req, res) {
  try {
    const [messagesCountRes, repliesCountRes, activeChatsRes, pendingActionsRes] = await Promise.all([
      supabase.query(`SELECT COUNT(*) FROM messages WHERE timestamp >= NOW() - INTERVAL '24 hours'`),
      supabase.query(`SELECT COUNT(*) FROM suggested_replies WHERE created_at >= NOW() - INTERVAL '24 hours'`),
      supabase.query(`SELECT COUNT(DISTINCT chat_jid) FROM messages WHERE timestamp >= NOW() - INTERVAL '24 hours'`),
      supabase.query(`SELECT COUNT(*) FROM ai_actions WHERE status = 'active'`)
    ]);

    return res.status(200).json({
      success: true,
      summary: {
        messagesLast24h: parseInt(messagesCountRes.rows[0]?.count || 0, 10),
        aiRepliesGenerated: parseInt(repliesCountRes.rows[0]?.count || 0, 10),
        activeConversations: parseInt(activeChatsRes.rows[0]?.count || 0, 10),
        pendingActions: parseInt(pendingActionsRes.rows[0]?.count || 0, 10)
      }
    });
  } catch (error) {
    console.error('[AIController] getDashboardSummary error:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
}

async function analyzeActiveChats(req, res) {
  try {
    const messageProcessor = require('../services/message-processor.service');
    const query = `
      SELECT DISTINCT ON (chat_jid)
        m.*
      FROM messages m
      WHERE m.from_me = false
        AND m.message_type = 'text'
        AND m.text IS NOT NULL
        AND TRIM(m.text) != ''
        AND m.chat_jid NOT LIKE '%@newsletter'
        AND m.chat_jid NOT LIKE '%@g.us'
      ORDER BY m.chat_jid, m.timestamp DESC
      LIMIT 10;
    `;

    const result = await supabase.query(query);
    for (const msg of result.rows) {
      await messageProcessor._processAsync(msg);
    }

    return getActions(req, res);
  } catch (error) {
    console.error('[AIController] analyzeActiveChats error:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = {
  getActions,
  getActionById,
  dismissAction,
  getDashboardSummary,
  analyzeActiveChats
};
