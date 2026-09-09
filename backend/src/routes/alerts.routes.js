const express = require('express');
const router = express.Router();
const pool = require('../config/supabase');
const { sessionMiddleware } = require('../middleware/session.middleware');

router.use(sessionMiddleware);

router.get('/', async (req, res) => {
  try {
    const accountJid = req.accountJid;
    const { rows: contacts } = await pool.query(
      'SELECT jid, name, profile_data FROM contacts WHERE profile_data IS NOT NULL AND account_jid = $1',
      [accountJid]
    );
    
    let upcomingAlerts = [];
    
    contacts.forEach(c => {
      const data = typeof c.profile_data === 'string' ? JSON.parse(c.profile_data) : c.profile_data;
      
      const checkAndPush = (type, items) => {
        if (!items || !Array.isArray(items)) return;
        items.forEach(item => {
          upcomingAlerts.push({
            type,
            contactName: c.name || 'Unknown',
            contactJid: c.jid,
            description: item.item
          });
        });
      };
      
      checkAndPush('birthday', data.birthdays);
      checkAndPush('anniversary', data.anniversaries);
      checkAndPush('event', data.events);
      checkAndPush('important', data.important);
    });

    res.json({ success: true, alerts: upcomingAlerts });
  } catch (err) {
    console.error('Failed to get alerts:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
