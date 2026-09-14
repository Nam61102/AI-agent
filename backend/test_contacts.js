const supabase = require('./src/config/supabase');
async function check() {
  const res = await supabase.query(`SELECT account_jid, name FROM contacts`);
  console.log('Contacts:', res.rows);
  process.exit(0);
}
check();
