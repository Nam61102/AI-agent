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

module.exports = supabase;
