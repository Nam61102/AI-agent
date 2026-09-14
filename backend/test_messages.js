const supabase = require('./src/config/supabase');
async function check() {
  const res = await supabase.query(`SELECT * FROM messages WHERE account_jid = '917030513050@s.whatsapp.net'`);
  console.log(res.rows);
  const res2 = await supabase.query(`SELECT * FROM ai_actions WHERE account_jid = '917030513050@s.whatsapp.net'`);
  console.log(res2.rows);
  process.exit(0);
}
check();
