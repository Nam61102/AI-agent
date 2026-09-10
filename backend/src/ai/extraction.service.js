const OpenAI = require('openai');
const { EXTRACTION_PROMPT } = require('./extraction.prompt');
require('dotenv').config();

// Determine which AI provider to use
let openai = null;
let primaryModel = process.env.AI_MODEL || 'google/gemini-2.5-flash';
let fallbackModels = [primaryModel, 'google/gemini-2.5-flash-lite', 'google/gemini-2.5-pro'];

if (process.env.OPENROUTER_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      'HTTP-Referer': 'https://nryn.ai',
      'X-Title': 'NRYN AI Assistant'
    }
  });
  primaryModel = process.env.AI_MODEL || 'google/gemini-2.5-flash';
  const candidateModels = [
    primaryModel,
    'google/gemini-2.5-flash',
    'google/gemini-2.5-flash-lite',
    'google/gemini-2.5-pro'
  ];
  fallbackModels = [...new Set(candidateModels.filter(Boolean))];
} else if (process.env.GROQ_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1',
  });
  primaryModel = process.env.AI_MODEL || 'openai/gpt-oss-120b';
  fallbackModels = [primaryModel, 'openai/gpt-oss-120b', 'openai/gpt-oss-20b'];
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

    const category = rawExtraction.category || (rawExtraction.type === 'life_event' ? 'important_event' : 'needs_action');
    const subtype = rawExtraction.subtype || rawExtraction.type || 'general';
    const confidence = parseFloat(rawExtraction.confidence) || 0.9;
    
    // Aggressive filtering: Discard low confidence extractions
    if (confidence < 0.70) return null;

    const whatMatters = rawExtraction.what_matters || rawExtraction.payload?.description || rawExtraction.payload?.title || 'Important update detected';
    const whyItMatters = rawExtraction.why_it_matters || rawExtraction.payload?.description || 'Requires attention';
    const recommendedAction = rawExtraction.recommended_action || 'Review and take action if needed';
    const suggestedReply = rawExtraction.suggested_reply || null;

    return {
      category,
      subtype,
      confidence,
      status: 'active',
      whatMatters,
      whyItMatters,
      recommendedAction,
      suggestedReply,
      payload: rawExtraction.payload || { description: whatMatters }
    };
  }
}

module.exports = new ExtractionService();
