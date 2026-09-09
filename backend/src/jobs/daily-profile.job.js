const cron = require('node-cron');
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

// Run every night at 3:00 AM
cron.schedule('0 3 * * *', async () => {
  console.log('[Cron] Starting daily profile update job...');
  try {
    // Contacts with messages in the last 24 hours
    const activeContactsResult = await pool.query(`
      SELECT DISTINCT c.jid, c.profile_data
      FROM messages m
      JOIN contacts c ON m.contact_id = c.id
      WHERE m.timestamp > NOW() - INTERVAL '1 day'
    `);
    
    console.log(`[Cron] Found ${activeContactsResult.rows.length} contacts to update.`);
    
    for (const row of activeContactsResult.rows) {
      const { jid, profile_data } = row;
      
      const { rows: newMessages } = await pool.query(
        "SELECT text, from_me, timestamp FROM messages WHERE chat_jid = $1 AND timestamp > NOW() - INTERVAL '1 day' ORDER BY timestamp ASC",
        [jid]
      );
      
      if (!newMessages || newMessages.length === 0) continue;
      
      const result = await profileService.analyzeProfileInChunks(newMessages);
      if (result.success && result.data) {
        
        let oldData = {};
        if (profile_data && typeof profile_data === 'string') {
          try { oldData = JSON.parse(profile_data); } catch(e){}
        } else if (profile_data && typeof profile_data === 'object') {
          oldData = profile_data;
        }

        // Merge arrays (remove exact duplicates)
        const mergeArrays = (arr1, arr2) => {
          const combined = [...(arr1 || []), ...(arr2 || [])];
          const seen = new Set();
          return combined.filter(item => {
            const key = item.item.toLowerCase().trim();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
        };

        const profile = {
          likes: mergeArrays(oldData.likes, normalizeProfileItems(result.data.likes)),
          dislikes: mergeArrays(oldData.dislikes, normalizeProfileItems(result.data.dislikes)),
          interests: mergeArrays(oldData.interests, normalizeProfileItems(result.data.interests)),
          birthdays: mergeArrays(oldData.birthdays, normalizeProfileItems(result.data.birthdays)),
          anniversaries: mergeArrays(oldData.anniversaries, normalizeProfileItems(result.data.anniversaries)),
          events: mergeArrays(oldData.events, normalizeProfileItems(result.data.events)),
          important: mergeArrays(oldData.important, normalizeProfileItems(result.data.important))
        };

        const likesStr = profile.likes.map(i => i.item).join(', ');
        const dislikesStr = profile.dislikes.map(i => i.item).join(', ');

        await pool.query(
          'UPDATE contacts SET likes = $1, dislikes = $2, profile_data = $3::jsonb, profile_analyzed_at = NOW() WHERE jid = $4',
          [likesStr, dislikesStr, JSON.stringify(profile), jid]
        );
      }
    }
    console.log('[Cron] Daily profile update completed.');
  } catch (err) {
    console.error('[Cron] Daily profile update failed:', err.message);
  }
});
