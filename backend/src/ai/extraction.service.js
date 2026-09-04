const OpenAI = require('openai');
const { EXTRACTION_PROMPT } = require('./extraction.prompt');
require('dotenv').config();

// Determine which AI provider to use
let openai = null;
let primaryModel = process.env.AI_MODEL || 'gpt-4o-mini';
let fallbackModels = [primaryModel];

if (process.env.GROQ_API_KEY) {
  // Use Groq's OpenAI-compatible endpoint
  openai = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1',
  });
  primaryModel = process.env.AI_MODEL || 'openai/gpt-oss-120b';
  // List of active candidate models in priority order
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

class ExtractionService {
  /**
   * Process a message text using the AI model with fallback support
   * @param {string} text The message text
   * @param {string} timestamp The message timestamp (ISO string)
   * @returns {Promise<{success: boolean, data?: Object, isRateLimited?: boolean, error?: string}>}
   */
  async processMessage(text, timestamp) {
    if (!openai) {
      console.warn('[AI] API key not configured. Skipping extraction.');
      return { success: false, error: 'API key not configured' };
    }

    let lastError = null;
    let rateLimitedCount = 0;

    for (const model of fallbackModels) {
      try {
        const response = await openai.chat.completions.create({
          model: model,
          messages: [
            { role: 'system', content: EXTRACTION_PROMPT },
            { role: 'user', content: `Message Timestamp: ${timestamp}\n\nMessage Content: ${text}` }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1,
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
          console.warn(`[AI] Model '${model}' rate limited: ${error.message}. Trying next fallback model if available...`);
        } else {
          console.warn(`[AI] Model '${model}' failed: ${error.message}`);
        }
      }
    }

    const allRateLimited = rateLimitedCount === fallbackModels.length;
    if (allRateLimited) {
      console.error(`[AI] All available models hit rate limits. Last error: ${lastError?.message}`);
      return { success: false, isRateLimited: true, error: lastError?.message };
    }

    console.error(`[AI] Extraction failed across all fallback models. Last error: ${lastError?.message}`);
    return { success: false, isRateLimited: false, error: lastError?.message };
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

    // Aggressive filtering: Discard any extraction with low confidence completely
    if (confidence < 0.90) return null;

    const status = confidence >= 0.95 ? 'active' : 'needs_review';

    return {
      type,
      confidence,
      status,
      payload
    };
  }
}

module.exports = new ExtractionService();

