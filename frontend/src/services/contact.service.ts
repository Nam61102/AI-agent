import { getAuthHeaders } from './session.service';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL as string || 'http://localhost:3000';
const API_BASE_URL = `${BACKEND_URL}/api`;

export const contactService = {
  getAllContacts: async (search?: string) => {
    const url = search ? `${API_BASE_URL}/contacts/all?search=${encodeURIComponent(search)}` : `${API_BASE_URL}/contacts/all`;
    const res = await fetch(url, { headers: getAuthHeaders() });
    const json = await res.json();
    return json.data || [];
  },
  searchContacts: async (search: string) => {
    const res = await fetch(`${API_BASE_URL}/contacts/all?search=${encodeURIComponent(search)}`, {
      headers: getAuthHeaders()
    });
    const json = await res.json();
    return json.data || [];
  },
  getTopContacts: async (limit = 10) => {
    const res = await fetch(`${API_BASE_URL}/contacts/top?limit=${limit}`, {
      headers: getAuthHeaders()
    });
    const json = await res.json();
    return json.data || [];
  },
  analyzeProfile: async (jid: string) => {
    const res = await fetch(`${API_BASE_URL}/contacts/${encodeURIComponent(jid)}/analyze-profile`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    const json = await res.json();
    return json.data;
  },
  getRelationshipData: async (jid: string) => {
    const res = await fetch(`${API_BASE_URL}/relationship/${encodeURIComponent(jid)}`, {
      headers: getAuthHeaders()
    });
    const json = await res.json();
    return json;
  },
  analyzeRelationship: async (jid: string) => {
    const res = await fetch(`${API_BASE_URL}/relationship/${encodeURIComponent(jid)}/analyze`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    const json = await res.json();
    return json;
  },
  getAlerts: async () => {
    const res = await fetch(`${API_BASE_URL}/alerts`, {
      headers: getAuthHeaders()
    });
    const json = await res.json();
    return json.success ? json.alerts : [];
  }
};
