const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL as string;

export interface AIAction {
  id: number;
  type: 'reply_needed' | 'follow_up' | 'birthday';
  title: string;
  description?: string;
  status: string;
  priority?: number;
  createdAt: string;
  contact: {
    id?: number;
    name: string;
    jid: string;
  };
  sourceMessage: {
    id: number;
    text: string;
    timestamp: string;
    fromMe?: boolean;
  };
  suggestedReply: {
    id?: number;
    text: string;
    reason?: string;
    tone?: string;
  };
}

export interface DashboardSummary {
  messagesLast24h: number;
  aiRepliesGenerated: number;
  activeConversations: number;
  pendingActions: number;
}

class AIService {
  async getActions(status = 'active'): Promise<AIAction[]> {
    try {
      const response = await fetch(`${BACKEND_URL}/api/ai/actions?status=${status}`);
      const data = await response.json();
      if (data.success && Array.isArray(data.actions)) {
        return data.actions;
      }
      return [];
    } catch (error) {
      console.error('[AIService] Error fetching actions:', error);
      return [];
    }
  }

  async getActionById(id: number): Promise<AIAction | null> {
    try {
      const response = await fetch(`${BACKEND_URL}/api/ai/actions/${id}`);
      const data = await response.json();
      if (data.success && data.action) {
        return data.action;
      }
      return null;
    } catch (error) {
      console.error(`[AIService] Error fetching action ${id}:`, error);
      return null;
    }
  }

  async dismissAction(id: number): Promise<boolean> {
    try {
      const response = await fetch(`${BACKEND_URL}/api/ai/actions/${id}/dismiss`, {
        method: 'PATCH'
      });
      const data = await response.json();
      return Boolean(data.success);
    } catch (error) {
      console.error(`[AIService] Error dismissing action ${id}:`, error);
      return false;
    }
  }

  async getDashboardSummary(): Promise<DashboardSummary | null> {
    try {
      const response = await fetch(`${BACKEND_URL}/api/dashboard/summary`);
      const data = await response.json();
      if (data.success && data.summary) {
        return data.summary;
      }
      return null;
    } catch (error) {
      console.error('[AIService] Error fetching dashboard summary:', error);
      return null;
    }
  }

  async analyzeActiveChats(): Promise<AIAction[]> {
    try {
      const response = await fetch(`${BACKEND_URL}/api/ai/analyze-active`, {
        method: 'POST'
      });
      const data = await response.json();
      if (data.success && Array.isArray(data.actions)) {
        return data.actions;
      }
      return [];
    } catch (error) {
      console.error('[AIService] Error analyzing active chats:', error);
      return [];
    }
  }
}

export const aiService = new AIService();
