const OpenAI = require('openai');
const { REPLY_PROMPT } = require('./reply.prompt');
require('dotenv').config();

let openai = null;
let primaryModel = process.env.AI_MODEL || 'gpt-4o-mini';
let fallbackModels = [primaryModel];

if (process.env.GROQ_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1',
  });
  primaryModel = process.env.AI_MODEL || 'openai/gpt-oss-120b';
  const groqCandidateModels = [
    primaryModel,
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
    'groq/compound',
    'groq/compound-mini',
    'qwen/qwen3.8-27b',
    'qwen/qwen3.6-27b'
  ];
  fallbackModels = [...new Set(groqCandidateModels.filter(Boolean))];
} else if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  primaryModel = process.env.AI_MODEL || 'gpt-4o-mini';
  fallbackModels = [primaryModel, 'gpt-4o', 'gpt-3.5-turbo'];
}

class ReplyService {
  /**
   * Generate contextual reply for a message using conversation history and contact context
   * @param {Object} params
   * @param {Object} params.contact - { name, jid, relationship, layer, is_group }
   * @param {Array} params.conversationHistory - [{ sender, from_me, text, timestamp }]
   * @param {Object} params.currentMessage - { id, sender, text, timestamp }
   * @returns {Promise<{success: boolean, data?: Object, isRateLimited?: boolean, error?: string}>}
   */
  async generateReply({ contact, conversationHistory = [], currentMessage }) {
    if (!openai) {
      console.warn('[ReplyService] AI API key not configured. Skipping reply generation.');
      return { success: false, error: 'AI API key not configured' };
    }

    if (!currentMessage || !currentMessage.text || currentMessage.text.trim() === '') {
      return { success: true, data: { needs_reply: false, action_type: 'none', suggested_reply: null, reason: 'Empty message' } };
    }

    // Build rich context payload
    const formattedHistory = conversationHistory
      .map(m => `[${new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}] ${m.sender}: ${m.text}`)
      .join('\n');

    const contactName = contact?.name || 'Contact';
    const userPrompt = `### CONTEXT
Contact Name: ${contactName} (${contact?.is_group ? 'WhatsApp Group' : 'Direct 1-on-1 Chat'})
${contact?.relationship ? `Relationship: ${contact.relationship}` : ''}

### CONVERSATION THREAD (Chronological order showing past language & tone patterns):
${formattedHistory || '(First message in this thread)'}

### LATEST INCOMING MESSAGE TO REPLY TO:
Sender: ${currentMessage.sender || contactName}
Timestamp: ${currentMessage.timestamp}
Message Content: "${currentMessage.text}"

### INSTRUCTIONS:
1. Detect the exact language (Hindi, Hinglish, Marathi, Romanized Marathi, English, Mixed slang) and tone (affectionate, playful, friendly, buddy, professional) from the chat history and latest message.
2. Reply in that EXACT matching language, dialect, and friendly energy.
3. If an event, task, schedule, plan, or birthday is found in the message, extract it into event_details and classify action_type appropriately.
4. Return valid JSON matching the schema.`;

    let lastError = null;
    let rateLimitedCount = 0;

    for (const model of fallbackModels) {
      try {
        const response = await openai.chat.completions.create({
          model: model,
          messages: [
            { role: 'system', content: REPLY_PROMPT },
            { role: 'user', content: userPrompt }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.35,
        });

        const responseContent = response.choices[0]?.message?.content;
        if (!responseContent) {
          return { success: true, data: null };
        }

        const parsed = JSON.parse(responseContent);
        return { success: true, data: parsed };
      } catch (error) {
        lastError = error;
        const is429 = error.status === 429 || 
                      (error.message && (error.message.includes('429') || 
                                        error.message.includes('Rate limit') || 
                                        error.message.includes('tokens per day')));
        
        if (is429) {
          rateLimitedCount++;
          console.warn(`[ReplyService] Model '${model}' rate limited: ${error.message}. Trying next fallback...`);
        } else {
          console.warn(`[ReplyService] Model '${model}' failed: ${error.message}`);
        }
      }
    }

    const allRateLimited = rateLimitedCount === fallbackModels.length;
    if (allRateLimited) {
      console.error(`[ReplyService] All available models hit rate limits. Last error: ${lastError?.message}`);
      return { success: false, isRateLimited: true, error: lastError?.message };
    }

    console.error(`[ReplyService] Reply generation failed across all models. Last error: ${lastError?.message}`);
    return { success: false, isRateLimited: false, error: lastError?.message };
  }
}

module.exports = new ReplyService();
