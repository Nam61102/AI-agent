const express = require('express');
const router = express.Router();
const controller = require('../controllers/whatsapp.controller');
const sessionMiddleware = require('../middleware/session.middleware');

router.use(sessionMiddleware);

router.post('/connect', controller.connect);
router.post('/pairing-code', controller.requestPairingCode);
router.get('/status', controller.getStatus);
router.post('/disconnect', controller.disconnect);
router.get('/qr', controller.getQR);
router.get('/chats', controller.getChats);
router.post('/send-message', controller.sendMessage);
router.post('/send', controller.sendMessage);
router.get('/current-contacts', controller.getCurrentContacts);
router.get('/recent-chats', controller.getRecentChats);
router.get('/chat-messages/:jid', controller.getChatMessages);

module.exports = router;
