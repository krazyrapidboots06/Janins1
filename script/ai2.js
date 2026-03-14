const axios = require("axios");
const fs = require("fs");
const path = require("path");

module.exports.config = {
  name: "ai2",
  version: "1.0.0",
  hasPermssion: 0,
  credits: "selov",
  description: "AI with ElevenLabs voice response",
  commandCategory: "search",
  usages: "ai2 <ask a questions>",
  cooldowns: 3
};

// Simple memory per thread with user profiles
const memory = {};

// ElevenLabs API configuration
const ELEVENLABS_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0IjoiZ3VpIiwidiI6IjAuMC4wIiwidSI6IkhoVnFVQ1FMUUIrVTN2UmtjRjBCVGc9PSIsInV1IjoibnZmTVB1aGZRbEc5ZitTaUl5cU1VUT09IiwiaWF0IjoxNzczNDcxOTgxfQ.aDo31XL_rV4ZCLcb9iaAsgoAYnpAlwQbPtaaU4c8hQM"; // You need to sign up at elevenlabs.io
const VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // Default voice (Rachel)

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, attachments, senderID } = event;

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
        `📌 Hello ${firstName}! Please ask me a question.\n\nExample: ai2 what is your name?`,
        threadID,
        messageID
      );
    }

    // Send typing indicator
    api.sendTypingIndicator(threadID, true);

    // Enhance prompt with user's name
    const enhancedPrompt = `The user's name is ${firstName} (full name: ${senderName}). Please address them by their name in your response naturally. Keep your response concise and friendly. Question: ${prompt}`;

    // Get AI response from ChatGPT
    const aiUrl = `https://deku-rest-api-spring.onrender.com/chatgpt?prompt=${encodeURIComponent(enhancedPrompt)}`;
    const aiResponse = await axios.get(aiUrl);

    let replyText = "I'm sorry, I couldn't process that request.";

    // Handle different response formats
    if (aiResponse.data) {
      if (aiResponse.data.response) replyText = aiResponse.data.response;
      else if (aiResponse.data.message) replyText = aiResponse.data.message;
      else if (aiResponse.data.result) replyText = aiResponse.data.result;
      else if (aiResponse.data.answer) replyText = aiResponse.data.answer;
      else if (typeof aiResponse.data === 'string') replyText = aiResponse.data;
    }

    // Store conversation
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

    // Convert text to speech using ElevenLabs (professional voice)
    const ttsText = replyText.substring(0, 500); // ElevenLabs has higher limit
    
    // ElevenLabs API endpoint
    const ttsUrl = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`;
    
    const ttsPayload = {
      text: ttsText,
      model_id: "eleven_multilingual_v2",
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.5,
        style: 0.5,
        use_speaker_boost: true
      }
    };

    const audioPath = path.join(cacheDir, `ai2_${Date.now()}.mp3`);
    
    const audioResponse = await axios.post(ttsUrl, ttsPayload, {
      responseType: "arraybuffer",
      timeout: 45000,
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_API_KEY,
        'Accept': 'audio/mpeg'
      }
    });

    fs.writeFileSync(audioPath, audioResponse.data);

    // Get file size
    const stats = fs.statSync(audioPath);
    const fileSizeInKB = (stats.size / 1024).toFixed(2);

    // Send ONLY audio
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
    console.error("AI2 TTS Error:", err);
    // Silent fail
  }
};
