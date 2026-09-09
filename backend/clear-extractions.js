
const supabase = require('./src/config/supabase');
async function run() {
  await supabase.query('UPDATE extractions SET status = \'rejected\' WHERE status IN (\'pending\', \'active\') AND source_message_id IN (SELECT id FROM messages WHERE timestamp < NOW() - INTERVAL \'24 hours\')');
  await supabase.query('DELETE FROM extractions e1 USING extractions e2 WHERE e1.source_message_id = e2.source_message_id AND e1.type = e2.type AND e1.payload->>\'title\' = e2.payload->>\'title\' AND e1.id < e2.id');
  console.log('Cleared old extractions and removed duplicates');
  process.exit(0);
}
run();

