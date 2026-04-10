const axios = require('axios');

module.exports.config = {
  name: "openai",
  version: "1.1.0",
  role: 0,
  credits: "selov",
  description: "Chat with OpenAI (text only)",
  commandCategory: "ai",
  usages: "/openai <question>",
  cooldowns: 3,
  aliases: ["open", "jay", "openai"]
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
      `• /openai sure ou\n` +
      `• /openai ayaw oy\n` +
      `• /openai maloy oy ka`,
      threadID,
      messageID
    );
  }

  // Show typing indicator
  api.sendTypingIndicator(threadID, true);

  try {
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
    
    // Send ONLY the answer
    return api.sendMessage(replyText, threadID, messageID);
    
  } catch (err) {
    console.error("OpenAI Error:", err);
    
    let errorMsg = "❌ pasensya na diko ma process ang iyong requests. balik kanalang.";
    
    if (err.code === 'ECONNABORTED') {
      errorMsg = "❌ walang kanang oras extend kanalang. balik ka mayamaya.";
    } else if (err.response?.status === 500) {
      errorMsg = "❌ sira ang server kasi may problema. Please try again later.";
    }
    
    return api.sendMessage(errorMsg, threadID, messageID);
  }
};
