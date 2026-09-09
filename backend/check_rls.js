const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DIRECT_URL
});

async function main() {
  await client.connect();
  const res = await client.query(`
    SELECT
        schemaname,
        tablename,
        rowsecurity
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename;
  `);
  console.table(res.rows);
  
  const res2 = await client.query(`
    SELECT
        schemaname,
        tablename,
        policyname,
        permissive,
        roles,
        cmd
    FROM pg_policies
    WHERE schemaname = 'public'
    ORDER BY tablename;
  `);
  console.log('Policies:');
  console.table(res2.rows);

  await client.end();
}

main().catch(console.error);
