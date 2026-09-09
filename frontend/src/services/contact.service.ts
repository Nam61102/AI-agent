const API_BASE_URL = 'http://localhost:3000/api';

export const contactService = {
  getAllContacts: async () => {
    const res = await fetch(`${API_BASE_URL}/contacts/all`);
    const json = await res.json();
    return json.data || [];
  },
  getTopContacts: async (limit = 10) => {
    const res = await fetch(`${API_BASE_URL}/contacts/top?limit=${limit}`);
    const json = await res.json();
    return json.data || [];
  },
  analyzeProfile: async (jid: string) => {
    const res = await fetch(`${API_BASE_URL}/contacts/${encodeURIComponent(jid)}/analyze-profile`, {
      method: 'POST'
    });
    const json = await res.json();
    return json.data;
  },
  getRelationshipData: async (jid: string) => {
    const res = await fetch(`${API_BASE_URL}/relationship/${encodeURIComponent(jid)}`);
    const json = await res.json();
    return json;
  },
  getAlerts: async () => {
    const res = await fetch(`${API_BASE_URL}/alerts`);
    const json = await res.json();
    return json.success ? json.alerts : [];
  }
};
