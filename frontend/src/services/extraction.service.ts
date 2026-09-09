import { getAuthHeaders } from './session.service';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL as string || 'http://localhost:3000';

export interface ExtractionPayload {
  description?: string;
  due_date?: string;
  title?: string;
  date?: string;
  time?: string;
  location?: string;
  event?: string;
  item?: string;
  amount?: number;
  currency?: string;
  vendor?: string;
  [key: string]: any;
}

export interface Extraction {
  id: number;
  type: 'life_event' | 'task' | 'meeting' | 'quote' | 'invoice' | 'lead' | 'gift_hint' | 'location_hint';
  status: 'active' | 'needs_review';
  confidence: number;
  payload: ExtractionPayload;
  contact_id?: number;
  source_message_id?: number;
  sender_jid?: string;
  chat_jid?: string;
  chat_name?: string;
  sender_name?: string;
  extracted_at: string;
  suggested_reply?: string;
  reply_reason?: string;
  reply_tone?: string;
}

export interface ExtractionFilters {
  type?: string;
  status?: string;
  contact_id?: number;
}

class ExtractionService {
  async getExtractions(filters?: ExtractionFilters): Promise<Extraction[]> {
    try {
      let url = `${BACKEND_URL}/api/extractions?`;
      if (filters?.type) url += `type=${filters.type}&`;
      if (filters?.status) url += `status=${filters.status}&`;
      if (filters?.contact_id) url += `contact_id=${filters.contact_id}&`;

      const response = await fetch(url, { headers: getAuthHeaders() });
      const data = await response.json();
      if (data.success && Array.isArray(data.data)) {
        return data.data;
      }
      return [];
    } catch (error) {
      console.error('[ExtractionService] Error fetching extractions:', error);
      throw error;
    }
  }

  async getExtractionById(id: number): Promise<Extraction | null> {
    try {
      const response = await fetch(`${BACKEND_URL}/api/extractions/${id}`, {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      if (data.success && data.data) {
        return data.data;
      }
      return null;
    } catch (error) {
      console.error(`[ExtractionService] Error fetching extraction ${id}:`, error);
      throw error;
    }
  }

  async getSourceMessage(messageId: number): Promise<{ text: string } | null> {
    try {
      const response = await fetch(`${BACKEND_URL}/api/extractions/source-message/${messageId}`, {
        headers: getAuthHeaders()
      });
      if (!response.ok) return null;
      const data = await response.json();
      if (data.success && data.data) {
        return data.data;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  async confirmExtraction(id: number): Promise<boolean> {
    try {
      const response = await fetch(`${BACKEND_URL}/api/extractions/${id}/confirm`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (!response.ok) {
        return false;
      }
      const data = await response.json();
      return Boolean(data.success);
    } catch (error) {
      return false;
    }
  }

  async rejectExtraction(id: number): Promise<boolean> {
    try {
      const response = await fetch(`${BACKEND_URL}/api/extractions/${id}/reject`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (!response.ok) {
        return false;
      }
      const data = await response.json();
      return Boolean(data.success);
    } catch (error) {
      return false;
    }
  }
}

export const extractionService = new ExtractionService();
