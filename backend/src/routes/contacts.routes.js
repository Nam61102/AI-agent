const express = require('express');
const router = express.Router();
const pool = require('../config/supabase');
const profileService = require('../ai/profile.service');

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

// Get top 10 contacts based on message count (approximation of relationship strength)
router.get('/top', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const query = `
      SELECT
        c.*,
        COUNT(m.id) AS message_count,
        LEAST(COUNT(m.id), 100) AS calculated_score
      FROM contacts c
      INNER JOIN messages m
        ON c.jid = m.chat_jid
       AND m.timestamp >= NOW() - INTERVAL '7 days'
      WHERE c.jid NOT LIKE '%@g.us'
        AND c.jid NOT LIKE '%@newsletter'
      GROUP BY c.id
      HAVING COALESCE(NULLIF(c.relationship_score, 0), LEAST(COUNT(m.id), 100)) > 50
      ORDER BY COALESCE(NULLIF(c.relationship_score, 0), LEAST(COUNT(m.id), 100)) DESC,
               message_count DESC
      LIMIT $1
    `;
    
    const { rows } = await pool.query(query, [limit]);
    
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
    
    // Fetch last 100 messages for this contact
    const { rows: messages } = await pool.query(
      'SELECT text, from_me, timestamp FROM messages WHERE chat_jid = $1 ORDER BY timestamp DESC LIMIT 100',
      [jid]
    );

    if (!messages || messages.length === 0) {
      return res.json({ success: true, data: { likes: [], dislikes: [], interests: [], analyzedAt: null }});
    }

    // AI Analysis
    const result = await profileService.analyzeProfile(messages.reverse());
    
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
      interests: normalizeProfileItems(result.data.interests)
    };
    const likesStr = profile.likes.map(item => item.item).join(', ');
    const dislikesStr = profile.dislikes.map(item => item.item).join(', ');

    // Save back to DB
    await pool.query(
      'UPDATE contacts SET likes = $1, dislikes = $2, profile_data = $3::jsonb, profile_analyzed_at = NOW() WHERE jid = $4',
      [likesStr, dislikesStr, JSON.stringify(profile), jid]
    );

    res.json({ success: true, data: { ...profile, analyzedAt: new Date().toISOString() } });
  } catch (error) {
    console.error('Error analyzing profile:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
