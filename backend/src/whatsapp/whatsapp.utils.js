/**
 * WhatsApp Utilities for JID Canonicalization and Name Resolution
 */

function getCanonicalJid(jid) {
  if (!jid) return '';
  let cleaned = jid.replace(/[\s+-]/g, '');
  const parts = cleaned.split('@');
  let number = parts[0].split(':')[0]; // Strip device ID (e.g. 1234:2 -> 1234)
  const suffix = parts.length > 1 ? parts[1] : '';
  
  // Hardcoded map for known LIDs to Phone Numbers based on user feedback
  if (number === '217256709591222' && suffix === 'lid') {
    return '917030513050@s.whatsapp.net';
  }

  if (suffix === 'g.us' || suffix === 'newsletter' || suffix === 'lid' || suffix === 'broadcast') {
    return number + '@' + suffix;
  }
  return number + '@s.whatsapp.net';
}

function formatPhoneNumber(phoneRaw) {
  if (!phoneRaw) return '';
  const digits = phoneRaw.replace(/\D/g, '');
  
  if (digits.length === 12 && digits.startsWith('91')) {
    return '+91 ' + digits.slice(2, 7) + ' ' + digits.slice(7);
  } else if (digits.length === 11 && digits.startsWith('1')) {
    return '+1 (' + digits.slice(1, 4) + ') ' + digits.slice(4, 7) + '-' + digits.slice(7);
  } else if (digits.length > 8) {
    return '+' + digits.slice(0, 2) + ' ' + digits.slice(2, 6) + ' ' + digits.slice(6);
  }
  return '+' + digits;
}

module.exports = {
  getCanonicalJid,
  formatPhoneNumber
};
