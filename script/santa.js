const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

module.exports.config = {
  name: "santa",
  version: "8.0.0",
  role: 0,
  credits: "selov",
  description: "Santa AI with voice response (TTS audio only)",
  commandCategory: "ai",
  usages: "/santa <question>",
  cooldowns: 5
};

// Simple memory per thread
const memory = {};

// Santa character persona for AI
const SANTA_PERSONA = `You are Santa Claus. You are jolly, kind, and speak with warmth and cheer. 
You often laugh with "Ho ho ho!". You created or made by selov asx`;

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
    
    // Convert to speech
    const ttsText = encodeURIComponent(replyText);
    
    // Try different TTS APIs
    let audioData = null;
    
    // Try StreamElements first (Adam - male voice)
    try {
      const adamUrl = `https://api.streamelements.com/kappa/v2/speech?voice=Adam&text=${ttsText}`;
      const response = await axios.get(adamUrl, {
        responseType: "arraybuffer",
        timeout: 15000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      if (response.data && response.data.length > 1000) {
        audioData = response.data;
      }
    } catch (e) {
      console.log("Adam voice failed, trying Brian...");
    }
    
    // Try Brian if Adam failed
    if (!audioData) {
      try {
        const brianUrl = `https://api.streamelements.com/kappa/v2/speech?voice=Brian&text=${ttsText}`;
        const response = await axios.get(brianUrl, {
          responseType: "arraybuffer",
          timeout: 15000,
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        if (response.data && response.data.length > 1000) {
          audioData = response.data;
        }
      } catch (e) {
        console.log("Brian voice failed, trying Google...");
      }
    }
    
    // Fallback to Google TTS
    if (!audioData) {
      const googleUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=en&client=tw-ob&q=${ttsText}`;
      const response = await axios.get(googleUrl, {
        responseType: "arraybuffer",
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Referer': 'http://translate.google.com/'
        }
      });
      audioData = response.data;
    }
    
    if (!audioData || audioData.length < 1000) {
      throw new Error("No TTS available");
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
