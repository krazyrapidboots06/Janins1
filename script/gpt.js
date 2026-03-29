const axios = require('axios');

module.exports.config = {
  name: "gpt",
  version: "1.0.0",
  role: 0,
  credits: "selov",
  description: "AI-powered Bible study assistant (BibleGPT)",
  commandCategory: "religion",
  usages: "/gpt <question>",
  cooldowns: 3,
  aliases: ["biblegpt", "bibleask"]
};

// Store user conversation history
if (!global.bibleAIUsers) global.bibleAIUsers = {};

// Bible context for the AI
const BIBLE_SYSTEM_PROMPT = `You are BibleGPT, an AI-powered tool that delivers accurate Bible-based answers to user queries. 
Your purpose is to help people deepen their understanding of the Bible, theology, and Christian living.

Guidelines:
- Base your answers on Scripture, citing chapter and verse whenever possible
- Provide biblical context and explanations
- Be respectful, compassionate, and faithful to Christian teachings
- If asked about controversial topics, present biblical perspectives with grace
- If you don't know something, admit it honestly
- Keep responses warm, encouraging, and helpful
- Focus on accuracy and truthfulness

Respond in a friendly, pastoral tone.`;

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, senderID } = event;
  const userQuestion = args.join(" ").trim();

  if (!userQuestion) {
    return api.sendMessage(
      `📖 Ask me anything`,
      threadID,
      messageID
    );
  }

  // Initialize user memory if not exists
  if (!global.bibleAIUsers[senderID]) {
    global.bibleAIUsers[senderID] = {
      history: [],
      lastQuestion: null,
      preferences: {}
    };
  }

  // Get user info for personalization
  let userName = "Beloved";
  try {
    const userInfo = await api.getUserInfo(senderID);
    userName = userInfo[senderID]?.name?.split(' ')[0] || "Beloved";
  } catch (e) {}

  try {
    // Build conversation history (last 5 exchanges for context)
    const recentHistory = global.bibleAIUsers[senderID].history.slice(-5);
    
    // Prepare messages array for API
    const messages = [
      { role: "system", content: BIBLE_SYSTEM_PROMPT }
    ];
    
    // Add conversation history
    for (const entry of recentHistory) {
      messages.push({ role: "user", content: entry.question });
      messages.push({ role: "assistant", content: entry.answer });
    }
    
    // Add current question with user's name
    messages.push({ 
      role: "user", 
      content: `My name is ${userName}. ${userQuestion}` 
    });

    // Call Pollinations AI API
    const response = await axios.post(
      "https://text.pollinations.ai/openai",
      {
        model: "openai",
        messages: messages,
        temperature: 0.7,
        max_tokens: 800,
        seed: 42
      },
      {
        timeout: 60000,
        headers: { "Content-Type": "application/json" }
      }
    );

    let answer = response.data?.choices?.[0]?.message?.content || 
                 response.data?.message || 
                 "I'm sorry, I couldn't generate a response. Please try again.";

    // Clean up the answer (remove any markdown artifacts)
    answer = answer.replace(/```/g, '').trim();

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

    // ✅ FIXED: Send ONLY the answer
    return api.sendMessage(answer, threadID, messageID);

  } catch (err) {
    console.error("BibleGPT Error:", err);
    return api.sendMessage("❌ Sorry, I couldn't generate a response. Please try again.", threadID, messageID);
  }
};
