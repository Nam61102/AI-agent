const express = require('express');
const router = express.Router();
const controller = require('../controllers/ai.controller');
const sessionMiddleware = require('../middleware/session.middleware');

router.use(sessionMiddleware);

router.get('/actions', controller.getActions);
router.get('/actions/:id', controller.getActionById);
router.patch('/actions/:id/dismiss', controller.dismissAction);
router.get('/summary', controller.getDashboardSummary);
router.post('/analyze-active', controller.analyzeActiveChats);
router.post('/suggest-reply', controller.suggestReply);

module.exports = router;
