const supabase = require('./src/config/supabase');
async function check() {
  const res = await supabase.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'extractions' 
    AND column_name = 'confidence'
  `);
  console.log(res.rows);
  process.exit(0);
}
check();
