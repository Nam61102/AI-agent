
const pool = require('./src/config/supabase');

async function run() {
  try {
    await pool.query(\
      CREATE TABLE IF NOT EXISTS push_tokens (
        id SERIAL PRIMARY KEY,
        account_jid VARCHAR(255) NOT NULL,
        token VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(account_jid, token)
      );
    \);
    console.log('Table created successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error creating table:', error);
    process.exit(1);
  }
}
run();

