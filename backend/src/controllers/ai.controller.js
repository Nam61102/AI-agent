const supabase = require('../config/supabase');
const { formatPhoneNumber } = require('../whatsapp/whatsapp.utils');
const replyService = require('../ai/reply.service');

async function suggestReply(req, res) {
  try {
    const { jid, text } = req.body;
    const accountJid = req.accountJid;
    if (!jid || !text) return res.status(400).json({ success: false, error: 'jid and text are required' });

    const [contactResult, messagesResult] = await Promise.all([
      supabase.query('SELECT name FROM contacts WHERE jid = $1 AND account_jid = $2 LIMIT 1', [jid, accountJid]),
      supabase.query(
        `SELECT sender_jid, from_me, text, timestamp FROM messages
         WHERE chat_jid = $1 AND account_jid = $2 AND text IS NOT NULL AND TRIM(text) != ''
         ORDER BY timestamp DESC LIMIT 20`,
        [jid, accountJid]
      )
    ]);

    const result = await replyService.generateReply({
      contact: { name: contactResult.rows[0]?.name || formatPhoneNumber(jid.split('@')[0]), jid },
      conversationHistory: messagesResult.rows.reverse(),
      currentMessage: { text, timestamp: new Date().toISOString(), sender: contactResult.rows[0]?.name }
    });

    if (!result.success) {
      const fallbackReply = /birthday/i.test(text)
        ? 'Happy Birthday! I hope you have a wonderful day. Let me know how you would like to celebrate.'
        : `Thanks for sharing this. I will get back to you shortly.`;
      console.warn('[AIController] Reply generation unavailable, using fallback:', result.error);
      return res.json({ success: true, data: { suggested_reply: fallbackReply, aiGenerated: false } });
    }
    return res.json({ success: true, data: result.data });
  } catch (error) {
    console.error('[AIController] suggestReply error:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
}

async function getActions(req, res) {
  try {
    const { status = 'active', limit = 100 } = req.query;
    const accountJid = req.accountJid;

    const query = `
      SELECT 
        a.id AS action_id,
        a.type AS action_type,
        a.category,
        a.subtype,
        a.title,
        a.meaning,
        a.description,
        a.next_step,
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
      LEFT JOIN contacts c ON (c.jid = a.chat_jid OR c.id = a.contact_id) AND (c.account_jid = a.account_jid OR c.account_jid IS NULL)
      LEFT JOIN messages m ON a.source_message_id = m.id
      LEFT JOIN suggested_replies sr ON a.suggested_reply_id = sr.id
      WHERE a.status = $1 AND a.account_jid = $2
        AND a.chat_jid NOT LIKE '%@newsletter'
        AND a.chat_jid NOT LIKE '%@lid'
      ORDER BY a.created_at DESC
      LIMIT $3;
    `;

    const result = await supabase.query(query, [status, accountJid, limit]);

    const actions = result.rows.map(row => {
      const isGroup = row.chat_jid && row.chat_jid.endsWith('@g.us');
      const rawNumber = row.chat_jid ? row.chat_jid.split('@')[0] : '';
      let contactName = row.db_contact_name;
      if (!contactName || /^[0-9+\s().-]+$/.test(contactName.trim()) || contactName.includes('@')) {
        contactName = isGroup ? 'Group' : formatPhoneNumber(rawNumber);
      }

      // Derive category if null
      let category = row.category;
      if (!category) {
        if (row.action_type === 'birthday' || row.action_type === 'life_event') category = 'important_event';
        else if (row.action_type === 'follow_up' || row.action_type === 'incident' || row.action_type === 'task') category = 'needs_action';
        else category = 'ai_auto_reply';
      }

      const whatMatters = row.title || 'Important conversation update';
      const whyItMatters = row.meaning || row.description || row.reason || 'Flagged by NRYN AI';
      const recommendedAction = row.next_step || (row.suggested_reply ? 'Send suggested reply' : 'Review and take action');

      return {
        id: row.action_id,
        category,
        subtype: row.subtype || row.action_type || 'general',
        type: row.action_type,
        title: whatMatters,
        whatMatters,
        whyItMatters,
        recommendedAction,
        description: whyItMatters,
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

async function getIntelligence(req, res) {
  try {
    const { status = 'active' } = req.query;
    const accountJid = req.accountJid;

    const query = `
      SELECT 
        a.id AS action_id,
        a.type AS action_type,
        a.category,
        a.subtype,
        a.title,
        a.meaning,
        a.description,
        a.next_step,
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
      LEFT JOIN contacts c ON (c.jid = a.chat_jid OR c.id = a.contact_id) AND (c.account_jid = a.account_jid OR c.account_jid IS NULL)
      LEFT JOIN messages m ON a.source_message_id = m.id
      LEFT JOIN suggested_replies sr ON a.suggested_reply_id = sr.id
      WHERE a.status = $1 AND a.account_jid = $2
        AND a.chat_jid NOT LIKE '%@newsletter'
        AND a.chat_jid NOT LIKE '%@lid'
      ORDER BY a.created_at DESC;
    `;

    const result = await supabase.query(query, [status, accountJid]);

    const categories = {
      needs_action: [],
      important_event: [],
      relationship_insight: [],
      ai_auto_reply: []
    };

    const allItems = result.rows.map(row => {
      const isGroup = row.chat_jid && row.chat_jid.endsWith('@g.us');
      const rawNumber = row.chat_jid ? row.chat_jid.split('@')[0] : '';
      let contactName = row.db_contact_name;
      if (!contactName || /^[0-9+\s().-]+$/.test(contactName.trim()) || contactName.includes('@')) {
        contactName = isGroup ? 'Group' : formatPhoneNumber(rawNumber);
      }

      let cat = row.category;
      if (!cat || !categories[cat]) {
        if (row.action_type === 'birthday' || row.action_type === 'life_event') cat = 'important_event';
        else if (row.action_type === 'follow_up' || row.action_type === 'incident' || row.action_type === 'task' || row.action_type === 'meeting') cat = 'needs_action';
        else cat = 'ai_auto_reply';
      }

      const item = {
        id: row.action_id,
        category: cat,
        subtype: row.subtype || row.action_type || 'general',
        whatMatters: row.title || 'Important update',
        whyItMatters: row.meaning || row.description || row.reason || 'Flagged by NRYN AI',
        recommendedAction: row.next_step || (row.suggested_reply ? 'Send suggested reply' : 'Review context'),
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
      };

      if (categories[cat]) {
        categories[cat].push(item);
      }
      return item;
    });

    return res.status(200).json({
      success: true,
      categories,
      totalCount: allItems.length,
      items: allItems
    });
  } catch (error) {
    console.error('[AIController] getIntelligence error:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
}

async function getActionById(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const accountJid = req.accountJid;
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
      WHERE a.id = $1 AND a.account_jid = $2
      LIMIT 1;
    `;

    const result = await supabase.query(query, [id, accountJid]);
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
    const accountJid = req.accountJid;
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'Invalid action ID' });
    }

    const updateActionQuery = `
      UPDATE ai_actions
      SET status = 'dismissed', updated_at = NOW()
      WHERE id = $1 AND account_jid = $2
      RETURNING suggested_reply_id;
    `;
    const actionRes = await supabase.query(updateActionQuery, [id, accountJid]);

    if (actionRes.rows.length > 0 && actionRes.rows[0].suggested_reply_id) {
      await supabase.query(
        `UPDATE suggested_replies SET status = 'dismissed', updated_at = NOW() WHERE id = $1 AND account_jid = $2`,
        [actionRes.rows[0].suggested_reply_id, accountJid]
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
    const accountJid = req.accountJid;
    const [messagesRes, repliesRes, activeChatsRes, pendingActionsRes] = await Promise.all([
      supabase.query(`SELECT COUNT(*) FROM messages WHERE account_jid = $1 AND timestamp >= NOW() - INTERVAL '24 hours'`, [accountJid]),
      supabase.query(`SELECT COUNT(*) FROM suggested_replies WHERE account_jid = $1 AND created_at >= NOW() - INTERVAL '24 hours'`, [accountJid]),
      supabase.query(`SELECT COUNT(DISTINCT chat_jid) FROM messages WHERE account_jid = $1 AND timestamp >= NOW() - INTERVAL '24 hours'`, [accountJid]),
      supabase.query(`SELECT COUNT(DISTINCT COALESCE(payload->>'what_matters', payload->>'description', payload->>'title', type)) FROM extractions WHERE account_jid = $1 AND status = 'active' AND type NOT IN ('none', 'ai_auto_reply') AND confidence >= 0.90`, [accountJid])
    ]);

    return res.status(200).json({
      success: true,
      summary: {
        messagesLast24h: parseInt(messagesRes.rows[0]?.count || 0, 10),
        aiRepliesGenerated: parseInt(repliesRes.rows[0]?.count || 0, 10),
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
    const accountJid = req.accountJid;
    const messageProcessor = require('../services/message-processor.service');
    const query = `
      SELECT DISTINCT ON (chat_jid)
        m.*
      FROM messages m
      WHERE m.account_jid = $1
        AND m.from_me = false
        AND m.message_type = 'text'
        AND m.text IS NOT NULL
        AND TRIM(m.text) != ''
        AND m.chat_jid NOT LIKE '%@newsletter'
        AND m.chat_jid NOT LIKE '%@g.us'
        AND m.chat_jid NOT LIKE '%@lid'
      ORDER BY m.chat_jid, m.timestamp DESC
      LIMIT 10;
    `;

    const result = await supabase.query(query, [accountJid]);
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
  suggestReply,
  getActions,
  getIntelligence,
  getActionById,
  dismissAction,
  getDashboardSummary,
  analyzeActiveChats
};
