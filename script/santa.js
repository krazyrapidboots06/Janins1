const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

module.exports.config = {
  name: "santa",
  version: "11.0.0",
  role: 0,
  credits: "selov",
  description: "Santa AI with deep male voice (TTS audio only)",
  commandCategory: "ai",
  usages: "/santa <question>",
  cooldowns: 5
};

// StreamElements JWT Token
const STREAMELEMENTS_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJjaXRhZGVsIiwiZXhwIjoxNzg5OTAyMDA4LCJqdGkiOiI3YzNjNDI3ZC1mMDdjLTRlNzItOGU1Ny0yMzU3OWQ5YzEwYWQiLCJjaGFubmVsIjoiNjljMjZlYjhmOTk0Y2JlNjE2NzUzZGRkIiwicm9sZSI6Im93bmVyIiwiYXV0aFRva2VuIjoickUzZFVvLVNsbkNJVXFiTXBCeTB1dEp1UXRZcURhdS12ck9YUHhWQmVoT0R0bXVLIiwidXNlciI6IjY5YzI2ZWI4Zjk5NGNiZTYxNjc1M2RkYyIsInVzZXJfaWQiOiI2MzlkM2YyNy02MjAzLTRmYWMtYTQ0ZC05MTYxODRiZTU1Y2YiLCJ1c2VyX3JvbGUiOiJjcmVhdG9yIiwicHJvdmlkZXIiOiJ5b3V0dWJlIiwicHJvdmlkZXJfaWQiOiJVQ2hhamMtSmRzNDk1d0UzQVdGVl80VUEiLCJjaGFubmVsX2lkIjoiODBiZGViN2EtOWNhZS00MmU0LWFjOWYtYzE3ZGY2MWFmOWZkIiwiY3JlYXRvcl9pZCI6IjU3OGQwYTU0LTYzOTktNGM0OS1iYjZmLTViMjNjZTQ4Mjc1MSJ9.8BjgvA3z8s4u9npwHt2T_CEQnQFjyhMqKeUyWIhmLzU";

// Simple memory per thread
const memory = {};

// Santa character persona for AI
const SANTA_PERSONA = `You are Santa Claus. You are jolly, kind, and speak with warmth and cheer. 
You often laugh with "Ho ho ho!" and spread Christmas spirit. 
Keep your responses warm, cheerful, and festive. You created by selov`;

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, senderID } = event;
  
  let prompt = args.join(" ").trim();
  
  if (!prompt) {
    return api.sendMessage(
      `🎅 Ho ho ho! Hello! What would you like to ask Santa?\n\nExamples:\n/santa How are you?\n/santa What gift should I give my friend?\n/santa Tell me a Christmas joke`,
      threadID,
      messageID
    );
  }
  
  try {
    // Get user name
    const user = await api.getUserInfo(senderID);
    const senderName = user[senderID]?.name || "Friend";
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
    
    // Get AI response
    const enhancedPrompt = `${SANTA_PERSONA}\n\nThe user's name is ${firstName}. Please address them by their name in your response. Question: ${prompt}`;
    const aiUrl = `https://vern-rest-api.vercel.app/api/chatgpt4?prompt=${encodeURIComponent(enhancedPrompt)}`;
    const aiResponse = await axios.get(aiUrl, { timeout: 20000 });
    
    let replyText = "Ho ho ho! Merry Christmas! How can I help you today?";
    
    if (aiResponse.data) {
      if (aiResponse.data.result) replyText = aiResponse.data.result;
      else if (aiResponse.data.response) replyText = aiResponse.data.response;
      else if (aiResponse.data.message) replyText = aiResponse.data.message;
      else if (aiResponse.data.answer) replyText = aiResponse.data.answer;
      else if (typeof aiResponse.data === 'string') replyText = aiResponse.data;
    }
    
    // Add Santa style if missing
    if (!replyText.includes("Ho ho ho") && !replyText.includes("ho ho ho")) {
      if (Math.random() > 0.5) {
        replyText = "Ho ho ho! " + replyText;
      }
    }
    
    // Limit length for TTS
    if (replyText.length > 200) {
      replyText = replyText.substring(0, 197) + "...";
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
    
    // Convert to speech using StreamElements with JWT token
    const ttsText = encodeURIComponent(replyText);
    
    // Try different male voices
    const maleVoices = ['Adam', 'Brian', 'Justin', 'Joey'];
    let audioData = null;
    let usedVoice = null;
    
    for (const voice of maleVoices) {
      try {
        const ttsUrl = `https://api.streamelements.com/kappa/v2/speech?voice=${voice}&text=${ttsText}`;
        
        const response = await axios.get(ttsUrl, {
          responseType: "arraybuffer",
          timeout: 15000,
          headers: {
            'Authorization': `Bearer ${STREAMELEMENTS_TOKEN}`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        
        if (response.data && response.data.length > 1000) {
          audioData = response.data;
          usedVoice = voice;
          console.log(`Using male voice: ${voice}`);
          break;
        }
      } catch (e) {
        console.log(`${voice} voice failed: ${e.message}`);
      }
    }
    
    if (!audioData) {
      throw new Error("No male voice available");
    }
    
    const audioPath = path.join(cacheDir, `santa_${Date.now()}.mp3`);
    fs.writeFileSync(audioPath, audioData);
    
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
    console.error("Santa Command Error:", err);
    // Silent fail - no error message
  }
};
