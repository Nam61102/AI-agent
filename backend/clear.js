
const supabase = require('./src/config/supabase');
async function run() {
  await supabase.query('UPDATE ai_actions SET status = \'dismissed\' WHERE status = \'active\' AND source_message_id IN (SELECT id FROM messages WHERE timestamp < NOW() - INTERVAL \'24 hours\')');
  console.log('Cleared old actions');
  process.exit(0);
}
run();

