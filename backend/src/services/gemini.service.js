const OpenAI = require('openai');
require('dotenv').config();

let client = null;
const apiKey = process.env.OPENROUTER_API_KEY || process.env.GEMINI_API_KEY;

if (apiKey) {
  client = new OpenAI({
    apiKey: apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      'HTTP-Referer': 'https://nryn.ai',
      'X-Title': 'NRYN AI Assistant'
    }
  });
}

async function getGeminiChatCompletion(prompt, systemInstruction = 'You are a helpful AI. Return ONLY JSON.') {
  if (!client) {
    throw new Error('OPENROUTER_API_KEY is not configured');
  }

  const model = process.env.AI_MODEL || 'google/gemini-2.5-flash';

  const response = await client.chat.completions.create({
    model: model,
    messages: [
      { role: 'system', content: systemInstruction },
      { role: 'user', content: prompt }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3
  });

  return response;
}

module.exports = { getGeminiChatCompletion };
