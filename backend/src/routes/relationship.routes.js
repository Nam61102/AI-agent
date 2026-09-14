const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const relationshipService = require('../services/relationship.service');
const sessionMiddleware = require('../middleware/session.middleware');

router.use(sessionMiddleware);

router.get('/:jid', async (req, res) => {
  try {
    const jid = req.params.jid;
    const accountJid = req.accountJid;
    
    // Fetch individual metrics
    const result = await supabase.query(
      `SELECT m.factor, m.value 
       FROM contact_metrics m 
       JOIN contacts c ON m.contact_id = c.id 
       WHERE c.jid = $1 AND c.account_jid = $2`,
      [jid, accountJid]
    );
    
    // Calculate live composite score
    const compositeScore = await relationshipService.computeCompositeScore(jid, accountJid);
    
    const factors = {};
    result.rows.forEach(r => {
      factors[r.factor] = r.value;
    });

    res.json({
      success: true,
      compositeScore,
      factors
    });
  } catch (error) {
    console.error('[RelationshipRoute] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Manual trigger for testing
router.post('/:jid/analyze', async (req, res) => {
  try {
    const jid = req.params.jid;
    const accountJid = req.accountJid;
    const score = await relationshipService.analyzeContact(jid, accountJid);
    res.json({ success: true, score });
  } catch (error) {
    console.error('[RelationshipRoute] Analyze error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
