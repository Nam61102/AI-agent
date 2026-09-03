const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL as string;
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

      const response = await fetch(url);
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
      const response = await fetch(`${BACKEND_URL}/api/extractions/${id}`);
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

  // Attempt to fetch source message
  async getSourceMessage(messageId: number): Promise<{ text: string } | null> {
    try {
      const response = await fetch(`${BACKEND_URL}/api/extractions/source-message/${messageId}`);
      if (!response.ok) return null;
      const data = await response.json();
      if (data.success && data.data) {
        return data.data;
      }
      return null;
    } catch (error) {
      // Ignore errors for now as endpoint may be missing
      return null;
    }
  }

  // Confirm/Reject placeholders (UI buttons connect to these)
  async confirmExtraction(id: number): Promise<boolean> {
    try {
      const response = await fetch(`${BACKEND_URL}/api/extractions/${id}/confirm`, {
        method: 'POST'
      });
      if (!response.ok) {
        console.warn('Backend endpoint for confirming extraction may not be implemented yet.');
        return false;
      }
      const data = await response.json();
      return data.success;
    } catch (error) {
      console.warn('Backend endpoint for confirming extraction may not be implemented yet.');
      return false;
    }
  }

  async rejectExtraction(id: number): Promise<boolean> {
    try {
      const response = await fetch(`${BACKEND_URL}/api/extractions/${id}/reject`, {
        method: 'POST'
      });
      if (!response.ok) {
        console.warn('Backend endpoint for rejecting extraction may not be implemented yet.');
        return false;
      }
      const data = await response.json();
      return data.success;
    } catch (error) {
      console.warn('Backend endpoint for rejecting extraction may not be implemented yet.');
      return false;
    }
  }
}

export const extractionService = new ExtractionService();
