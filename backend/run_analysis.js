const supabase = require('./src/config/supabase');
const relationshipService = require('./src/services/relationship.service');

async function run() {
  console.log('Running analysis...');
  const activeContactsResult = await supabase.query(`
    SELECT DISTINCT chat_jid 
    FROM messages 
  `);
  console.log('Found ' + activeContactsResult.rows.length + ' contacts');
  for (const row of activeContactsResult.rows) {
    try {
      await relationshipService.analyzeContact(row.chat_jid);
    } catch (e) {
      console.error(e);
    }
  }
  console.log('Done!');
  process.exit(0);
}
run();
