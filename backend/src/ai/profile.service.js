const OpenAI = require('openai');
const { PROFILE_PROMPT } = require('./profile.prompt');
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
  fallbackModels = [
    primaryModel,
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
    'groq/compound',
    'groq/compound-mini',
    'qwen/qwen3.8-27b',
    'qwen/qwen3.6-27b'
  ].filter((model, index, models) => models.indexOf(model) === index);
} else if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  primaryModel = process.env.AI_MODEL || 'gpt-4o-mini';
  fallbackModels = [primaryModel, 'gpt-4o', 'gpt-3.5-turbo'];
}

class ProfileService {
  async analyzeProfile(messages) {
    if (!openai) {
      console.warn('[ProfileService] API key not configured.');
      return { success: false, error: 'API key not configured' };
    }

    const formattedHistory = messages
      .map(m => `[${new Date(m.timestamp).toLocaleTimeString()}] ${m.from_me ? 'You' : 'Contact'}: ${m.text}`)
      .join('\n');

    let lastError = null;
    for (const model of fallbackModels) {
      try {
        const response = await openai.chat.completions.create({
          model,
          messages: [
            { role: 'system', content: PROFILE_PROMPT },
            { role: 'user', content: `Analyze this chat history:\n\n${formattedHistory}` }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.3,
          max_tokens: 500,
        });

        const responseContent = response.choices[0]?.message?.content;
        if (!responseContent) return { success: false, error: 'AI returned an empty response' };

        const parsed = JSON.parse(responseContent);
        return { success: true, data: parsed };
      } catch (error) {
        lastError = error;
        console.warn(`[ProfileService] Model '${model}' failed: ${error.message}`);
      }
    }

    console.error('[ProfileService] All profile analysis models failed:', lastError?.message);
    return { success: false, error: lastError?.message || 'Profile analysis failed' };
  }
}

module.exports = new ProfileService();
