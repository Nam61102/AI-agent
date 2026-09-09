const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

let genAI = null;
if (process.env.GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}

const CANDIDATE_MODELS = [
  'gemini-3.7-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-flash-latest',
  'gemini-3.6-flash'
];

async function getGeminiChatCompletion(prompt, systemInstruction = 'You are an intelligent WhatsApp AI Assistant. Return valid JSON only.') {
  if (!genAI) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  let lastError = null;

  for (const modelName of CANDIDATE_MODELS) {
    try {
      const model = genAI.getGenerativeModel({ 
        model: modelName,
        systemInstruction
      });

      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.3,
        }
      });

      const text = result.response.text();
      if (text) {
        return {
          choices: [
            { message: { content: text } }
          ]
        };
      }
    } catch (err) {
      lastError = err;
      const isRateOrQuota = err.message && (
        err.message.includes('429') || 
        err.message.includes('503') || 
        err.message.includes('Quota exceeded') || 
        err.message.includes('Too Many Requests') ||
        err.message.includes('high demand')
      );
      if (isRateOrQuota) {
        console.warn(`[GeminiService] Model '${modelName}' busy/quota hit (${err.message.slice(0, 80)}...). Trying next model...`);
      } else {
        console.warn(`[GeminiService] Model '${modelName}' error: ${err.message}. Trying next model...`);
      }
    }
  }

  throw new Error(`Gemini completion failed across all candidate models. Last error: ${lastError?.message}`);
}

module.exports = { getGeminiChatCompletion };
