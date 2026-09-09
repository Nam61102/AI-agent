const supabase = require('./src/config/supabase');
supabase.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'contact_metrics'")
  .then(res => { console.log(res.rows); process.exit(0); });
