const axios = require("axios");
const fs = require("fs");
const path = require("path");

module.exports.config = {
  name: "ai",
  version: "4.0.0",
  hasPermssion: 0,
  credits: "selov",
  description: "AI with voice response that knows your name",
  commandCategory: "search",
  usages: "ai <ask a questions>",
  cooldowns: 3
};

// Simple memory per thread with user profiles
const memory = {};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, attachments, senderID } = event;

  let prompt = args.join(" ").trim();

  try {
    // Get user info with full details
    const user = await api.getUserInfo(senderID);
    const userData = user[senderID];
    const senderName = userData?.name || "User";
    const firstName = senderName.split(' ')[0] || senderName; // Get first name only
    
    // Get additional user info if available
    const userProfile = {
      fullName: senderName,
      firstName: firstName,
      lastName: senderName.split(' ').slice(1).join(' ') || '',
      gender: userData?.gender || 'unknown',
      isFriend: userData?.isFriend || false
    };

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

    // Check image
    if (attachments && attachments.length > 0) {
      const photo = attachments.find(a => a.type === "photo");
      if (photo) {
        const imageUrl = photo.url;
        prompt = `Describe this photo in detail like a human. The user's name is ${firstName}:\n${imageUrl}`;
      }
    }

    if (!prompt) {
      return api.sendMessage(
        `📌 Hello ${firstName}! Please ask me a question.\n\nExample: ai what is your name?`,
        threadID,
        messageID
      );
    }

    // Send typing indicator
    api.sendTypingIndicator(threadID, true);
    
    const searching = await api.sendMessage(
      `🔊 AI is thinking and preparing voice response for ${firstName}...`, 
      threadID, 
      messageID
    );

    // Enhance prompt with user's name for personalized response
    const enhancedPrompt = `The user's name is ${firstName} (full name: ${senderName}). Please address them by their name in your response naturally. Keep your response concise and friendly. Question: ${prompt}`;

    // Get AI response
    const aiUrl = `https://vern-rest-api.vercel.app/api/chatgpt4?prompt=${encodeURIComponent(enhancedPrompt)}`;
    const aiResponse = await axios.get(aiUrl);

    if (!aiResponse.data) {
      return api.editMessage("❌ No response from AI server.", searching.messageID);
    }

    // Detect response format automatically
    const replyText =
      aiResponse.data.result ||
      aiResponse.data.response ||
      aiResponse.data.message ||
      aiResponse.data.answer;

    if (!replyText) {
      console.log("API RAW RESPONSE:", aiResponse.data);
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

    // Convert text to speech with proper pacing for name pronunciation
    // Limit to 200 chars for TTS
    const ttsText = replyText.substring(0, 200);
    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=en&client=tw-ob&q=${encodeURIComponent(ttsText)}`;
    
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
      `✅ Voice response ready for ${firstName}! (${fileSizeInKB} KB)`, 
      searching.messageID
    );

    // Send only audio (no text)
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

    // Optional: Also send a text preview for users who prefer reading
    // Uncomment below if you want both text and audio
    /*
    api.sendMessage(
      `📝 Response for ${firstName}:\n\n${replyText}`,
      threadID,
      messageID
    );
    */

  } catch (err) {
    console.error("AI TTS Error:", err);
    return api.sendMessage(
      `❌ Failed to generate voice response.\n${err.message}`,
      threadID,
      messageID
    );
  }
};
