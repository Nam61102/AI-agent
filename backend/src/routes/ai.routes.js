const express = require('express');
const router = express.Router();
const controller = require('../controllers/ai.controller');

router.get('/actions', controller.getActions);
router.get('/actions/:id', controller.getActionById);
router.patch('/actions/:id/dismiss', controller.dismissAction);
router.get('/summary', controller.getDashboardSummary);
router.post('/analyze-active', controller.analyzeActiveChats);

module.exports = router;
