const API_BASE_URL = 'http://localhost:3000/api';

export const contactService = {
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
  }
};
