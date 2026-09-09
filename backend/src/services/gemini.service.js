const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

let genAI = null;
if (process.env.GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}

async function getGeminiChatCompletion(prompt, systemInstruction = 'You are a helpful AI. Return ONLY JSON.') {
  if (!genAI) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const model = genAI.getGenerativeModel({ 
    model: "gemini-3.5-flash",
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
  // Return mocked OpenAI structure so we don't have to change the caller entirely
  return {
    choices: [
      { message: { content: text } }
    ]
  };
}

module.exports = { getGeminiChatCompletion };
