const supabase = require('./src/config/supabase');
const relationshipService = require('./src/services/relationship.service');

async function processAllContacts() {
  const accountJid = '917030513050@s.whatsapp.net';
  console.log('Fetching contacts for new account...');
  const { rows: contacts } = await supabase.query(`SELECT jid FROM contacts WHERE account_jid = $1`, [accountJid]);
  
  console.log(`Found ${contacts.length} contacts. Analyzing relationships...`);
  for (const c of contacts) {
    try {
      await relationshipService.analyzeContact(c.jid, accountJid);
      console.log('Analyzed', c.jid);
    } catch (e) {
      console.log(`Error analyzing ${c.jid}: ${e.message}`);
    }
  }
  console.log('Done!');
  process.exit(0);
}

processAllContacts();
