const OpenAI = require('openai');
const { PROFILE_PROMPT } = require('./profile.prompt');
require('dotenv').config();

let openai = null;
const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;

if (apiKey) {
  openai = new OpenAI({
    apiKey: apiKey,
    baseURL: process.env.OPENROUTER_API_KEY ? 'https://openrouter.ai/api/v1' : undefined,
    defaultHeaders: process.env.OPENROUTER_API_KEY ? {
      'HTTP-Referer': 'https://nryn.ai',
      'X-Title': 'NRYN AI Assistant'
    } : undefined
  });
}

const primaryModel = process.env.AI_MODEL || 'google/gemini-2.5-flash';

const GEMINI_SYSTEM_PROMPT = `
You are an AI assistant that strictly analyzes chat histories to extract the preferences of the 'Contact'.
CRITICAL RULES FOR EXTRACTION:
1. ONLY extract likes, dislikes, or interests stated by the 'Contact'. 
2. IGNORE any preferences, likes, or dislikes stated by 'You'. We only want to profile the 'Contact'.
3. ONLY extract a "like" or "dislike" if the Contact EXPLICITLY states it (e.g., "I love pizza", "I hate waking up early").
4. DO NOT extract inferred or trivial behaviors.
5. Keep the extracted item short and concise (e.g. "Pizza", "Waking up early").
6. If the Contact has no explicitly stated likes or dislikes, return an empty array [].

Extract the following information for the 'Contact' and return ONLY a JSON object:
{
  "likes": [{ "item": "string", "confidence": 0-100 }],
  "dislikes": [{ "item": "string", "confidence": 0-100 }],
  "interests": [{ "item": "string", "confidence": 0-100 }],
  "birthdays": [{ "item": "string (person/date)", "confidence": 0-100 }],
  "anniversaries": [{ "item": "string (person/date)", "confidence": 0-100 }],
  "events": [{ "item": "string (upcoming or past event)", "confidence": 0-100 }],
  "important": [{ "item": "string (any other important life details)", "confidence": 0-100 }]
}
`;

class ProfileService {
  async analyzeProfileInChunks(messages) {
    if (!openai) {
      console.warn('[ProfileService] AI API key not configured.');
      return { success: false, error: 'API key not configured' };
    }

    console.log(`[ProfileService] Analyzing all ${messages.length} messages using ${primaryModel}...`);

    const formattedHistory = messages
      .map(m => `[${new Date(m.timestamp).toLocaleDateString()} ${new Date(m.timestamp).toLocaleTimeString()}] ${m.from_me ? 'You' : 'Contact'}: ${m.text}`)
      .join('\n');

    const prompt = `${GEMINI_SYSTEM_PROMPT}\n\nChat History:\n${formattedHistory}`;

    try {
      const response = await openai.chat.completions.create({
        model: primaryModel,
        messages: [
          { role: 'system', content: 'You are an AI assistant that strictly outputs JSON.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3
      });

      const responseText = response.choices[0]?.message?.content;
      const parsed = JSON.parse(responseText);

      return {
        success: true,
        data: {
          likes: parsed.likes || [],
          dislikes: parsed.dislikes || [],
          interests: parsed.interests || [],
          birthdays: parsed.birthdays || [],
          anniversaries: parsed.anniversaries || [],
          events: parsed.events || [],
          important: parsed.important || []
        }
      };
    } catch (err) {
      console.error('[ProfileService] Analysis failed:', err.message);
      return { success: false, error: err.message };
    }
  }

  async extractHistoryInChunks(messages) {
    if (!openai) {
      return { success: false, error: 'API key not configured' };
    }

    console.log(`[ProfileService] Extracting actions from ${messages.length} messages using ${primaryModel}...`);

    const formattedHistory = messages
      .map(m => `[${new Date(m.timestamp).toLocaleDateString()} ${new Date(m.timestamp).toLocaleTimeString()}] ${m.from_me ? 'You' : 'Contact'}: ${m.text}`)
      .join('\n');

    const prompt = `You are an AI assistant that strictly outputs JSON action items.
Analyze this chat history. Extract any action items, tasks, meetings, or follow-ups. ONLY extract items that seem unexpired, unresolved, or generally relevant. Ignore extremely old or clearly expired tasks. 
Return a JSON object: { "extractions": [{ "type": "task"|"meeting"|"event", "title": "string", "status": "pending", "importance": "medium"|"high" }] }

Chat History:
${formattedHistory}`;

    try {
      const response = await openai.chat.completions.create({
        model: primaryModel,
        messages: [
          { role: 'system', content: 'You are an AI assistant that strictly outputs JSON.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3
      });

      const parsed = JSON.parse(response.choices[0]?.message?.content);
      return { success: true, data: parsed.extractions || [] };
    } catch (err) {
      console.error('[ProfileService] Extraction failed:', err.message);
      return { success: false, error: err.message };
    }
  }
}

module.exports = new ProfileService();
