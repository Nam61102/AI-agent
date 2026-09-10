const auth = require('../whatsapp/whatsapp.auth');

function sessionMiddleware(req, res, next) {
  // Extract session ID from headers or query parameters
  const sessionId = req.headers['x-session-id'] || req.query.sessionId || 'default';
  req.sessionId = String(sessionId).trim();

  // Try to resolve account_jid from active WhatsApp client or persisted session owner
  const whatsappClient = require('../whatsapp/whatsapp.client');
  const activeJid = typeof whatsappClient.getConnectedJid === 'function' 
    ? whatsappClient.getConnectedJid(req.sessionId) 
    : null;
    
  const savedOwner = auth.getSessionOwner(req.sessionId);
  req.accountJid = activeJid || savedOwner || (req.sessionId === 'default' ? (auth.getSessionOwner('default') || 'session_default') : `session_${req.sessionId}`);

  next();
}

module.exports = sessionMiddleware;
module.exports.sessionMiddleware = sessionMiddleware;
