const express = require('express');
const router = express.Router();
const controller = require('../controllers/whatsapp.controller');

router.post('/connect', controller.connect);
router.post('/pairing-code', controller.requestPairingCode);
router.get('/status', controller.getStatus);
router.post('/disconnect', controller.disconnect);
router.get('/qr', controller.getQR);
router.get('/chats', controller.getChats);
router.post('/send-message', controller.sendMessage);
router.get('/current-contacts', controller.getCurrentContacts);
router.get('/recent-chats', controller.getRecentChats);
router.get('/chat-messages/:jid', controller.getChatMessages);

module.exports = router;
