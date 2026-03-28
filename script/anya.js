const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

module.exports.config = {
  name: "anya",
  version: "6.0.0",
  role: 0,
  credits: "S1FU",
  description: "AI-powered Anya Forger voice TTS (English voice)",
  commandCategory: "ai",
  usages: "/anya <question>",
  cooldowns: 5,
  aliases: ["anyatts", "anyaai"]
};

// Simple memory per thread
const memory = {};

// Anya character persona for AI (English)
const ANYA_PERSONA = `You are Anya Forger from Spy x Family. You are a cute, innocent, and telepathic 6-year-old girl. 
You love peanuts, Spy Wars, and helping your family. You often say "Waku waku!" when excited.
Keep your responses short, cute, and childlike. Use simple words and be playful.
Address the user by their name if known.
Respond in ENGLISH only.`;

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, senderID } = event;
  
  let prompt = args.join(" ").trim();
  
  if (!prompt) {
    return api.sendMessage(
      `╭── Ი𐑼 𖹭 𝖺𝗇𝗒𝖺 𝗍𝗍𝗌 𖹭 Ი𐑼 ──╮\n\n` +
      `  ᯓ★ 𝗉𝗅𝖾𝖺𝗌𝖾 𝗉𝗋𝗈𝗏𝗂𝖽𝖾 𝗍𝖾𝗑𝗍 .ᐟ\n` +
      `  ⋆ 𝖾𝗑𝖺𝗆𝗉𝗅𝖾: /anya waku waku\n` +
      `  ⋆ 𝖺𝗌𝗄 𝖺𝗇𝗒𝖺: /anya what is your favorite food?\n\n` +
      `╰── ᯓ★˙𐃷˙݁ ˖Ი𐑼⋆𖹭.ᐟ ──╯`,
      threadID,
      messageID
    );
  }
  
  try {
    // Get user name
    const user = await api.getUserInfo(senderID);
    const senderName = user[senderID]?.name || "User";
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
    
    // Set reaction
    api.setMessageReaction("🥵", messageID, () => {}, true);
    
    // Get AI response using the API
    const enhancedPrompt = `${ANYA_PERSONA}\n\nThe user's name is ${firstName}. Please address them by their name in your response. Keep it short and cute. Respond in ENGLISH only. Question: ${prompt}`;
    
    const aiUrl = `https://restapi-ratx.onrender.com/api/jay?prompt=${encodeURIComponent(enhancedPrompt)}&uid=${senderID}`;
    const aiResponse = await axios.get(aiUrl, { timeout: 20000 });
    
    let replyText = "Waku waku! I'm Anya! I love peanuts!";
    
    if (aiResponse.data) {
      if (aiResponse.data.response) replyText = aiResponse.data.response;
      else if (aiResponse.data.message) replyText = aiResponse.data.message;
      else if (aiResponse.data.result) replyText = aiResponse.data.result;
      else if (aiResponse.data.answer) replyText = aiResponse.data.answer;
      else if (typeof aiResponse.data === 'string') replyText = aiResponse.data;
    }
    
    // Add Anya-style flair if missing
    if (!replyText.includes("Waku") && !replyText.includes("waku")) {
      if (Math.random() > 0.5) {
        replyText = "Waku waku! " + replyText;
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
    const cacheDir = path.join(__dirname, "cache", "anya");
    await fs.ensureDir(cacheDir);
    
    // Convert text to speech using your original API (VoiceVox) with ENGLISH voice
    // Speaker 1 = English speaker (VoiceVox has English support)
    const ttsText = encodeURIComponent(replyText);
    const ttsUrl = `https://api.tts.quest/v3/voicevox/synthesis?text=${ttsText}&speaker=1`;
    
    const filePath = path.join(cacheDir, `anya_${senderID}_${Date.now()}.mp3`);
    
    const ttsResponse = await axios.get(ttsUrl, { timeout: 20000 });
    
    if (!ttsResponse.data.success) {
      throw new Error("TTS API failed");
    }
    
    const audioUrl = ttsResponse.data.mp3StreamingUrl;
    
    const audioResponse = await axios.get(audioUrl, {
      responseType: "arraybuffer",
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    fs.writeFileSync(filePath, Buffer.from(audioResponse.data));
    
    // Check file size
    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      throw new Error("Downloaded file is empty");
    }
    
    // Send audio with info
    const successMsg = 
      `╭── Ი𐑼 𖹭 𝖺𝗇𝗒𝖺 𝗏𝗈𝗂𝖼𝖾 𖹭 Ი𐑼 ──╮\n\n` +
      `  ᯓ★ 𝗆𝖾𝗌𝗌𝖺𝗀𝖾: "${replyText.substring(0, 50)}${replyText.length > 50 ? '...' : ''}"\n` +
      `  ⋆ 𝗌𝖾𝗋𝗏𝖾𝖽 𝖻𝗒 𝗌𝟣𝖿𝗎 Ი𐑼\n\n` +
      `╰── ᯓ★˙𐃷˙݁ ˖Ი𐑼⋆𖹭.ᐟ ──╯`;
    
    api.sendMessage({
      body: successMsg,
      attachment: fs.createReadStream(filePath)
    }, threadID, () => {
      setTimeout(() => {
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch (e) {}
      }, 5000);
      api.setMessageReaction("🎀", messageID, () => {}, true);
    }, messageID);
    
  } catch (err) {
    console.error("Anya TTS Error:", err);
    api.setMessageReaction("❌", messageID, () => {}, true);
    
    return api.sendMessage(
      `╭── Ი𐑼 𖹭 𝖾𝗋𝗋𝗈𝗋 𖹭 Ი𐑼 ──╮\n\n` +
      `  ᯓ★ 𝗌𝗒𝗌𝗍𝖾𝗆 𝖿𝖺𝗂𝗅𝗎𝗋𝖾 .ᐟ\n\n` +
      `╰── ᯓ★˙𐃷˙݁ ˖Ი𐑼⋆𖹭.ᐟ ──╯`,
      threadID,
      messageID
    );
  }
};
