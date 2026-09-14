const supabase = require('./src/config/supabase');
const messageProcessor = require('./src/services/message-processor.service');
const contactService = require('./src/services/contact.service');

async function test() {
  const accountJid = '917030513050@s.whatsapp.net';
  const chatJid = '917038128870@s.whatsapp.net';

  const contact = await contactService.findOrCreateContact({ jid: chatJid, name: 'Adu', accountJid });
  
  const res = await supabase.query(`
    INSERT INTO messages (
      contact_id, chat_jid, sender_jid, from_me, timestamp, text, message_type, has_media, account_jid
    ) VALUES (
      $1, $2, $3, false, NOW(), 'happy birthaday baby', 'text', false, $4
    ) RETURNING *
  `, [contact.id, chatJid, chatJid, accountJid]);
  
  console.log('Inserted:', res.rows[0]);
  
  console.log('Processing via AI...');
  await messageProcessor.process(res.rows[0]);
  
  // Wait a few seconds for AI to finish
  await new Promise(r => setTimeout(r, 8000));
  
  const acts = await supabase.query(`SELECT * FROM ai_actions WHERE source_message_id = $1`, [res.rows[0].id]);
  console.log('Generated AI action:', acts.rows[0]);
  
  const exts = await supabase.query(`SELECT * FROM extractions WHERE source_message_id = $1`, [res.rows[0].id]);
  console.log('Generated extraction:', exts.rows[0]);

  process.exit(0);
}
test();
