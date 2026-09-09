const pool = require('./src/config/supabase');
pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'").then(res => { 
  console.log('Tables:', res.rows.map(r=>r.table_name)); 
  process.exit(0); 
});
