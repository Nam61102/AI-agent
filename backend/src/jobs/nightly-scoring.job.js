const cron = require('node-cron');
const supabase = require('../config/supabase');
const relationshipService = require('../services/relationship.service');

// Run every night at 2:00 AM
cron.schedule('0 2 * * *', async () => {
  console.log('[Cron] Starting nightly relationship scoring job...');
  try {
    // Get all active contacts (e.g. have sent/received a message in the last 30 days)
    const activeContactsResult = await supabase.query(`
      SELECT DISTINCT chat_jid 
      FROM messages 
      WHERE timestamp > NOW() - INTERVAL '30 days'
    `);
    
    console.log(`[Cron] Found ${activeContactsResult.rows.length} active contacts to score.`);
    
    for (const row of activeContactsResult.rows) {
      await relationshipService.analyzeContact(row.chat_jid);
    }
    
    console.log('[Cron] Nightly scoring job completed successfully.');
  } catch (err) {
    console.error('[Cron] Nightly scoring job failed:', err.message);
  }
});
