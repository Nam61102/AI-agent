const supabase = require('../config/supabase');

/**
 * Completely wipes all database records associated with a given account JID.
 * Triggered on WhatsApp disconnect or logout event.
 * 
 * @param {string} accountJid - The WhatsApp owner JID (e.g. '917038128870@s.whatsapp.net')
 */
async function wipeAccountData(accountJid) {
  if (!accountJid) {
    console.warn('[AccountCleanup] Warning: No accountJid provided for data wipe.');
    return { success: false, reason: 'NO_ACCOUNT_JID' };
  }

  console.log(`[AccountCleanup] Starting complete database data wipe for account [${accountJid}]...`);

  try {
    // 1. Delete AI Action Cards
    const resActions = await supabase.query('DELETE FROM ai_actions WHERE account_jid = $1', [accountJid]);

    // 2. Delete Suggested Replies
    const resReplies = await supabase.query('DELETE FROM suggested_replies WHERE account_jid = $1', [accountJid]);

    // 3. Delete Extractions (entities, preferences)
    const resExtractions = await supabase.query('DELETE FROM extractions WHERE account_jid = $1', [accountJid]);

    // 4. Delete Nudges & Reminders
    const resNudges = await supabase.query('DELETE FROM nudges WHERE account_jid = $1', [accountJid]);

    // 5. Delete Quotes
    const resQuotes = await supabase.query('DELETE FROM quotes WHERE account_jid = $1', [accountJid]);

    // 6. Delete Chat Messages
    const resMessages = await supabase.query('DELETE FROM messages WHERE account_jid = $1', [accountJid]);

    // 7. Delete Contact Metrics (Score factors linked to account contacts)
    const resMetrics = await supabase.query(
      'DELETE FROM contact_metrics WHERE contact_id IN (SELECT id FROM contacts WHERE account_jid = $1)',
      [accountJid]
    );

    // 8. Delete Cadence entries linked to account contacts
    const resCadence = await supabase.query(
      'DELETE FROM cadence WHERE contact_id IN (SELECT id FROM contacts WHERE account_jid = $1)',
      [accountJid]
    );

    // 9. Delete Contact Preferences linked to account contacts
    const resPrefs = await supabase.query(
      'DELETE FROM contact_preferences WHERE contact_id IN (SELECT id FROM contacts WHERE account_jid = $1)',
      [accountJid]
    );

    // 10. Delete Contacts belonging to account
    const resContacts = await supabase.query('DELETE FROM contacts WHERE account_jid = $1', [accountJid]);

    console.log(
      `✓ [AccountCleanup] Successfully deleted data for account [${accountJid}]: ` +
      `${resMessages.rowCount || 0} msgs, ${resContacts.rowCount || 0} contacts, ` +
      `${resActions.rowCount || 0} AI actions, ${resReplies.rowCount || 0} suggested replies.`
    );

    return {
      success: true,
      accountJid,
      deletedCount: {
        actions: resActions.rowCount || 0,
        replies: resReplies.rowCount || 0,
        extractions: resExtractions.rowCount || 0,
        nudges: resNudges.rowCount || 0,
        quotes: resQuotes.rowCount || 0,
        messages: resMessages.rowCount || 0,
        metrics: resMetrics.rowCount || 0,
        cadence: resCadence.rowCount || 0,
        preferences: resPrefs.rowCount || 0,
        contacts: resContacts.rowCount || 0
      }
    };
  } catch (error) {
    console.error(`❌ [AccountCleanup] Error during database wipe for [${accountJid}]:`, error.message);
    throw error;
  }
}

module.exports = {
  wipeAccountData
};
