require('dotenv').config({ path: 'c:/Users/user5/Downloads/nryn_agent (4)/nryn_agent/backend/.env' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const query = `
  ALTER TABLE contacts 
  ADD COLUMN IF NOT EXISTS likes TEXT,
  ADD COLUMN IF NOT EXISTS dislikes TEXT,
  ADD COLUMN IF NOT EXISTS relationship_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS profile_data JSONB,
  ADD COLUMN IF NOT EXISTS profile_analyzed_at TIMESTAMPTZ;
`;
pool.query(query, (err, res) => {
  if (err) console.error(err);
  else console.log('Database altered successfully');
  pool.end();
});
