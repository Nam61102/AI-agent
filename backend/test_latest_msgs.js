const supabase = require('./src/config/supabase');
async function check() {
  const accountJid = '917030513050@s.whatsapp.net';
  const res = await supabase.query(`SELECT id, text, from_me, chat_jid, timestamp FROM messages WHERE account_jid = $1 ORDER BY timestamp DESC LIMIT 10`, [accountJid]);
  console.log('Recent messages for account:', res.rows);
  const exts = await supabase.query(`SELECT id, type, payload, confidence FROM extractions WHERE account_jid = $1`, [accountJid]);
  console.log('Extractions for account:', exts.rows);
  const acts = await supabase.query(`SELECT id, type, status FROM ai_actions WHERE account_jid = $1`, [accountJid]);
  console.log('AI Actions for account:', acts.rows);
  process.exit(0);
}
check();
