const OpenAI = require('openai');
const { EXTRACTION_PROMPT } = require('./extraction.prompt');
require('dotenv').config();

// Determine which AI provider to use
let openai = null;
let aiModel = process.env.AI_MODEL || 'gpt-4o-mini';

if (process.env.GROQ_API_KEY) {
  // Use Groq's OpenAI-compatible endpoint
  openai = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1',
  });
  aiModel = process.env.AI_MODEL || 'qwen/qwen3.6-27b';
} else if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

class ExtractionService {
  /**
   * Process a message text using the AI model
   * @param {string} text The message text
   * @param {string} timestamp The message timestamp (ISO string)
   * @returns {Promise<Object>} The parsed extraction payload or null
   */
  async processMessage(text, timestamp) {
    if (!openai) {
      console.warn('[AI] API key not configured. Skipping extraction.');
      return null;
    }

    try {
      const response = await openai.chat.completions.create({
        model: aiModel,
        messages: [
          { role: 'system', content: EXTRACTION_PROMPT },
          { role: 'user', content: `Message Timestamp: ${timestamp}\n\nMessage Content: ${text}` }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      });

      const responseContent = response.choices[0].message.content;
      if (!responseContent) return null;

      const parsed = JSON.parse(responseContent);
      return parsed;
    } catch (error) {
      console.error('[AI] Extraction failed:', error.message);
      return null;
    }
  }

  /**
   * Validate and normalize the extraction
   * @param {Object} rawExtraction 
   */
  normalizeExtraction(rawExtraction) {
    if (!rawExtraction || typeof rawExtraction !== 'object') return null;
    if (rawExtraction.is_relevant !== true) return null;

    const type = rawExtraction.type;
    const confidence = parseFloat(rawExtraction.confidence) || 0;
    const payload = rawExtraction.payload;

    if (!type || !payload) return null;

    const status = confidence >= 0.60 ? 'active' : 'needs_review';

    return {
      type,
      confidence,
      status,
      payload
    };
  }
}

module.exports = new ExtractionService();
