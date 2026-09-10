const express = require('express');
const router = express.Router();
const pool = require('../config/supabase');
const profileService = require('../ai/profile.service');
const sessionMiddleware = require('../middleware/session.middleware');

router.use(sessionMiddleware);

function normalizeProfileItems(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map(item => {
      if (typeof item === 'string') return { item, confidence: null };
      const label = item?.item || item?.name || item?.value;
      if (!label) return null;
      const confidence = Number(item.confidence);
      return { item: String(label), confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(100, confidence)) : null };
    })
    .filter(Boolean);
}

function fallbackProfile(messages) {
  const text = messages.map(message => message.text || '').join(' ').toLowerCase();
  const matches = (patterns, label) => patterns.some(pattern => text.includes(pattern)) ? [{ item: label, confidence: 70 }] : [];
  const detectedLikes = [
    ...matches(['marathi', 'मराठी'], 'Marathi language'),
    ...matches(['cricket', 'football', 'music', 'movie', 'song'], 'Sports or entertainment'),
    ...matches(['food', 'pizza', 'biryani', 'tea', 'coffee'], 'Food and drinks'),
    ...matches(['code', 'coding', 'software', 'developer', 'project', 'work', 'job', 'office'], 'Technology and work'),
    ...matches(['travel', 'trip', 'visit', 'place'], 'Travel and places'),
    ...matches(['photo', 'photography', 'color', 'colour', 'book', 'reading'], 'Creative interests')
  ];
  const detectedDislikes = matches(
    ['hate', 'don\'t like', 'dont like', 'avoid', 'problem', 'issue'],
    'Topics or situations they objected to'
  );

  return {
    likes: detectedLikes.length ? detectedLikes : [{ item: 'No clear likes identified in recent chats', confidence: null }],
    dislikes: detectedDislikes.length ? detectedDislikes : [{ item: 'No clear dislikes identified in recent chats', confidence: null }],
    interests: [
      ...matches(['code', 'coding', 'software', 'developer', 'project', 'work', 'job', 'office'], 'Technology and work'),
      ...matches(['travel', 'trip', 'visit', 'place'], 'Travel and places'),
      ...matches(['photo', 'photography', 'color', 'colour', 'book', 'reading'], 'Creative interests')
    ]
  };
}

// Get all saved contacts for the authenticated account session
router.get('/all', async (req, res) => {
  try {
    const search = req.query.search ? String(req.query.search).trim() : null;
    const accountJid = req.accountJid;

    const params = [accountJid];
    let query = `
      SELECT
        c.*,
        COUNT(m.id) AS message_count,
        LEAST(COUNT(m.id), 100) AS calculated_score
      FROM contacts c
      LEFT JOIN messages m ON c.jid = m.chat_jid AND m.account_jid = c.account_jid
      WHERE c.account_jid = $1
        AND c.jid NOT LIKE '%@g.us'
        AND c.jid NOT LIKE '%@newsletter'
        AND c.jid NOT LIKE '%@lid'
        AND c.name IS NOT NULL
        AND TRIM(c.name) != ''
        AND c.name != 'Group'
        AND c.name != 'Unknown'
    `;
    
    if (search) {
      params.push(`%${search}%`);
      query += ` AND c.name ILIKE $${params.length}`;
    }

    query += `
      GROUP BY c.id
      ORDER BY c.name ASC
    `;
    
    const { rows } = await pool.query(query, params);
    
    const formatted = (rows || []).map(c => ({
      ...c,
      relationship_score: c.relationship_score > 0 ? c.relationship_score : parseInt(c.calculated_score || 0)
    }));
    
    res.json({ success: true, data: formatted });
  } catch (error) {
    console.error('Error fetching all contacts:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get top contacts based on message count (saved contacts only, scoped to account_jid)
router.get('/top', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const accountJid = req.accountJid;

    const query = `
      SELECT
        c.*,
        COUNT(m.id) AS message_count,
        LEAST(COUNT(m.id), 100) AS calculated_score
      FROM contacts c
      INNER JOIN messages m
        ON c.jid = m.chat_jid
       AND m.account_jid = c.account_jid
       AND m.timestamp >= NOW() - INTERVAL '7 days'
      WHERE c.account_jid = $1
        AND c.jid NOT LIKE '%@g.us'
        AND c.jid NOT LIKE '%@newsletter'
        AND c.jid NOT LIKE '%@lid'
        AND c.name IS NOT NULL
        AND TRIM(c.name) != ''
        AND c.name != 'Group'
        AND c.name != 'Unknown'
      GROUP BY c.id
      HAVING COALESCE(NULLIF(c.relationship_score, 0), LEAST(COUNT(m.id), 100)) > 50
      ORDER BY COALESCE(NULLIF(c.relationship_score, 0), LEAST(COUNT(m.id), 100)) DESC,
               message_count DESC
      LIMIT $2
    `;
    
    const { rows } = await pool.query(query, [accountJid, limit]);
    
    const formatted = (rows || []).map(c => ({
      ...c,
      relationship_score: c.relationship_score > 0 ? c.relationship_score : parseInt(c.calculated_score || 0)
    }));
    
    res.json({ success: true, data: formatted });
  } catch (error) {
    console.error('Error fetching top contacts:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:jid/analyze-profile', async (req, res) => {
  try {
    const { jid } = req.params;
    const accountJid = req.accountJid;
    
    // Fetch up to 1 year of messages for this contact in chronological order, scoped to account
    const { rows: messages } = await pool.query(
      "SELECT text, from_me, timestamp FROM messages WHERE chat_jid = $1 AND account_jid = $2 AND timestamp >= NOW() - INTERVAL '1 year' ORDER BY timestamp ASC",
      [jid, accountJid]
    );

    if (!messages || messages.length === 0) {
      return res.json({ success: true, data: { likes: [], dislikes: [], interests: [], analyzedAt: null }});
    }

    // AI Analysis
    const result = await profileService.analyzeProfileInChunks(messages);
    
    if (!result.success) {
      console.warn('[Contacts API] Profile analysis unavailable:', result.error);
      const fallback = fallbackProfile(messages);
      return res.json({
        success: true,
        data: { ...fallback, analyzedAt: null, analysisSource: 'conversation-signals' }
      });
    }

    const profile = {
      likes: normalizeProfileItems(result.data.likes),
      dislikes: normalizeProfileItems(result.data.dislikes),
      interests: normalizeProfileItems(result.data.interests),
      birthdays: normalizeProfileItems(result.data.birthdays),
      anniversaries: normalizeProfileItems(result.data.anniversaries),
      events: normalizeProfileItems(result.data.events),
      important: normalizeProfileItems(result.data.important)
    };
    const likesStr = profile.likes.map(item => item.item).join(', ');
    const dislikesStr = profile.dislikes.map(item => item.item).join(', ');

    // Save back to DB scoped to account_jid
    await pool.query(
      'UPDATE contacts SET likes = $1, dislikes = $2, profile_data = $3::jsonb, profile_analyzed_at = NOW() WHERE jid = $4 AND account_jid = $5',
      [likesStr, dislikesStr, JSON.stringify(profile), jid, accountJid]
    );

    res.json({ success: true, data: { ...profile, analyzedAt: new Date().toISOString() } });
  } catch (error) {
    console.error('Error analyzing profile:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
