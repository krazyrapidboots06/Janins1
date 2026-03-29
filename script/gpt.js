const axios = require('axios');

module.exports.config = {
  name: "gpt",
  version: "4.0.0",
  role: 0,
  credits: "selov",
  description: "AI-powered Bible study assistant with empathetic responses",
  commandCategory: "religion",
  usages: "/biblegpt <question>",
  cooldowns: 3,
  aliases: ["bibleai", "bibleask"]
};

// Store user conversation history
if (!global.bibleAIUsers) global.bibleAIUsers = {};

// Bible context for the AI - with proper emotional awareness
const BIBLE_CONTEXT = `You are BibleGPT, a compassionate AI assistant focused on answering questions about the Bible, theology, and Christian living.

IMPORTANT RULES:
1. Base your answers on Scripture.
2. Be EMOTIONALLY AWARE and EMPATHETIC:
   - If the user mentions sin, guilt, sadness, or mistakes → Be gentle, compassionate, and offer hope (NOT cheerful or "saya")
   - If the user mentions joy or gratitude → Be warm and cheerful
   - Match the user's emotional tone
3. Format your answers:
   - LONG answers (more than 3 sentences) → TWO PARAGRAPHS with blank line between
   - SHORT answers (3 sentences or less) → ONE PARAGRAPH only
4. Use Taglish (Tagalog + English) naturally
5. Always offer hope and point to God's grace
6. NEVER start with cheerful phrases like "Ang saya naman" when the topic is serious, sad, or about sin.

EMOTIONAL GUIDELINES:
- For sin/guilt topics: "I understand that must be heavy..." / "Alam kong hindi madali..." / "God's grace is sufficient..."
- For sad topics: "I'm sorry to hear that..." / "Nakikiisa ako sa iyo..."
- For joyful topics: "Ang saya naman!" / "That's wonderful to hear!"

Be warm, compassionate, and appropriate to the situation.`;

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, senderID } = event;
  const userQuestion = args.join(" ").trim();

  if (!userQuestion) {
    return api.sendMessage(
      `📖 BibleGPT\n━━━━━━━━━━━━━━━━\n` +
      `Ask me anything about the Bible!\n\n` +
      `Examples:\n` +
      `• /biblegpt What does the Bible say about forgiveness?\n` +
      `• /biblegpt Explain John 3:16\n` +
      `• /biblegpt How can I grow in faith?\n` +
      `• /biblegpt Nagkasala ako, ano ang gagawin ko?`,
      threadID,
      messageID
    );
  }

  // Initialize user memory if not exists
  if (!global.bibleAIUsers[senderID]) {
    global.bibleAIUsers[senderID] = {
      history: [],
      lastQuestion: null
    };
  }

  // Get user info for personalization
  let userName = "kaibigan";
  try {
    const userInfo = await api.getUserInfo(senderID);
    userName = userInfo[senderID]?.name?.split(' ')[0] || "kaibigan";
  } catch (e) {}

  try {
    // Add conversation history for context
    const recentHistory = global.bibleAIUsers[senderID].history.slice(-3);
    
    let fullPrompt = `${BIBLE_CONTEXT}\n\n`;
    
    // Add conversation history if exists
    if (recentHistory.length > 0) {
      fullPrompt += `Previous conversation:\n`;
      for (const entry of recentHistory) {
        fullPrompt += `User: ${entry.question}\n`;
        fullPrompt += `Assistant: ${entry.answer}\n\n`;
      }
    }
    
    // Detect emotional tone from question
    let emotionalContext = "";
    const sadKeywords = ["nagkasala", "kasalanan", "sad", "malungkot", "guilty", "error", "mistake", "failure", "mali", "pagsisisi"];
    const happyKeywords = ["salamat", "thank", "grateful", "saya", "happy", "blessed", "pinagpala"];
    
    const lowerQuestion = userQuestion.toLowerCase();
    const isSad = sadKeywords.some(keyword => lowerQuestion.includes(keyword));
    const isHappy = happyKeywords.some(keyword => lowerQuestion.includes(keyword));
    
    if (isSad) {
      emotionalContext = "The user is expressing guilt, sadness, or concern about sin. Be GENTLE, COMPASSIONATE, and offer HOPE. DO NOT use cheerful greetings. Start with empathy like: 'Alam kong hindi madali ang pinagdadaanan mo...' or 'I understand that must be heavy...'";
    } else if (isHappy) {
      emotionalContext = "The user seems joyful or grateful. You can be warm and cheerful.";
    } else {
      emotionalContext = "Neutral tone. Be warm and helpful.";
    }
    
    // Add current question with user's name and emotional context
    fullPrompt += `EMOTIONAL CONTEXT: ${emotionalContext}\n\n`;
    fullPrompt += `User: ${userName} asked: ${userQuestion}\n\n`;
    fullPrompt += `Assistant: Provide a Bible-based response that is emotionally appropriate to the user's situation. Be compassionate and helpful.`;

    // Call the Vern REST API
    const response = await axios.get(
      `https://vern-rest-api.vercel.app/api/chatgpt4?prompt=${encodeURIComponent(fullPrompt)}`,
      { timeout: 30000 }
    );

    let answer = response.data?.result || 
                 response.data?.response || 
                 response.data?.message || 
                 response.data?.answer ||
                 "I'm sorry, I couldn't generate a response. Please try again.";

    // Clean up the answer
    answer = answer.replace(/```/g, '').trim();

    // Ensure proper paragraph formatting
    if (!answer.includes('\n\n') && answer.split('.').length > 4) {
      const sentences = answer.match(/[^.!?]+[.!?]+/g);
      if (sentences && sentences.length > 2) {
        const midPoint = Math.floor(sentences.length / 2);
        const firstPara = sentences.slice(0, midPoint).join(' ');
        const secondPara = sentences.slice(midPoint).join(' ');
        answer = `${firstPara}\n\n${secondPara}`;
      }
    }

    // Store conversation in memory
    global.bibleAIUsers[senderID].history.push({
      question: userQuestion,
      answer: answer,
      timestamp: Date.now()
    });

    // Limit history to last 20 exchanges
    if (global.bibleAIUsers[senderID].history.length > 20) {
      global.bibleAIUsers[senderID].history.shift();
    }

    // Send the answer
    return api.sendMessage(answer, threadID, messageID);

  } catch (err) {
    console.error("BibleGPT Error:", err);
    
    let errorMsg = "❌ Sorry, I couldn't generate a response. Please try again.";
    
    if (err.response?.status === 400) {
      errorMsg = "❌ Invalid request. Please try a different question.";
    } else if (err.code === 'ECONNABORTED') {
      errorMsg = "❌ Request timed out. Please try again.";
    }
    
    return api.sendMessage(errorMsg, threadID, messageID);
  }
};
