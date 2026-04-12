const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

module.exports.config = {
  name: "aiv3",
  version: "1.0.0",
  role: 0,
  credits: "selov",
  description: "AI with voice response (audio only)",
  commandCategory: "ai",
  usages: "/aiv3 <question>",
  cooldowns: 5,
  aliases: ["aitts", "voiceai"]
};

// Store user sessions
if (!global.aiv3Memory) global.aiv3Memory = {};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, senderID } = event;
  let prompt = args.join(" ").trim();

  if (!prompt) {
    return; // Silent fail - no message
  }

  // Show typing indicator
  api.sendTypingIndicator(threadID, true);

  try {
    // Step 1: Get AI response from ChatGPT API
    const aiUrl = `https://restapijay.onrender.com/api/Chatgpt?prompt=${encodeURIComponent(prompt)}&uid=${senderID}`;
    
    const aiResponse = await axios.get(aiUrl, { timeout: 20000 });
    
    let aiText = aiResponse.data?.response || 
                 aiResponse.data?.answer || 
                 "Sorry, I couldn't process that request.";
    
    // Store in memory
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
    
    // Step 2: Convert AI response to TTS
    const ttsUrl = `https://restapijay.onrender.com/api/svara/tts?text=${encodeURIComponent(aiText)}&voice=Santa`;
    
    const ttsResponse = await axios.get(ttsUrl, { timeout: 30000 });
    
    const audioUrl = ttsResponse.data?.audio_url;
    
    if (!audioUrl) {
      throw new Error("No audio URL received");
    }
    
    // Create cache directory
    const cacheDir = path.join(__dirname, "cache", "aiv3");
    await fs.ensureDir(cacheDir);
    
    const audioPath = path.join(cacheDir, `aiv3_${Date.now()}.wav`);
    
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
    
    // Send ONLY audio (no text message)
    api.sendMessage({
      attachment: fs.createReadStream(audioPath)
    }, threadID, () => {
      // Clean up file after sending
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
    // Silent fail - no error message to user
  }
};
