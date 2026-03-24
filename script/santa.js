const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

module.exports.config = {
  name: "santa",
  version: "6.0.0",
  role: 0,
  credits: "selov",
  description: "Santa AI voice response (TTS audio only)",
  commandCategory: "ai",
  usages: "/santa <text>",
  cooldowns: 3
};

// Simple memory per thread
const memory = {};

// VoiceRSS API Key
const VOICE_RSS_KEY = "35bfa5b8240b40caa734948a13d0f2fe";

// Santa character persona
const SANTA_PERSONA = `You are Santa Claus. You are jolly, kind, and speak with warmth and cheer. 
You often laugh with "Ho ho ho!" and spread Christmas spirit. 
You know about children being naughty or nice, and you love giving gifts. 
Keep your responses friendly, magical, and festive. 
Address the user by their name if known.`;

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, senderID } = event;
  
  let prompt = args.join(" ").trim();
  
  try {
    // Get user info
    const user = await api.getUserInfo(senderID);
    const userData = user[senderID];
    const senderName = userData?.name || "User";
    const firstName = senderName.split(' ')[0] || senderName;
    
    // Initialize memory
    if (!memory[threadID]) {
      memory[threadID] = {
        users: {},
        conversations: []
      };
    }
    
    // Store user info
    memory[threadID].users[senderID] = {
      name: senderName,
      firstName: firstName,
      lastSeen: Date.now(),
      interactions: (memory[threadID].users[senderID]?.interactions || 0) + 1
    };
    
    if (!prompt) {
      return api.sendMessage(
        `🎅 Ho ho ho! Hello ${firstName}! What would you like to ask Santa?\n\nExample: /santa What gift should I give my friend?`,
        threadID,
        messageID
      );
    }
    
    // Show typing indicator
    api.sendTypingIndicator(threadID, true);
    
    // Get AI response using Vern API
    const enhancedPrompt = `${SANTA_PERSONA}\n\nThe user's name is ${firstName} (full name: ${senderName}). Please address them by their name in your response naturally. Keep your response warm, cheerful, and festive (under 200 characters). Question: ${prompt}`;
    
    const aiUrl = `https://vern-rest-api.vercel.app/api/chatgpt4?prompt=${encodeURIComponent(enhancedPrompt)}`;
    const aiResponse = await axios.get(aiUrl, { timeout: 20000 });
    
    let replyText = "Ho ho ho! Merry Christmas! I'm Santa, and I'm here to help you!";
    
    // Parse different response formats
    if (aiResponse.data) {
      if (aiResponse.data.result) replyText = aiResponse.data.result;
      else if (aiResponse.data.response) replyText = aiResponse.data.response;
      else if (aiResponse.data.message) replyText = aiResponse.data.message;
      else if (aiResponse.data.answer) replyText = aiResponse.data.answer;
      else if (aiResponse.data.content) replyText = aiResponse.data.content;
      else if (typeof aiResponse.data === 'string') replyText = aiResponse.data;
    }
    
    // Ensure Santa-style response (under 200 chars for TTS)
    if (replyText.length > 200) {
      replyText = replyText.substring(0, 197) + "...";
    }
    
    if (!replyText.includes("Ho ho ho") && !replyText.includes("ho ho ho")) {
      if (Math.random() > 0.5) {
        replyText = "Ho ho ho! " + replyText;
      }
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
    const cacheDir = path.join(__dirname, "cache", "santa");
    await fs.ensureDir(cacheDir);
    
    // Convert text to speech using VoiceRSS with deep male voice
    const ttsText = encodeURIComponent(replyText);
    
    // VoiceRSS - using US English male voice (en-us)
    // Available voices: en-us (US English male), en-uk (UK English male), en-au (Australian male)
    const ttsUrl = `https://api.voicerss.org/?key=${VOICE_RSS_KEY}&hl=en-us&src=${ttsText}&c=MP3&f=44khz_16bit_stereo`;
    
    const audioPath = path.join(cacheDir, `santa_${Date.now()}.mp3`);
    
    const audioResponse = await axios.get(ttsUrl, {
      responseType: "arraybuffer",
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
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
    }, threadID, (err) => {
      if (err) console.error("Error sending audio:", err);
      // Clean up file after 5 seconds
      setTimeout(() => {
        try {
          if (fs.existsSync(audioPath)) {
            fs.unlinkSync(audioPath);
          }
        } catch (e) {}
      }, 5000);
    }, messageID);
    
  } catch (err) {
    console.error("Santa Command Error:", err);
    
    // Silent fail - no error message to user
    // Just log to console
  }
};
