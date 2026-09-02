const extractionService = require('../ai/extraction.service');
const supabase = require('../config/supabase');

class MessageProcessorService {
  /**
   * Process a saved message asynchronously
   * @param {Object} message The saved message record from Supabase
   */
  async process(message) {
    // Fire and forget, don't wait for it
    this._processAsync(message).catch(err => {
      console.error(`[MessageProcessor] Unhandled error processing message ${message?.id}:`, err.message);
    });
  }

  async processPendingMessages(limit = 100) {
    const query = `
      SELECT m.*
      FROM messages m
      WHERE m.message_type = 'text'
        AND NULLIF(TRIM(m.text), '') IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM extractions e WHERE e.source_message_id = m.id
        )
      ORDER BY m.timestamp DESC
      LIMIT $1;
    `;

    try {
      const result = await supabase.query(query, [limit]);
      console.log(`[AI] Retrying ${result.rows.length} pending message(s)`);

      for (const message of result.rows) {
        await this._processAsync(message);
      }
    } catch (error) {
      console.error('[AI] Pending message retry failed:', error.message);
    }
  }

  async _processAsync(message) {
    if (!message || !message.id || !message.text) {
      return;
    }
    
    // We only process 'text' message types for now
    if (message.message_type !== 'text' && !message.text) {
      return;
    }

    // Ignore extremely short or common messages
    const textLower = message.text.trim().toLowerCase();
    const ignoredPhrases = ['hey', 'hi', 'hello', 'good morning', 'good night', 'ok', 'okay', 'yes', 'no', 'hmm', 'k', 'cool', 'thanks'];
    if (textLower.length < 3 || ignoredPhrases.includes(textLower)) {
      console.log(`[AI] No extraction detected for message ${message.id} (too short/common)`);
      return;
    }

    // Call AI Extraction Service
    console.log(`[AI] Processing message ${message.id}`);
    const rawExtraction = await extractionService.processMessage(message.text, message.timestamp);
    
    if (!rawExtraction) {
      console.log(`[AI] No extraction detected for message ${message.id} (AI returned null)`);
      return;
    }

    const extraction = extractionService.normalizeExtraction(rawExtraction);

    if (!extraction) {
      console.log(`[AI] No extraction detected for message ${message.id}`);
      return;
    }

    // Check for duplicates
    const checkQuery = `
      SELECT id FROM extractions 
      WHERE source_message_id = $1 AND type = $2 
      LIMIT 1;
    `;
    const checkResult = await supabase.query(checkQuery, [message.id, extraction.type]);

    if (checkResult.rows.length > 0) {
      console.log(`[AI] Extraction already exists for message ${message.id}`);
      return;
    }

    console.log(`[AI] Extraction detected: ${extraction.type}`);
    console.log(`[AI] Confidence: ${extraction.confidence}`);

    if (extraction.status === 'needs_review') {
      console.log(`[AI] Extraction needs review: ${extraction.confidence}`);
    }

    // Save to Supabase
    const insertQuery = `
      INSERT INTO extractions (contact_id, source_message_id, type, payload, confidence, status)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;
    const insertValues = [
      message.contact_id,
      message.id,
      extraction.type,
      extraction.payload, // Will be serialized by pg automatically or we can JSON.stringify it if needed, pg handles jsonb well
      extraction.confidence,
      extraction.status
    ];

    try {
      const result = await supabase.query(insertQuery, insertValues);
      console.log(`[AI] Extraction saved: ${result.rows[0].id}`);
    } catch (error) {
      console.error(`[AI] Extraction save failed for message ${message.id}:`, error.message);
    }
  }
}

module.exports = new MessageProcessorService();
