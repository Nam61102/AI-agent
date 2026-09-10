const lidToJidMap = new Map();

// Known default mappings
lidToJidMap.set('217256709591222', '917030513050@s.whatsapp.net');
lidToJidMap.set('217256709591222@lid', '917030513050@s.whatsapp.net');

function registerLidMapping(lid, realJid) {
  if (!lid || !realJid) return;
  const cleanedLid = String(lid).replace(/[\s+-]/g, '');
  const cleanedJid = String(realJid).replace(/[\s+-]/g, '');
  const lidNum = cleanedLid.split('@')[0].split(':')[0];
  const realNum = cleanedJid.split('@')[0].split(':')[0];
  
  if (lidNum && realNum && lidNum !== realNum && realNum.length >= 10 && realNum.length <= 15) {
    const canonicalReal = realNum + '@s.whatsapp.net';
    lidToJidMap.set(lidNum, canonicalReal);
    lidToJidMap.set(lidNum + '@lid', canonicalReal);
    lidToJidMap.set(cleanedLid, canonicalReal);
  }
}

function getCanonicalJid(jid) {
  if (!jid) return '';
  let cleaned = String(jid).replace(/[\s+-]/g, '');
  const parts = cleaned.split('@');
  let number = parts[0].split(':')[0]; // Strip device ID (e.g. 1234:2 -> 1234)
  const suffix = parts.length > 1 ? parts[1] : '';
  
  if (lidToJidMap.has(cleaned)) {
    return lidToJidMap.get(cleaned);
  }
  if (lidToJidMap.has(number)) {
    return lidToJidMap.get(number);
  }
  if (lidToJidMap.has(number + '@lid')) {
    return lidToJidMap.get(number + '@lid');
  }

  if (suffix === 'g.us' || suffix === 'newsletter' || suffix === 'broadcast') {
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
  formatPhoneNumber,
  registerLidMapping,
  lidToJidMap
};
