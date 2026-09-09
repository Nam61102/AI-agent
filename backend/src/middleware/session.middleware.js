const auth = require('../whatsapp/whatsapp.auth');

function sessionMiddleware(req, res, next) {
  // Extract session ID from headers or query parameters
  const rawSessionId = req.headers['x-session-id'] || req.query.sessionId || req.query.session_id || 'default';
  req.sessionId = String(rawSessionId).trim();

  // Try to resolve account_jid from active WhatsApp client or persisted session owner
  const whatsappClient = require('../whatsapp/whatsapp.client');
  const activeJid = typeof whatsappClient.getConnectedJid === 'function' 
    ? whatsappClient.getConnectedJid(req.sessionId) 
    : null;
    
  const savedOwner = auth.getSessionOwner(req.sessionId);
  const anyConnected = typeof whatsappClient.getAnyConnectedJid === 'function'
    ? whatsappClient.getAnyConnectedJid()
    : null;

  req.accountJid = activeJid || savedOwner || anyConnected || `session_${req.sessionId}`;

  next();
}

module.exports = sessionMiddleware;
module.exports.sessionMiddleware = sessionMiddleware;
