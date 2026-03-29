const axios = require('axios');

module.exports.config = {
  name: "biblegpt",
  version: "2.0.0",
  role: 0,
  credits: "selov",
  description: "AI-powered Bible study assistant",
  commandCategory: "religion",
  usages: "/biblegpt <question>",
  cooldowns: 3,
  aliases: ["bibleai", "bibleask"]
};

// Store user conversation history
if (!global.bibleAIUsers) global.bibleAIUsers = {};

// Bible context for the AI - helps guide responses
const BIBLE_CONTEXT = `You are BibleGPT, an AI assistant focused on answering questions about the Bible, theology, and Christian living. 
Base your answers on Scripture. Keep responses helpful, accurate, and respectful.`;

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, senderID } = event;
  const userQuestion = args.join(" ").trim();

  if (!userQuestion) {
    return api.sendMessage(
      `📖 BibleGPT\n━━━━━━━━━━━━━━━━\n` +
      `Ask me anything about the Bible!\n\n` +
      `Examples:\n` +
      `• /biblegpt What does the Bible say about love?\n` +
      `• /biblegpt Explain John 3:16\n` +
      `• /biblegpt How can I grow in faith?`,
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

  try {
    // Call the Vern REST API with the prompt
    const enhancedPrompt = `${BIBLE_CONTEXT}\n\nUser question: ${userQuestion}\n\nProvide a helpful, Bible-based response.`;
    
    const response = await axios.get(
      `https://vern-rest-api.vercel.app/api/chatgpt4?prompt=${encodeURIComponent(enhancedPrompt)}`,
      { timeout: 30000 }
    );

    let answer = response.data?.result || 
                 response.data?.response || 
                 response.data?.message || 
                 response.data?.answer ||
                 "I'm sorry, I couldn't generate a response. Please try again.";

    // Clean up the answer
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

    // Send ONLY the answer
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
