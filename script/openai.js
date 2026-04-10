const axios = require('axios');

module.exports.config = {
  name: "openai",
  version: "1.0.0",
  role: 0,
  credits: "selov",
  description: "Chat with OpenAI (text only)",
  commandCategory: "ai",
  usages: "/openai <question>",
  cooldowns: 3,
  aliases: ["open", "chatgpt", "jay"]
};

// Store conversation memory per user
if (!global.openaiMemory) global.openaiMemory = {};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, senderID } = event;
  let prompt = args.join(" ").trim();

  if (!prompt) {
    return api.sendMessage(
      `🤖 OPEN AI CHAT\n━━━━━━━━━━━━━━━━\n` +
      `Ask me anything!\n\n` +
      `Usage: /openai <question>\n` +
      `Examples:\n` +
      `• /openai ai bayut\n` +
      `• /openai ayw ana oy?\n` +
      `• /openai taronga ko\n` +
      `• /openai Hungiti ko`,
      threadID,
      messageID
    );
  }

  // Show typing indicator
  api.sendTypingIndicator(threadID, true);

  const processingMsg = await api.sendMessage(`🤔 nagiisip si openai... kunyare merong utak yarn`, threadID);

  try {
    // Get user's session ID or create new one
    let sessionId = global.openaiMemory[senderID];
    
    // Call the API
    const apiUrl = `https://rest-api-ruhv.onrender.com/api/jay?prompt=${encodeURIComponent(prompt)}&uid=${senderID}`;
    
    const response = await axios.get(apiUrl, { timeout: 30000 });
    
    // Extract response text
    let replyText = response.data?.response || 
                    response.data?.answer || 
                    response.data?.result ||
                    "Sorry, I couldn't process that request.";
    
    // Save session ID if provided
    if (response.data?.session_id) {
      global.openaiMemory[senderID] = response.data.session_id;
    }
    
    // Clean up the response
    replyText = replyText.replace(/```/g, '').trim();
    
    // Delete processing message
    await api.unsendMessage(processingMsg.messageID);
    
    // Send ONLY the response (no extra formatting)
    return api.sendMessage(replyText, threadID, messageID);
    
  } catch (err) {
    console.error("OpenAI Error:", err);
    
    let errorMsg = "❌ pasayloa ko, hindi ko kayang i proseso ang iyong requests . Hintayin monalang or ulitin ito mayamaya";
    
    if (err.code === 'ECONNABORTED') {
      errorMsg = "❌ ubos na ang time extend kanalang. Balik kanalang bukas ";
    } else if (err.response?.status === 500) {
      errorMsg = "❌ Server ang problema . Please try again later.";
    }
    
    await api.editMessage(errorMsg, processingMsg.messageID);
  }
};
