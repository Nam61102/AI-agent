const supabase = require('../config/supabase');
const { getGeminiChatCompletion } = require('./gemini.service');

const WEIGHTS = {
  responsiveness: 0.14,
  cadence: 0.14,
  engagement_depth: 0.12,
  sentiment: 0.12,
  reciprocity: 0.10,
  effort_symmetry: 0.10,
  follow_through: 0.10,
  empathy: 0.10,
  conflict_repair: 0.08,
};

/**
 * Group messages into sessions based on a 4-hour gap.
 */
function groupIntoSessions(messages) {
  if (!messages || messages.length === 0) return [];
  
  const sessions = [];
  let currentSession = [messages[0]];
  
  for (let i = 1; i < messages.length; i++) {
    const prevMsg = messages[i - 1];
    const currMsg = messages[i];
    
    const prevTime = new Date(prevMsg.timestamp).getTime();
    const currTime = new Date(currMsg.timestamp).getTime();
    
    // 4 hours in milliseconds
    const gap = currTime - prevTime;
    if (gap >= 4 * 60 * 60 * 1000) {
      sessions.push(currentSession);
      currentSession = [currMsg];
    } else {
      currentSession.push(currMsg);
    }
  }
  sessions.push(currentSession);
  return sessions;
}

/**
 * Calculate Math Factors: Responsiveness, Reciprocity, Cadence, Effort Symmetry.
 */
async function calculateMathFactors(jid, messages) {
  if (!messages || messages.length === 0) return {};
  
  const sessions = groupIntoSessions(messages);
  
  // 1. Effort Symmetry (Word count balance)
  let myWords = 0;
  let theirWords = 0;
  
  // 2. Responsiveness (Median reply latency)
  const replyLatencies = [];
  
  for (let i = 1; i < messages.length; i++) {
    const prevMsg = messages[i - 1];
    const currMsg = messages[i];
    
    if (currMsg.from_me) {
      myWords += currMsg.text ? currMsg.text.split(' ').length : 0;
    } else {
      theirWords += currMsg.text ? currMsg.text.split(' ').length : 0;
    }
    
    // If I sent the previous message, and they sent this one, it's a reply
    if (prevMsg.from_me && !currMsg.from_me) {
      const gap = new Date(currMsg.timestamp).getTime() - new Date(prevMsg.timestamp).getTime();
      if (gap < 4 * 60 * 60 * 1000) { // Only count if within same session
        replyLatencies.push(gap);
      }
    }
  }
  
  // Base scores
  let effortScore = 50; // Default balanced
  if (myWords + theirWords > 0) {
    const theirShare = theirWords / (myWords + theirWords);
    // Perfect balance (0.5) = 100 score. 0 or 1 = 0 score.
    effortScore = 100 - (Math.abs(theirShare - 0.5) * 200);
  }
  
  let responsivenessScore = 50;
  if (replyLatencies.length > 0) {
    // Sort to find median
    replyLatencies.sort((a, b) => a - b);
    const medianLatency = replyLatencies[Math.floor(replyLatencies.length / 2)];
    // Convert median latency to score (e.g., 1 min = 100, 1 hr = 50, 4 hrs = 0)
    const minutes = medianLatency / (60 * 1000);
    responsivenessScore = Math.max(0, 100 - (minutes / 2.4)); // 240 mins = 0
  }

  // 3. Reciprocity (Initiation balance)
  let myInitiations = 0;
  let theirInitiations = 0;
  
  for (const session of sessions) {
    if (session[0].from_me) myInitiations++;
    else theirInitiations++;
  }
  
  let reciprocityScore = 50;
  if (myInitiations + theirInitiations > 0) {
    const theirInitShare = theirInitiations / (myInitiations + theirInitiations);
    reciprocityScore = 100 - (Math.abs(theirInitShare - 0.5) * 200);
  }
  
  // 4. Cadence (Mocked for now since 18-month median needs a separate cadence table)
  let cadenceScore = 80;

  // Save to DB
  await saveScore(jid, 'effort_symmetry', effortScore);
  await saveScore(jid, 'responsiveness', responsivenessScore);
  await saveScore(jid, 'reciprocity', reciprocityScore);
  await saveScore(jid, 'cadence', cadenceScore);

  return { effortScore, responsivenessScore, reciprocityScore, cadenceScore };
}

/**
 * Calculate AI Factors using Groq.
 */
async function calculateAIFactors(jid, messages) {
  if (!messages || messages.length === 0) return {};
  
  // Only send the last 50 messages to save tokens
  const recentMsgs = messages.slice(-50).map(m => `[${m.timestamp}] ${m.from_me ? 'Me' : 'Them'}: ${m.text}`).join('\n');
  
  const prompt = `
Analyze the following WhatsApp conversation and calculate relationship strength factors on a scale of 0 to 100.
If a factor cannot be determined (e.g., no conflict occurred), return null for that factor.

Factors:
1. engagement_depth: Are the conversations meaningful (100) or superficial (0)?
2. sentiment: Is the tone positive/supportive (100) or negative (0)?
3. follow_through: Did they keep commitments (100) or fail to (0)? (null if no commitments)
4. empathy: Did they respond empathetically to stress/bad news (100)? (null if no stress shared)
5. conflict_repair: If there was an argument, was it resolved positively (100)? (null if no conflict)

Conversation:
${recentMsgs}

Respond ONLY in valid JSON format:
{
  "engagement_depth": 85,
  "sentiment": 90,
  "follow_through": null,
  "empathy": 80,
  "conflict_repair": null
}
`;

  try {
    const completion = await getGeminiChatCompletion(
      prompt,
      'You are a relationship intelligence AI. Return ONLY JSON.'
    );
    
    let aiResponse = completion.choices[0].message.content.trim();
    // Strip markdown if present
    if (aiResponse.startsWith('```json')) {
      aiResponse = aiResponse.replace(/```json/g, '').replace(/```/g, '');
    }
    
    const parsed = JSON.parse(aiResponse);
    
    if (parsed.engagement_depth !== null) await saveScore(jid, 'engagement_depth', parsed.engagement_depth);
    if (parsed.sentiment !== null) await saveScore(jid, 'sentiment', parsed.sentiment);
    if (parsed.follow_through !== null) await saveScore(jid, 'follow_through', parsed.follow_through);
    if (parsed.empathy !== null) await saveScore(jid, 'empathy', parsed.empathy);
    if (parsed.conflict_repair !== null) await saveScore(jid, 'conflict_repair', parsed.conflict_repair);
    
    return parsed;
  } catch (error) {
    console.error('[RelationshipService] AI calculation error:', error);
    return {};
  }
}

async function saveScore(jid, factor, value) {
  if (value === null || value === undefined) return;
  
  // Get contact_id
  const contactRes = await supabase.query('SELECT id FROM contacts WHERE jid = $1', [jid]);
  if (contactRes.rows.length === 0) return;
  const contactId = contactRes.rows[0].id;
  
  const valToSave = Math.max(0, Math.min(100, Math.round(value)));
  
  const existing = await supabase.query('SELECT id FROM contact_metrics WHERE contact_id = $1 AND factor = $2', [contactId, factor]);
  
  if (existing.rows.length > 0) {
    await supabase.query('UPDATE contact_metrics SET value = $1, computed_at = NOW() WHERE id = $2', [valToSave, existing.rows[0].id]);
  } else {
    await supabase.query('INSERT INTO contact_metrics (contact_id, factor, value, computed_at) VALUES ($1, $2, $3, NOW())', [contactId, factor, valToSave]);
  }
}

/**
 * Compute the final 0-100 composite score, normalizing for missing factors.
 */
async function computeCompositeScore(jid) {
  const result = await supabase.query(`
    SELECT m.factor, m.value 
    FROM contact_metrics m 
    JOIN contacts c ON m.contact_id = c.id 
    WHERE c.jid = $1
  `, [jid]);
  if (result.rows.length === 0) return 0;
  
  let totalScore = 0;
  let totalWeightUsed = 0;
  
  for (const row of result.rows) {
    const weight = WEIGHTS[row.factor];
    if (weight) {
      totalScore += (row.value * weight);
      totalWeightUsed += weight;
    }
  }
  
  if (totalWeightUsed === 0) return 0;
  
  // Renormalize
  const composite = totalScore / totalWeightUsed;
  return Math.round(composite);
}

/**
 * Full Pipeline
 */
async function analyzeContact(jid) {
  // Get last 30 days of messages
  const result = await supabase.query(`
    SELECT * FROM messages 
    WHERE chat_jid = $1 AND message_type = 'text' 
    ORDER BY timestamp ASC
  `, [jid]);
  
  if (result.rows.length === 0) return;
  
  await calculateMathFactors(jid, result.rows);
  await calculateAIFactors(jid, result.rows);
  const composite = await computeCompositeScore(jid);
  
  await supabase.query('UPDATE contacts SET relationship_score = $1 WHERE jid = $2', [composite, jid]);
  
  console.log(`[Relationship] Computed score ${composite} for ${jid}`);
  return composite;
}

module.exports = {
  analyzeContact,
  computeCompositeScore,
  groupIntoSessions
};
