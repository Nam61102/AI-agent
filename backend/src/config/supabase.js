const dotenv = require('dotenv');
const { Pool } = require('pg');

dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required to connect to Supabase');
}

const supabase = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5
});

// Prevent unhandled pool errors from crashing the backend
supabase.on('error', (err) => {
  console.error('[Supabase Pool] Unexpected error on idle client', err.message);
});

module.exports = supabase;
