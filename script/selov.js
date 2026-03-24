const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

module.exports.config = {
  name: "selov",
  version: "1.0.0",
  role: 0,
  credits: "selov",
  description: "AI with ElevenLabs voice response",
  commandCategory: "ai",
  usages: "/selov <question>",
  cooldowns: 5
};

// ElevenLabs API Configuration
const ELEVENLABS_API_KEY = "sk_8f3a039743a8814dae5b975de5f4b9964e5fa0c61f11b0e9"; // You need to get this from elevenlabs.io
const VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // Rachel voice (female) - change to male voice if desired

// Alternative male voices for ElevenLabs:
// "ErXwobaYiN019PkySvjV" - Antoni (male)
// "TxGEqnHWrfWFTfGW9XjX" - Josh (male)
// "VR6AewLTigWG4xSOukaG" - Arnold (male)

// Simple memory per thread
const memory = {};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, senderID } = event;
  
  let prompt = args.join(" ").trim();
  
  if (!prompt) {
    return api.sendMessage(
      `🔊 AI TTS COMMAND\n━━━━━━━━━━━━━━━━\n` +
      `Usage: /aitts <question>\n\n` +
      `Examples:\n` +
      `/selov What is the meaning of life?\n` +
      `/selov Tell me a joke\n` +
      `/selov How are you today?`,
      threadID,
      messageID
    );
  }
  
  try {
    // Get user name
    const user = await api.getUserInfo(senderID);
    const senderName = user[senderID]?.name || "User";
    const firstName = senderName.split(' ')[0] || senderName;
    
    // Initialize memory
    if (!memory[threadID]) {
      memory[threadID] = {
        users: {},
        conversations: []
      };
    }
    
    memory[threadID].users[senderID] = {
      name: senderName,
      firstName: firstName,
      lastSeen: Date.now(),
      interactions: (memory[threadID].users[senderID]?.interactions || 0) + 1
    };
    
    // Show typing indicator
    api.sendTypingIndicator(threadID, true);
    
    // Get AI response from the API
    const aiUrl = `https://restapi-ratx.onrender.com/api/jay?prompt=${encodeURIComponent(prompt)}&uid=${senderID}`;
    const aiResponse = await axios.get(aiUrl, { timeout: 20000 });
    
    let replyText = "I'm sorry, I couldn't process that request.";
    
    if (aiResponse.data) {
      if (aiResponse.data.response) replyText = aiResponse.data.response;
      else if (aiResponse.data.message) replyText = aiResponse.data.message;
      else if (aiResponse.data.result) replyText = aiResponse.data.result;
      else if (aiResponse.data.answer) replyText = aiResponse.data.answer;
      else if (typeof aiResponse.data === 'string') replyText = aiResponse.data;
    }
    
    // Limit length for ElevenLabs (max 500 characters)
    if (replyText.length > 500) {
      replyText = replyText.substring(0, 497) + "...";
    }
    
    // Store conversation
    memory[threadID].conversations.push({
      user: senderID,
      userName: firstName,
      prompt: prompt,
      response: replyText,
      timestamp: Date.now()
    });
    
    if (memory[threadID].conversations.length > 10) {
      memory[threadID].conversations.shift();
    }
    
    // Create cache directory
    const cacheDir = path.join(__dirname, "cache", "aitts");
    await fs.ensureDir(cacheDir);
    
    // Convert to speech using ElevenLabs
    const ttsUrl = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`;
    
    const ttsPayload = {
      text: replyText,
      model_id: "eleven_monolingual_v1",
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.5
      }
    };
    
    const audioPath = path.join(cacheDir, `aitts_${Date.now()}.mp3`);
    
    const audioResponse = await axios.post(ttsUrl, ttsPayload, {
      responseType: "arraybuffer",
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_API_KEY,
        'Accept': 'audio/mpeg'
      }
    });
    
    fs.writeFileSync(audioPath, audioResponse.data);
    
    // Check file size
    const stats = fs.statSync(audioPath);
    if (stats.size === 0) {
      throw new Error("Downloaded file is empty");
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
      }, 5000);
    }, messageID);
    
  } catch (err) {
    console.error("AI TTS Error:", err);
    
    // Silent fail - no error message to user
  }
};
