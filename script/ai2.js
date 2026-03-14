const axios = require("axios");
const fs = require("fs");
const path = require("path");

module.exports.config = {
  name: "ai2",
  version: "1.3.0",
  hasPermssion: 0,
  credits: "Yasis",
  description: "AI with Puter.com voice response (audio only)",
  commandCategory: "search",
  usages: "/ai2 <ask a questions>",
  cooldowns: 3
};

// Simple memory per thread with user profiles
const memory = {};

// Puter.com authentication token
const PUTER_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0IjoiZ3VpIiwidiI6IjAuMC4wIiwidSI6IkhoVnFVQ1FMUUIrVTN2UmtjRjBCVGc9PSIsInV1IjoibnZmTVB1aGZRbEc5ZitTaUl5cU1VUT09IiwiaWF";

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, senderID } = event;

  let prompt = args.join(" ").trim();

  try {
    // Get user info
    const user = await api.getUserInfo(senderID);
    const userData = user[senderID];
    const firstName = userData?.name?.split(' ')[0] || "User";

    if (!prompt) {
      return api.sendMessage(
        `📌 Hello ${firstName}! Please ask me a question.\n\nExample: /ai2 what is your name?`,
        threadID,
        messageID
      );
    }

    // Send typing indicator only
    api.sendTypingIndicator(threadID, true);

    // Get AI response from ChatGPT
    const aiUrl = `https://deku-rest-api-spring.onrender.com/chatgpt?prompt=${encodeURIComponent(prompt)}`;
    
    const aiResponse = await axios.get(aiUrl, { timeout: 15000 });
    
    let replyText = "I'm sorry, I couldn't process that request.";

    if (aiResponse.data) {
      if (aiResponse.data.response) replyText = aiResponse.data.response;
      else if (aiResponse.data.message) replyText = aiResponse.data.message;
      else if (aiResponse.data.result) replyText = aiResponse.data.result;
      else if (aiResponse.data.answer) replyText = aiResponse.data.answer;
      else if (typeof aiResponse.data === 'string') replyText = aiResponse.data;
    }

    // Create cache directory
    const cacheDir = path.join(__dirname, "cache");
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    // Convert text to speech using Puter.com
    const ttsText = replyText.substring(0, 500);
    
    const ttsUrl = `https://api.puter.com/v2/ai/txt2speech`;
    
    const ttsPayload = {
      text: ttsText,
      provider: "elevenlabs",
      model: "eleven_multilingual_v2",
      voice: "21m00Tcm4TlvDq8ikWAM", // Rachel voice (female)
      output_format: "mp3_44100_128"
    };

    const audioPath = path.join(cacheDir, `ai2_${Date.now()}.mp3`);
    
    const audioResponse = await axios.post(ttsUrl, ttsPayload, {
      responseType: "arraybuffer",
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PUTER_TOKEN}`,
        'Origin': 'https://puter.com',
        'Referer': 'https://puter.com/'
      }
    });

    fs.writeFileSync(audioPath, audioResponse.data);

    // Send ONLY audio - no text at all
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
    console.error("AI2 Command Error:", err);
    // Silent fail - no error message shown to user
  }
};
