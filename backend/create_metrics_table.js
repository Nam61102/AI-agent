const supabase = require('./src/config/supabase');

async function run() {
  const query = `
    CREATE TABLE IF NOT EXISTS contact_metrics (
      jid TEXT NOT NULL,
      computed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      factor TEXT NOT NULL,
      value NUMERIC,
      PRIMARY KEY (jid, factor)
    );
  `;
  try {
    await supabase.query(query);
    console.log('contact_metrics table created successfully');
    process.exit(0);
  } catch (err) {
    console.error('Error creating table:', err);
    process.exit(1);
  }
}
run();
