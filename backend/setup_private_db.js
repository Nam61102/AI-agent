const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function setupPrivateDatabase() {
  // 1. Get the new schema name from the .env file
  const schemaName = process.env.DB_SCHEMA;

  if (!schemaName || schemaName === 'public') {
    console.error('❌ ERROR: You must add DB_SCHEMA=my_private_database to your .env file first!');
    process.exit(1);
  }

  try {
    console.log(`Creating your private section: "${schemaName}"...`);
    
    // 2. Create the invisible schema wall
    await pool.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);

    // 3. Find all tables in the public database
    const { rows } = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);

    // 4. Clone the structure of every table into your private section (without copying the data)
    for (const row of rows) {
      const table = row.table_name;
      console.log(`- Setting up table: ${table}`);
      await pool.query(`CREATE TABLE IF NOT EXISTS ${schemaName}.${table} (LIKE public.${table} INCLUDING ALL)`);
    }

    console.log('\n✅ SUCCESS: Your private database is completely set up!');
    console.log('You can now restart your backend server. All your messages will be saved here securely.');
    
  } catch (error) {
    console.error('\n❌ ERROR setting up private database:', error.message);
  } finally {
    pool.end();
  }
}

setupPrivateDatabase();
