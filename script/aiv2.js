const axios = require('axios');

module.exports.config = {
  name: "aiv2",
  version: "1.0.0",
  role: 0,
  credits: "selov",
  description: "Bible AI assistant (answer only)",
  commandCategory: "ai",
  usages: "/aiv2 <question>",
  cooldowns: 3,
  aliases: ["bibleai", "bibleask2"]
};

// Store user sessions
if (!global.aiv2Sessions) global.aiv2Sessions = {};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, senderID } = event;
  const userQuestion = args.join(" ").trim();

  if (!userQuestion) {
    return api.sendMessage(
      `📖 Bible AI\n━━━━━━━━━━━━━━━━\n` +
      `Ask me anything about the Bible!\n\n` +
      `Examples:\n` +
      `• /aiv2 What does the Bible say about love?\n` +
      `• /aiv2 Explain John 3:16\n` +
      `• /aiv2 Nagkasala ako, ano ang gagawin ko?`,
      threadID,
      messageID
    );
  }

  // Show typing indicator
  api.sendTypingIndicator(threadID, true);

  try {
    // Get user's session ID or create new one
    let sessionId = global.aiv2Sessions[senderID];
    
    // Call the BibleGPT API
    const apiUrl = `https://restapi-ratx.onrender.com/api/biblegpt?q=${encodeURIComponent(userQuestion)}&session_id=${sessionId || ''}`;
    
    const response = await axios.get(apiUrl, { timeout: 30000 });
    
    // Extract answer from response
    let answer = response.data?.result?.answer || 
                 response.data?.answer || 
                 response.data?.response ||
                 "I'm sorry, I couldn't process that request. Please try again.";
    
    // Save session ID for conversation continuity
    if (response.data?.session_id) {
      global.aiv2Sessions[senderID] = response.data.session_id;
    }
    
    // Clean up answer (remove markdown)
    answer = answer.replace(/```/g, '').trim();
    
    // Send ONLY the answer (no extra formatting)
    return api.sendMessage(answer, threadID, messageID);
    
  } catch (err) {
    console.error("AIv2 Error:", err);
    
    let errorMsg = "❌ Sorry, I couldn't process your request. Please try again.";
    
    if (err.code === 'ECONNABORTED') {
      errorMsg = "❌ Request timed out. Please try again.";
    } else if (err.response?.status === 500) {
      errorMsg = "❌ Server error. Please try again later.";
    }
    
    return api.sendMessage(errorMsg, threadID, messageID);
  }
};
