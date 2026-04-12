const axios = require('axios');

module.exports.config = {
  name: "aria",
  version: "2.0.0",
  role: 0,
  credits: "selov",
  description: "AI assistant Aria",
  commandCategory: "ai",
  usages: "/aria <question>",
  cooldowns: 10,
  aliases: ["askaria", "ariaai"]
};

const API_URL = "https://apiremake-production.up.railway.app/api/aria";
const API_KEY = "d48ff6e54c518a8ff88fb11b6aa938508e5d4fb65479d8605527a95375ad7faa";

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, senderID } = event;
  let prompt = args.join(" ").trim();

  if (!prompt) {
    return api.sendMessage(
      `Usage: /aria <question>\nExample: /aria Who is Selov Asx on Facebook?`,
      threadID,
      messageID
    );
  }

  // Show typing indicator
  api.sendTypingIndicator(threadID, true);

  try {
    // Call the Aria API with API key
    const apiUrl = `${API_URL}?ask=${encodeURIComponent(prompt)}&stream=false&api_key=${API_KEY}`;
    
    const response = await axios.get(apiUrl, { 
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    });
    
    // Extract data from response
    const answer = response.data?.answer || "No answer found.";
    const sources = response.data?.sources || [];
    
    // Format the response with answer and sources
    let resultMsg = `${answer}\n\n`;
    
    if (sources.length > 0) {
      resultMsg += `📚 Sources:\n`;
      sources.forEach((source, index) => {
        resultMsg += `${index + 1}. ${source.title}\n`;
        resultMsg += `   ${source.url}\n`;
      });
    }
    
    // Send answer with sources
    return api.sendMessage(resultMsg.trim(), threadID, messageID);
    
  } catch (err) {
    console.error("Aria Error:", err);
    
    let errorMsg = "❌ Aria is currently unavailable. Please try again later.";
    
    if (err.code === 'ECONNABORTED') {
      errorMsg = "❌ Request timed out. The server may be waking up. Please try again in a moment.";
    }
    
    return api.sendMessage(errorMsg, threadID, messageID);
  }
};
