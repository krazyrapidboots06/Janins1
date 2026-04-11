const axios = require('axios');

module.exports.config = {
  name: "aiv2",
  version: "2.0.0",
  role: 0,
  credits: "selov",
  description: "Bible AI assistant with paragraph-style responses",
  commandCategory: "ai",
  usages: "/aiv2 <question>",
  cooldowns: 3,
  aliases: ["bibleai2", "bibleask2"]
};

// Store user sessions
if (!global.aiv2Sessions) global.aiv2Sessions = {};

// Custom prompt to format responses as paragraphs
const FORMAT_PROMPT = `Please respond in a warm, pastoral tone with proper paragraph formatting. 
Write in Taglish (mix of Tagalog and English). Use Scripture verses when appropriate.
Format your response with:
- First paragraph: Empathetic response addressing the user's concern with a Bible verse
- Then numbered list (1., 2., 3., etc.) for practical steps or key points
- Final paragraph: Encouraging conclusion

Keep the response helpful, compassionate, and Bible-based.`;

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, senderID } = event;
  const userQuestion = args.join(" ").trim();

  if (!userQuestion) {
    return api.sendMessage(
      `📖 Bible AI\n━━━━━━━━━━━━━━━━\n` +
      `Ask me anything about the Bible!\n\n` +
      `Examples:\n` +
      `• /aiv2 Ano ang gagawin ko kapag nagkasala ako?\n` +
      `• /aiv2 What does the Bible say about forgiveness?\n` +
      `• /aiv2 Explain John 3:16\n` +
      `• /aiv2 How can I grow in faith?`,
      threadID,
      messageID
    );
  }

  // Show typing indicator
  api.sendTypingIndicator(threadID, true);

  try {
    // Get user's session ID or create new one
    let sessionId = global.aiv2Sessions[senderID];
    
    // Enhanced prompt for paragraph-style response
    const enhancedQuestion = `${FORMAT_PROMPT}\n\nUser's question: ${userQuestion}`;
    
    // Call the BibleGPT API with enhanced prompt
    const apiUrl = `https://restapijay.onrender.com/api/biblegpt?q=${encodeURIComponent(enhancedQuestion)}&session_id=${sessionId || ''}`;
    
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
    
    // Clean up answer
    answer = answer.replace(/```/g, '').trim();
    
    // Send the paragraph-style answer
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
