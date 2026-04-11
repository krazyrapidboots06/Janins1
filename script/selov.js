const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

module.exports.config = {
  name: "selov",
  version: "3.0.0",
  role: 0,
  credits: "aiv3",
  description: "AI with Tsundere voice TTS (AI response + audio)",
  commandCategory: "ai",
  usages: "/aiv3 <question>",
  cooldowns: 5,
  aliases: ["tsundere", "tsuntsun", "aitts"]
};

// Store conversation memory per user
if (!global.aiv3Memory) global.aiv3Memory = {};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, senderID } = event;
  let prompt = args.join(" ").trim();

  if (!prompt) {
    return api.sendMessage(
      `🎙️ Selov AI TTS\n━━━━━━━━━━━━━━━━\n` +
      `Ask me anything and I'll respond with Tsundere voice!\n\n` +
      `Usage: /selov <question>\n` +
      `Examples:\n` +
      `• /selov Hello, how are you?\n` +
      `• /selov What is your name?\n` +
      `• /selov Tell me a joke\n` +
      `• /selov Kumusta kana?`,
      threadID,
      messageID
    );
  }

  // Show typing indicator
  api.sendTypingIndicator(threadID, true);

  try {
    // Step 1: Get AI response from ChatGPT API
    const aiUrl = `https://rest-api-ruhv.onrender.com/api/chatgptfree?prompt=${encodeURIComponent(prompt)}`;
    
    const aiResponse = await axios.get(aiUrl, { timeout: 30000 });
    
    let aiText = aiResponse.data?.result?.answer || 
                 aiResponse.data?.answer || 
                 "Sorry, I couldn't process that request. Baka!";
    
    // Store in memory (optional)
    if (!global.aiv3Memory[senderID]) {
      global.aiv3Memory[senderID] = [];
    }
    global.aiv3Memory[senderID].push({
      prompt: prompt,
      response: aiText,
      timestamp: Date.now()
    });
    
    // Limit memory to last 10
    if (global.aiv3Memory[senderID].length > 10) {
      global.aiv3Memory[senderID].shift();
    }
    
    // Step 2: Convert AI response to Tsundere voice
    const ttsUrl = `https://restapijay.onrender.com/api/api/ai/tsundere?text=${encodeURIComponent(aiText)}`;
    
    const ttsResponse = await axios.get(ttsUrl, { timeout: 30000 });
    
    const audioUrl = ttsResponse.data?.result?.audio || ttsResponse.data?.audio;
    
    if (!audioUrl) {
      throw new Error("No audio URL received");
    }
    
    // Create cache directory
    const cacheDir = path.join(__dirname, "cache", "aiv3");
    await fs.ensureDir(cacheDir);
    
    const audioPath = path.join(cacheDir, `aiv3_${Date.now()}.mp3`);
    
    // Download audio
    const audioResponse = await axios.get(audioUrl, {
      responseType: "arraybuffer",
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    });
    
    fs.writeFileSync(audioPath, audioResponse.data);
    
    // Check file size
    const stats = fs.statSync(audioPath);
    if (stats.size === 0) {
      throw new Error("Downloaded audio file is empty");
    }
    
    // Send ONLY audio
    api.sendMessage({
      attachment: fs.createReadStream(audioPath)
    }, threadID, () => {
      setTimeout(() => {
        try {
          if (fs.existsSync(audioPath)) {
            fs.unlinkSync(audioPath);
          }
        } catch (e) {}
      }, 10000);
    }, messageID);
    
  } catch (err) {
    console.error("AIv3 Error:", err);
    
    let errorMsg = "❌ Failed to generate Tsundere response. Please try again.";
    
    if (err.code === 'ECONNABORTED') {
      errorMsg = "❌ Request timed out. Please try again.";
    } else if (err.response?.status === 404) {
      errorMsg = "❌ API endpoint not found.";
    } else if (err.response?.status === 500) {
      errorMsg = "❌ Server error. Please try again later.";
    }
    
    api.sendMessage(errorMsg, threadID, messageID);
  }
};
