const OpenAI = require('openai');
require('dotenv').config();

const client = process.env.GROQ_API_KEY
  ? new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1',
    })
  : null;

async function getGroqChatCompletion(messages, model = 'openai/gpt-oss-20b') {
  if (!client) {
    throw new Error('GROQ_API_KEY is not configured');
  }

  return client.chat.completions.create({
    model,
    messages,
    response_format: { type: 'json_object' },
    temperature: 0.3,
  });
}

module.exports = { getGroqChatCompletion };
