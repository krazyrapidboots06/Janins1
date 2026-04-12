const axios = require('axios');

module.exports.config = {
  name: "aiwebco",
  version: "2.0.0",
  role: 0,
  credits: "selov",
  description: "Web search with concise answers",
  commandCategory: "search",
  usages: "/webco <question>",
  cooldowns: 5,
  aliases: ["websearch", "ask"]
};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, senderID } = event;
  let query = args.join(" ").trim();

  if (!query) {
    return api.sendMessage(
      `Usage: /webco <question>\nExample: /webco Did you know Selov Asx on Facebook?`,
      threadID,
      messageID
    );
  }

  // Show typing indicator
  api.sendTypingIndicator(threadID, true);

  try {
    // Call the WebPilot API
    const apiUrl = `https://restapijay.onrender.com/api/webpilot?q=${encodeURIComponent(query)}`;
    
    const response = await axios.get(apiUrl, { 
      timeout: 20000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    // Extract answer
    let answer = response.data?.answer || 
                 response.data?.result || 
                 response.data?.response ||
                 response.data?.message ||
                 "No answer found.";
    
    // Clean up
    answer = answer.replace(/```/g, '').trim();
    
    // Limit length
    if (answer.length > 500) {
      answer = answer.substring(0, 497) + "...";
    }
    
    // Send ONLY the answer
    return api.sendMessage(answer, threadID, messageID);
    
  } catch (err) {
    console.error("WebCo Error:", err);
    
    let errorMsg = "❌ Failed to search. Please try again.";
    
    if (err.code === 'ECONNABORTED') {
      errorMsg = "❌ Request timed out. Please try again.";
    } else if (err.response?.status === 404) {
      errorMsg = "❌ Service unavailable. Please try again later.";
    }
    
    return api.sendMessage(errorMsg, threadID, messageID);
  }
};
