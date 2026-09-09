const { GoogleGenerativeAI } = require('@google/generative-ai');
const { PROFILE_PROMPT } = require('./profile.prompt');
require('dotenv').config();

let genAI = null;
if (process.env.GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}

// Keep the old prompt but add the new fields the user requested
const GEMINI_SYSTEM_PROMPT = `
You are an AI assistant that strictly analyzes chat histories for explicitly stated preferences.
CRITICAL RULES FOR EXTRACTION:
1. ONLY extract a "like" or "dislike" if the person EXPLICITLY states it (e.g., "I love pizza", "I hate waking up early", "I don't like horror movies").
2. DO NOT extract inferred or trivial behaviors as likes/dislikes (e.g. do NOT extract "Photo sharing", "Using WhatsApp on a laptop", "Video content", "Hugging emojis"). If it's just an action they took, IGNORE IT.
3. Keep the extracted item short and concise (e.g. "Pizza", "Waking up early").
4. If there are no explicitly stated likes or dislikes, return an empty array [].

Extract the following information and return ONLY a JSON object:
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
    if (!genAI) {
      console.warn('[ProfileService] GEMINI_API_KEY not configured.');
      return { success: false, error: 'API key not configured' };
    }

    // With Gemini 1.5 Flash we don't need small chunks! 
    // We can send the entire message history at once.
    console.log(`[ProfileService] Analyzing all ${messages.length} messages using Gemini 1.5 Flash...`);

    const formattedHistory = messages
      .map(m => `[${new Date(m.timestamp).toLocaleDateString()} ${new Date(m.timestamp).toLocaleTimeString()}] ${m.from_me ? 'You' : 'Contact'}: ${m.text}`)
      .join('\n');

    const prompt = `${GEMINI_SYSTEM_PROMPT}\n\nChat History:\n${formattedHistory}`;

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.3,
        }
      });
      
      const responseText = result.response.text();
      const parsed = JSON.parse(responseText);
      
      // Ensure all arrays exist
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
      console.error('[ProfileService] Gemini Analysis failed:', err.message);
      return { success: false, error: err.message };
    }
  }

  async extractHistoryInChunks(messages) {
    if (!genAI) {
      return { success: false, error: 'API key not configured' };
    }

    console.log(`[ProfileService] Extracting actions from ${messages.length} messages using Gemini 1.5 Flash...`);

    const formattedHistory = messages
      .map(m => `[${new Date(m.timestamp).toLocaleDateString()} ${new Date(m.timestamp).toLocaleTimeString()}] ${m.from_me ? 'You' : 'Contact'}: ${m.text}`)
      .join('\n');

    const prompt = `You are an AI assistant that strictly outputs JSON action items.
Analyze this chat history. Extract any action items, tasks, meetings, or follow-ups. ONLY extract items that seem unexpired, unresolved, or generally relevant. Ignore extremely old or clearly expired tasks. 
Return a JSON object: { "extractions": [{ "type": "task"|"meeting"|"event", "title": "string", "status": "pending", "importance": "medium"|"high" }] }

Chat History:
${formattedHistory}`;

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.3,
        }
      });
      
      const parsed = JSON.parse(result.response.text());
      return { success: true, data: parsed.extractions || [] };
    } catch (err) {
      console.error('[ProfileService] Gemini Extraction failed:', err.message);
      return { success: false, error: err.message };
    }
  }
}

module.exports = new ProfileService();
