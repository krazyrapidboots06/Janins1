const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

module.exports.config = {
  name: "santa",
  version: "9.0.0",
  role: 0,
  credits: "selov",
  description: "Santa AI with deep male voice (TTS audio only)",
  commandCategory: "ai",
  usages: "/santa <question>",
  cooldowns: 5
};

// Simple memory per thread
const memory = {};

// Santa character persona for AI
const SANTA_PERSONA = `You are Santa Claus. You are jolly, kind, and speak with warmth and cheer. 
You often laugh with "Ho ho ho!" and spread Christmas spirit. 
Keep your responses warm, cheerful, and festive. 
Keep your answers short and friendly (under 150 characters).`;

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
    
    // Convert to speech - ONLY MALE VOICES
    const ttsText = encodeURIComponent(replyText);
    let audioData = null;
    
    // MALE VOICES ONLY - No female voices
    const maleVoices = [
      { name: "Adam", url: `https://api.streamelements.com/kappa/v2/speech?voice=Adam&text=${ttsText}` },
      { name: "Brian", url: `https://api.streamelements.com/kappa/v2/speech?voice=Brian&text=${ttsText}` },
      { name: "Justin", url: `https://api.streamelements.com/kappa/v2/speech?voice=Justin&text=${ttsText}` },
      { name: "Joey", url: `https://api.streamelements.com/kappa/v2/speech?voice=Joey&text=${ttsText}` }
    ];
    
    for (const voice of maleVoices) {
      try {
        const response = await axios.get(voice.url, {
          responseType: "arraybuffer",
          timeout: 15000,
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        
        if (response.data && response.data.length > 1000) {
          audioData = response.data;
          console.log(`Using male voice: ${voice.name}`);
          break;
        }
      } catch (e) {
        console.log(`${voice.name} failed, trying next...`);
      }
    }
    
    // If all male voices fail, try VoiceRSS with male voice
    if (!audioData) {
      const VOICE_RSS_KEY = "35bfa5b8240b40caa734948a13d0f2fe";
      const maleVoiceUrl = `https://api.voicerss.org/?key=${VOICE_RSS_KEY}&hl=en-us&src=${ttsText}&c=MP3`;
      
      try {
        const response = await axios.get(maleVoiceUrl, {
          responseType: "arraybuffer",
          timeout: 15000,
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        
        if (response.data && response.data.length > 1000) {
          audioData = response.data;
          console.log("Using VoiceRSS male voice");
        }
      } catch (e) {
        console.log("VoiceRSS failed");
      }
    }
    
    if (!audioData || audioData.length < 1000) {
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
