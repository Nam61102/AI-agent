// Persistent client session manager
const SESSION_STORAGE_KEY = 'nryn_client_session_id';

let inMemorySessionId: string | null = null;

function generateSessionId(): string {
  const randomPart = Math.random().toString(36).substring(2, 10);
  const timePart = Date.now().toString(36);
  return `session_${randomPart}_${timePart}`;
}

export function getSessionId(): string {
  if (inMemorySessionId) {
    return inMemorySessionId;
  }

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem(SESSION_STORAGE_KEY);
      if (stored && stored.trim() !== '') {
        inMemorySessionId = stored.trim();
        return inMemorySessionId;
      }
      const newId = generateSessionId();
      window.localStorage.setItem(SESSION_STORAGE_KEY, newId);
      inMemorySessionId = newId;
      return inMemorySessionId;
    }
  } catch (err) {
    console.warn('[SessionService] localStorage unavailable, using in-memory session', err);
  }

  if (!inMemorySessionId) {
    inMemorySessionId = generateSessionId();
  }
  return inMemorySessionId;
}

export function resetSessionId(): string {
  const newId = generateSessionId();
  inMemorySessionId = newId;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(SESSION_STORAGE_KEY, newId);
    }
  } catch (err) {
    console.warn('[SessionService] Failed to persist new session ID to localStorage', err);
  }
  return newId;
}

export function getAuthHeaders(): Record<string, string> {
  return {
    'x-session-id': getSessionId()
  };
}
