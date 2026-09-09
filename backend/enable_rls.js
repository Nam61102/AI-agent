require('dotenv').config();
const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DIRECT_URL
});

async function enableRLS() {
  try {
    await client.connect();
    
    console.log('Enabling RLS on exposed tables...');
    
    // Enable RLS on the identified tables
    await client.query(`ALTER TABLE public.ai_actions ENABLE ROW LEVEL SECURITY;`);
    console.log('✅ RLS enabled on "ai_actions"');
    
    await client.query(`ALTER TABLE public.contact_preferences ENABLE ROW LEVEL SECURITY;`);
    console.log('✅ RLS enabled on "contact_preferences"');
    
    await client.query(`ALTER TABLE public.suggested_replies ENABLE ROW LEVEL SECURITY;`);
    console.log('✅ RLS enabled on "suggested_replies"');
    
    console.log('\\nAll exposed tables now have RLS enabled.');
    console.log('The Supabase Critical warning should be resolved.');
  } catch (err) {
    console.error('Error enabling RLS:', err);
  } finally {
    await client.end();
  }
}

enableRLS();
