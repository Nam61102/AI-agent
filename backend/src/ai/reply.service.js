const { getGeminiChatCompletion } = require('../services/gemini.service');
const { getGroqChatCompletion } = require('../services/groq.service');
const { REPLY_PROMPT } = require('./reply.prompt');
require('dotenv').config();

function fallbackRuleBasedReply(contactName, text, isGroup = false) {
  const lower = (text || '').toLowerCase().trim();

  // 1. Birthday / Anniversary detection
  if (/birthday|bday|happy birthday|वाढदिवस|जनमदिन/i.test(lower)) {
    const isMarathi = /वाढदिवस|भावा|मित्रा/i.test(lower);
    const reply = isMarathi 
      ? 'वाढदिवसाच्या खूप खूप मनापासून शुभेच्छा! 🎂 देवाचे आशीर्वाद सदैव तुझ्या पाठीशी राहो.'
      : 'Happy Birthday! Wishing you a wonderful year ahead filled with happiness and success! 🎂🎉';
    return {
      should_reply: true,
      category: 'important_event',
      subtype: 'birthday',
      meaning: `${contactName} mentioned a birthday celebration!`,
      next_step: 'Send warm birthday wishes',
      action_type: 'birthday',
      suggested_reply: reply,
      reason: 'Birthday wishes received in message',
      detected_language: isMarathi ? 'Marathi' : 'English',
      detected_tone: 'celebratory',
      event_details: {
        event: 'Birthday',
        title: `${contactName}'s Birthday`,
        date: new Date().toISOString().split('T')[0],
        description: text
      }
    };
  }

  // 2. Meeting / Schedule / Plans detection
  if (/meet|meeting|timing|bheto|bhetu|call|zoom|gmeet|udya|tomorrow|sandhyakali|evening|aaj|today/i.test(lower)) {
    const isMarathi = /bhetu|udya|sandhyakali|kiti|vajata|bheto/i.test(lower);
    const reply = isMarathi 
      ? 'हो नक्की, संध्याकाळी जमू शकते. वेळ कळव.'
      : 'Sure, let us connect. What time works best for you?';
    return {
      should_reply: true,
      category: 'needs_action',
      subtype: 'meeting_request',
      meaning: `${contactName} is proposing a meeting or call schedule.`,
      next_step: 'Confirm availability or suggest a time',
      action_type: 'follow_up',
      suggested_reply: reply,
      reason: 'Meeting or schedule inquiry detected',
      detected_language: isMarathi ? 'Marathi' : 'English',
      detected_tone: 'collaborative',
      event_details: {
        event: 'Meeting',
        title: `Meeting with ${contactName}`,
        description: text,
        date: new Date().toISOString().split('T')[0]
      }
    };
  }

  // 3. Questions / Inquiries
  if (lower.endsWith('?') || /how|where|when|kasa|kay|kuth|kiti|kaay|kaisa|kab|kya|bhav/i.test(lower)) {
    const isMarathi = /kasa|kay|kuth|kiti|kaay|bhava/i.test(lower);
    const reply = isMarathi 
      ? 'हो, मी चेक करून लगेच अपडेट देतो.'
      : 'Yes, looking into this right now. Will update you shortly.';
    return {
      should_reply: true,
      category: 'needs_action',
      subtype: 'important_question',
      meaning: `${contactName} asked a direct question: "${text}"`,
      next_step: 'Send answer or update status',
      action_type: 'reply_needed',
      suggested_reply: reply,
      reason: 'Direct question requiring response',
      detected_language: isMarathi ? 'Marathi' : 'English',
      detected_tone: 'helpful'
    };
  }

  // 4. Greetings
  if (/^(hi|hello|hey|namaste|good morning|gm|gn|good night|ram ram|radhe radhe)/i.test(lower)) {
    return {
      should_reply: true,
      category: 'ai_auto_reply',
      subtype: 'greeting_response',
      meaning: `${contactName} sent a friendly greeting.`,
      next_step: 'Send welcoming response',
      action_type: 'reply_needed',
      suggested_reply: `Hello ${contactName}! How can I help you today?`,
      reason: 'Greeting message',
      detected_language: 'English',
      detected_tone: 'friendly'
    };
  }

  // Dynamic natural fallback acknowledgment
  const isMarathi = /ho|hooo|bhetu|kay|kasa|kuth|kiti|bhava|maaz|tuj|nakki|bhet/i.test(lower);
  const isHinglish = /bhai|kya|haan|chal|aur|bata|mast|deck/i.test(lower);

  const naturalReply = isMarathi 
    ? 'हो नक्की, मी बघतो.' 
    : isHinglish 
    ? 'Haan bhai, dekhta hu.' 
    : 'Hey! Got it, checking now.';

  return {
    should_reply: true,
    category: 'ai_auto_reply',
    subtype: 'casual_convo',
    meaning: `${contactName} sent a message: "${text}"`,
    next_step: 'Send quick acknowledgment',
    action_type: 'reply_needed',
    suggested_reply: naturalReply,
    reason: 'Incoming message requiring response',
    detected_language: isMarathi ? 'Marathi' : isHinglish ? 'Hinglish' : 'English',
    detected_tone: 'friendly'
  };
}

class ReplyService {
  async generateReply({ contact, conversationHistory = [], currentMessage }) {
    if (!currentMessage || !currentMessage.text || currentMessage.text.trim() === '') {
      return { success: true, data: { should_reply: false, action_type: 'none', suggested_reply: null, reason: 'Empty message' } };
    }

    const contactName = contact?.name || 'Contact';

    // 1. Try Gemini API first if configured
    if (process.env.GEMINI_API_KEY) {
      try {
        const formattedHistory = conversationHistory
          .map(m => `[${new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}] ${m.sender}: ${m.text}`)
          .join('\n');

        const userPrompt = `### CONTEXT
Contact: ${contactName} (${contact?.is_group ? 'WhatsApp Group' : 'Direct Chat'})

### CONVERSATION HISTORY:
${formattedHistory || '(No previous messages)'}

### LATEST INCOMING MESSAGE:
Sender: ${currentMessage.sender || contactName}
Message: "${currentMessage.text}"

Generate JSON response matching the schema.`;

        const geminiRes = await getGeminiChatCompletion(userPrompt, REPLY_PROMPT);
        const text = geminiRes.choices?.[0]?.message?.content;
        if (text) {
          const parsed = JSON.parse(text);
          const needsReply = typeof parsed.needs_reply === 'boolean' 
            ? parsed.needs_reply 
            : typeof parsed.should_reply === 'boolean' 
            ? parsed.should_reply 
            : true;

          const category = parsed.category || (parsed.action_type === 'birthday' ? 'important_event' : 'needs_action');
          const subtype = parsed.subtype || (parsed.action_type === 'birthday' ? 'birthday' : 'follow_up');
          const meaning = parsed.meaning || parsed.reason || `${contactName}: "${currentMessage.text}"`;
          const nextStep = parsed.next_step || (needsReply ? 'Review & send reply' : 'No action needed');

          if (parsed && (typeof parsed.needs_reply === 'boolean' || typeof parsed.should_reply === 'boolean' || parsed.suggested_reply)) {
            return {
              success: true,
              data: {
                should_reply: needsReply,
                category,
                subtype,
                meaning,
                next_step: nextStep,
                action_type: parsed.action_type || 'reply_needed',
                suggested_reply: parsed.suggested_reply || null,
                reason: parsed.reason || 'AI generated contextual reply',
                detected_language: parsed.detected_language || 'English',
                detected_tone: parsed.detected_tone || 'friendly',
                event_details: parsed.event_details || null
              }
            };
          }
        }
      } catch (err) {
        console.warn('[ReplyService] Gemini completion error, attempting fallbacks:', err.message);
      }
    }

    // 2. Try Groq API if configured
    if (process.env.GROQ_API_KEY) {
      try {
        const groqRes = await getGroqChatCompletion([
          { role: 'system', content: REPLY_PROMPT },
          { role: 'user', content: `Message from ${contactName}: "${currentMessage.text}"` }
        ]);
        const text = groqRes.choices?.[0]?.message?.content;
        if (text) {
          const parsed = JSON.parse(text);
          const needsReply = typeof parsed.needs_reply === 'boolean' 
            ? parsed.needs_reply 
            : typeof parsed.should_reply === 'boolean' 
            ? parsed.should_reply 
            : true;

          const category = parsed.category || (parsed.action_type === 'birthday' ? 'important_event' : 'needs_action');
          const subtype = parsed.subtype || (parsed.action_type === 'birthday' ? 'birthday' : 'follow_up');
          const meaning = parsed.meaning || parsed.reason || `${contactName}: "${currentMessage.text}"`;
          const nextStep = parsed.next_step || (needsReply ? 'Review & send reply' : 'No action needed');

          return {
            success: true,
            data: {
              should_reply: needsReply,
              category,
              subtype,
              meaning,
              next_step: nextStep,
              action_type: parsed.action_type || 'reply_needed',
              suggested_reply: parsed.suggested_reply || null,
              reason: parsed.reason || 'AI generated contextual reply',
              detected_language: parsed.detected_language || 'English',
              detected_tone: parsed.detected_tone || 'friendly',
              event_details: parsed.event_details || null
            }
          };
        }
      } catch (err) {
        console.warn('[ReplyService] Groq completion error:', err.message);
      }
    }

    // 3. Fallback to smart rule-based language and sentiment engine
    const fallbackData = fallbackRuleBasedReply(contactName, currentMessage.text, contact?.is_group);
    return { success: true, data: fallbackData };
  }
}

module.exports = new ReplyService();
