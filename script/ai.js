const axios = require("axios");
const fs = require("fs");
const path = require("path");

module.exports.config = {
  name: "ai",
  version: "8.0.0",
  hasPermssion: 0,
  credits: "selov",
  description: "AI with normal boy voice response",
  commandCategory: "search",
  usages: "/ai <text>",
  cooldowns: 3,
  usePrefix: true
};

// Simple memory per thread with user profiles
const memory = {};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, attachments, senderID } = event;

  // Join all args to get the full prompt
  let prompt = args.join(" ").trim();
  
  try {
    // Get user info with full details
    const user = await api.getUserInfo(senderID);
    const userData = user[senderID];
    const senderName = userData?.name || "User";
    const firstName = senderName.split(' ')[0] || senderName;

    // Initialize memory with user profile
    if (!memory[threadID]) {
      memory[threadID] = {
        users: {},
        conversations: []
      };
    }

    // Store user info in thread memory
    memory[threadID].users[senderID] = {
      name: senderName,
      firstName: firstName,
      lastSeen: Date.now(),
      interactions: (memory[threadID].users[senderID]?.interactions || 0) + 1
    };

    // Check image attachment
    if (attachments && attachments.length > 0) {
      const photo = attachments.find(a => a.type === "photo");
      if (photo) {
        const imageUrl = photo.url;
        prompt = `Describe this photo in detail like a human. The user's name is ${firstName}:\n${imageUrl}`;
      }
    }

    if (!prompt) {
      return api.sendMessage(
        `📌 Hello ${firstName}! Ask me anything.\n\nExample: /ai what is your name?`,
        threadID,
        messageID
      );
    }

    // Send typing indicator (visual only, no message)
    api.sendTypingIndicator(threadID, true);

    // Get AI response (no visible message)
    const enhancedPrompt = `The user's name is ${firstName} (full name: ${senderName}). Please address them by their name in your response naturally. Keep your response concise and friendly. Question: ${prompt}`;
    const aiUrl = `https://vern-rest-api.vercel.app/api/chatgpt4?prompt=${encodeURIComponent(enhancedPrompt)}`;
    const aiResponse = await axios.get(aiUrl);

    if (!aiResponse.data) {
      return api.sendMessage("❌ No response from AI server.", threadID, messageID);
    }

    // Detect response format
    const replyText =
      aiResponse.data.result ||
      aiResponse.data.response ||
      aiResponse.data.message ||
      aiResponse.data.answer;

    if (!replyText) {
      return api.sendMessage("❌ AI returned an unknown response format.", threadID, messageID);
    }

    // Store conversation in memory
    memory[threadID].conversations.push({
      user: senderID,
      userName: firstName,
      prompt: prompt,
      response: replyText,
      timestamp: Date.now()
    });

    // Keep only last 10 conversations
    if (memory[threadID].conversations.length > 10) {
      memory[threadID].conversations.shift();
    }

    // Create cache directory
    const cacheDir = path.join(__dirname, "cache");
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    // Convert text to speech with NORMAL BOY VOICE
    // Using en-US-Wavenet-A which is a standard male voice
    const ttsText = replyText.substring(0, 200); // Limit to 200 chars
    
    // Using StreamElements API for better voice quality
    const ttsUrl = `https://api.streamelements.com/kappa/v2/speech?voice=Joey&text=${encodeURIComponent(ttsText)}`;
    
    const audioPath = path.join(cacheDir, `tts_${Date.now()}.mp3`);
    const audioResponse = await axios.get(ttsUrl, { 
      responseType: "arraybuffer",
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    fs.writeFileSync(audioPath, audioResponse.data);

    // Send ONLY audio - no text messages at all
    api.sendMessage(
      {
        attachment: fs.createReadStream(audioPath)
      },
      threadID,
      (err) => {
        if (err) console.error("Error sending audio:", err);
        // Clean up file
        try {
          if (fs.existsSync(audioPath)) {
            fs.unlinkSync(audioPath);
          }
        } catch (e) {
          console.error("Error deleting file:", e);
        }
      },
      messageID
    );

  } catch (err) {
    console.error("AI TTS Error:", err);
    // Silent fail - no error message shown to user
    // Just log to console
  }
};
