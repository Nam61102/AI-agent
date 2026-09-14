const supabase = require('./src/config/supabase');
async function check() {
  const accountJid = '917038128870@s.whatsapp.net';
  const query = `SELECT e.*, m.text AS source_text, m.sender_jid, m.chat_jid,
        sr.suggested_reply, sr.reason AS reply_reason, sr.tone AS reply_tone,
        chat.name AS db_chat_name,
        sender.name AS db_sender_name,
        m.from_me
      FROM extractions e
      LEFT JOIN messages m ON m.id = e.source_message_id
      LEFT JOIN contacts sender ON sender.jid = m.sender_jid AND sender.account_jid = $1
      LEFT JOIN contacts chat ON chat.jid = m.chat_jid AND chat.account_jid = $1
      LEFT JOIN suggested_replies sr ON sr.source_message_id = m.id AND sr.status = 'pending' AND sr.account_jid = $1
      WHERE e.account_jid = $1
      AND e.type NOT IN ('none', 'ai_auto_reply') 
      AND e.confidence >= 0.90
      AND (m.chat_jid IS NULL OR (m.chat_jid NOT LIKE '%@newsletter' AND m.chat_jid NOT LIKE '%@lid'))`;
  const res = await supabase.query(query, [accountJid]);
  console.log(JSON.stringify(res.rows, null, 2));
  process.exit(0);
}
check();
