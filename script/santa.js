const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

// Auth token from Uint8Array
const cidBytes = new Uint8Array([
  0x24, 0x52, 0x43, 0x41, 0x6e, 0x6f, 0x6e, 0x79,
  0x6d, 0x6f, 0x75, 0x73, 0x49, 0x44, 0x3a, 0x31,
  0x33, 0x65, 0x38, 0x37, 0x35, 0x33, 0x61, 0x65,
  0x36, 0x31, 0x39, 0x34, 0x63, 0x37, 0x62, 0x39,
  0x32, 0x37, 0x33, 0x32, 0x64, 0x36, 0x36, 0x64,
  0x37, 0x30, 0x32, 0x33, 0x30, 0x37, 0x32
]);

const authBytes = new Uint8Array([
  0x77, 0x76, 0x65, 0x62, 0x6e, 0x79, 0x75, 0x36, 0x36, 0x36, 0x38, 0x37, 0x35, 0x36, 0x68, 0x34,
  0x35, 0x67, 0x66, 0x65, 0x63, 0x64, 0x66, 0x65, 0x67, 0x6e, 0x68, 0x6d, 0x75, 0x36, 0x6b, 0x6a,
  0x35, 0x68, 0x36, 0x34, 0x67, 0x35, 0x33, 0x66, 0x76, 0x72, 0x62, 0x67, 0x6e, 0x79, 0x35
]);

function decodeUint8Array(bytes) {
  return new TextDecoder().decode(bytes);
}

const CUSTOMER_ID = decodeUint8Array(cidBytes);
const AUTH_TOKEN = decodeUint8Array(authBytes);

const API_CONFIG = {
  baseUrl: 'https://svara.aculix.net',
  endpoint: '/generate-speech',
  headers: {
    'user-agent': 'NB Android/1.0.0',
    'accept-encoding': 'gzip',
    'content-type': 'application/json',
    'authorization': AUTH_TOKEN
  }
};

module.exports.config = {
  name: "santa",
  version: "2.0.0",
  role: 0,
  credits: "selov",
  description: "Santa AI voice response (TTS audio only)",
  commandCategory: "ai",
  usages: "/santa <text>",
  cooldowns: 3
};

// Simple memory per thread
const memory = {};

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
    
    // Get AI response from ChatGPT API
    const enhancedPrompt = `${SANTA_PERSONA}\n\nThe user's name is ${firstName} (full name: ${senderName}). Please address them by their name in your response naturally. Keep your response warm, cheerful, and festive. Question: ${prompt}`;
    
    const aiUrl = `https://deku-rest-api-spring.onrender.com/chatgpt?prompt=${encodeURIComponent(enhancedPrompt)}`;
    const aiResponse = await axios.get(aiUrl, { timeout: 15000 });
    
    let replyText = "Ho ho ho! I'm sorry, I couldn't process that request.";
    
    if (aiResponse.data) {
      if (aiResponse.data.response) replyText = aiResponse.data.response;
      else if (aiResponse.data.message) replyText = aiResponse.data.message;
      else if (aiResponse.data.result) replyText = aiResponse.data.result;
      else if (aiResponse.data.answer) replyText = aiResponse.data.answer;
      else if (typeof aiResponse.data === 'string') replyText = aiResponse.data;
    }
    
    // Ensure Santa-style response
    if (!replyText.includes("Ho ho ho") && !replyText.includes("ho ho ho")) {
      if (Math.random() > 0.7) {
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
    
    // Convert text to speech using Svara API with Santa voice
    const ttsText = replyText.substring(0, 300);
    
    const ttsPayload = {
      text: ttsText,
      voice: "santa",
      customerId: CUSTOMER_ID
    };
    
    const audioPath = path.join(cacheDir, `santa_${Date.now()}.mp3`);
    
    // Make request to Svara API
    const audioResponse = await axios.post(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoint}`,
      ttsPayload,
      {
        responseType: "arraybuffer",
        timeout: 30000,
        headers: API_CONFIG.headers
      }
    );
    
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
      // Clean up file
      try {
        if (fs.existsSync(audioPath)) {
          fs.unlinkSync(audioPath);
        }
      } catch (e) {
        console.error("Error deleting file:", e);
      }
    }, messageID);
    
  } catch (err) {
    console.error("Santa Command Error:", err);
    
    // Silent fail - no error message to user
    // Just log to console
  }
};
