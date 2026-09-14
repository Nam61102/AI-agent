const supabase = require('./src/config/supabase');
async function check() {
  const res = await supabase.query(`SELECT account_jid, COUNT(*) FROM extractions GROUP BY account_jid`);
  console.log('Extractions by account:', res.rows);
  const res2 = await supabase.query(`SELECT account_jid, COUNT(*) FROM messages GROUP BY account_jid`);
  console.log('Messages by account:', res2.rows);
  process.exit(0);
}
check();
