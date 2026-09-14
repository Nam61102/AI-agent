const supabase = require('./src/config/supabase');
async function check() {
  const res = await supabase.query(`SELECT * FROM messages ORDER BY timestamp DESC LIMIT 10`);
  console.log(res.rows);
  process.exit(0);
}
check();
