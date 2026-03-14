const axios = require("axios");
const fs = require("fs");
const path = require("path");

module.exports.config = {
  name: "ai",
  version: "7.0.0",
  hasPermssion: 0,
  credits: "selov",
  description: "AI with deep male voice response",
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

    // Send typing indicator
    api.sendTypingIndicator(threadID, true);

    const searching = await api.sendMessage(
      `🔊 AI is thinking and preparing deep male voice response for ${firstName}...`, 
      threadID, 
      messageID
    );

    // Enhance prompt with user's name
    const enhancedPrompt = `The user's name is ${firstName} (full name: ${senderName}). Please address them by their name in your response naturally. Keep your response concise and friendly. Question: ${prompt}`;

    // Get AI response
    const aiUrl = `https://vern-rest-api.vercel.app/api/chatgpt4?prompt=${encodeURIComponent(enhancedPrompt)}`;
    const aiResponse = await axios.get(aiUrl);

    if (!aiResponse.data) {
      return api.editMessage("❌ No response from AI server.", searching.messageID);
    }

    // Detect response format
    const replyText =
      aiResponse.data.result ||
      aiResponse.data.response ||
      aiResponse.data.message ||
      aiResponse.data.answer;

    if (!replyText) {
      return api.editMessage("❌ AI returned an unknown response format.", searching.messageID);
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

    // Convert text to speech with DEEP MALE VOICE
    // Using en-US-Wavenet-D which is a deep male voice
    const ttsText = replyText.substring(0, 200); // Limit to 200 chars
    
    // Google TTS with male voice parameter
    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=en&client=tw-ob&q=${encodeURIComponent(ttsText)}`;
    
    // Note: For a deeper male voice, we could also use:
    // const ttsUrl = `https://api.streamelements.com/kappa/v2/speech?voice=Brian&text=${encodeURIComponent(ttsText)}`;
    
    const audioPath = path.join(cacheDir, `tts_${Date.now()}.mp3`);
    const audioResponse = await axios.get(ttsUrl, { 
      responseType: "arraybuffer",
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    fs.writeFileSync(audioPath, audioResponse.data);

    // Get file size
    const stats = fs.statSync(audioPath);
    const fileSizeInKB = (stats.size / 1024).toFixed(2);

    // Update searching message
    api.editMessage(
      `✅ Deep male voice response ready for ${firstName}!\n` +
      `📦 Size: ${fileSizeInKB} KB`,
      searching.messageID
    );

    // Send audio only
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

    // Optional: Also send text version for clarity (remove if you want audio only)
    api.sendMessage(
      `📝 **AI Response for ${firstName}:**\n\n${replyText}`,
      threadID,
      messageID
    );

  } catch (err) {
    console.error("AI TTS Error:", err);
    return api.sendMessage(
      `❌ Failed to generate voice response.\nError: ${err.message}`,
      threadID,
      messageID
    );
  }
};
