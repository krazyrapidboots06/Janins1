const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

module.exports.config = {
  name: "aichip",
  version: "1.0.0",
  role: 0,
  credits: "selov",
  description: "AI assistant with memory, image recognition, web search, and image generation",
  commandCategory: "ai",
  usages: "/chipp <question> or reply to image",
  cooldowns: 5,
  aliases: ["chip", "chippai"]
};

// API Configuration
const API_BASE = "https://apiremake-production.up.railway.app/api/chipp";
const API_KEY = "d48ff6e54c518a8ff88fb11b6aa938508e5d4fb65479d8605527a95375ad7faa";

// Store conversation memory per user
if (!global.chippMemory) global.chippMemory = {};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, senderID, type, messageReply, attachments } = event;
  let prompt = args.join(" ").trim();
  let imageUrl = null;
  let isImageReply = false;

  // Check if replying to an image
  if (type === "message_reply" && messageReply?.attachments?.length > 0) {
    const photo = messageReply.attachments.find(a => a.type === "photo");
    if (photo) {
      imageUrl = photo.url;
      isImageReply = true;
      if (!prompt) {
        prompt = "Describe this image in detail.";
      }
    }
  }

  // If no prompt and no image, show help
  if (!prompt && !imageUrl) {
    return api.sendMessage(
      `🧠 CHIPP AI COMMANDS\n━━━━━━━━━━━━━━━━\n` +
      `• /chipp <question> - Ask anything\n` +
      `• Reply to an image with /chipp - Describe image\n` +
      `• /chipp search <query> - Search web\n` +
      `• /chipp generate <prompt> - Generate image\n` +
      `• /chipp clear - Clear conversation memory\n\n` +
      `Examples:\n` +
      `• /chipp Hello, how are you?\n` +
      `• /chipp search Selov Asx on Facebook\n` +
      `• /chipp generate a beautiful sunset\n` +
      `• Reply to a photo with /chipp`,
      threadID,
      messageID
    );
  }

  // Show typing indicator
  api.sendTypingIndicator(threadID, true);

  // Check for clear command
  if (prompt.toLowerCase() === "clear") {
    if (global.chippMemory[senderID]) {
      delete global.chippMemory[senderID];
      return api.sendMessage("✅ Conversation memory cleared!", threadID, messageID);
    }
    return api.sendMessage("📭 No memory to clear.", threadID, messageID);
  }

  // Check for generate image command
  if (prompt.toLowerCase().startsWith("generate ")) {
    const genPrompt = prompt.slice(9).trim();
    if (!genPrompt) {
      return api.sendMessage("🎨 Please provide an image description.\nExample: /chipp generate a cat wearing a hat", threadID, messageID);
    }
    return await generateImage(api, threadID, messageID, genPrompt);
  }

  // Check for search command
  if (prompt.toLowerCase().startsWith("search ")) {
    const searchQuery = prompt.slice(7).trim();
    return await searchWeb(api, threadID, messageID, searchQuery);
  }

  // Get or create user session
  let uid = global.chippMemory[senderID]?.uid || senderID;
  
  // Get conversation context
  const conversationContext = getConversationContext(senderID);
  
  // Prepare the API request
  let askPrompt = prompt;
  if (conversationContext) {
    askPrompt = `${conversationContext}\nUser: ${prompt}\nAssistant:`;
  }

  // Build API URL
  let apiUrl = `${API_BASE}?ask=${encodeURIComponent(askPrompt)}&uid=${uid}&roleplay=&img_url=${imageUrl ? encodeURIComponent(imageUrl) : ''}&api_key=${API_KEY}`;

  try {
    const response = await axios.get(apiUrl, { timeout: 60000 });
    
    if (!response.data) {
      throw new Error("No response from API");
    }
    
    let answer = response.data?.answer || "No response from Chipp.";
    const newUid = response.data?.uid || uid;
    
    // Store in memory
    if (!global.chippMemory[senderID]) {
      global.chippMemory[senderID] = {
        uid: newUid,
        history: []
      };
    }
    global.chippMemory[senderID].uid = newUid;
    global.chippMemory[senderID].history.push({
      prompt: prompt,
      response: answer,
      timestamp: Date.now(),
      hasImage: !!imageUrl
    });
    
    // Limit history to last 15
    if (global.chippMemory[senderID].history.length > 15) {
      global.chippMemory[senderID].history.shift();
    }
    
    // Send response
    let responseMsg = answer;
    if (isImageReply) {
      responseMsg = `🖼️ Image Analysis\n━━━━━━━━━━━━━━━━\n${answer}`;
    }
    
    return api.sendMessage(responseMsg, threadID, messageID);
    
  } catch (err) {
    console.error("Chipp Error:", err);
    
    let errorMsg = "❌ Chipp is currently unavailable. Please try again later.";
    
    if (err.code === 'ECONNABORTED') {
      errorMsg = "❌ Request timed out. The server may be waking up. Please try again in a moment.";
    }
    
    return api.sendMessage(errorMsg, threadID, messageID);
  }
};

// Helper: Get conversation context
function getConversationContext(senderID, maxHistory = 5) {
  const userMemory = global.chippMemory[senderID];
  if (!userMemory?.history || userMemory.history.length === 0) return "";
  
  const recentHistory = userMemory.history.slice(-maxHistory);
  let context = "Previous conversation:\n";
  
  for (const entry of recentHistory) {
    context += `User: ${entry.prompt}\n`;
    context += `Assistant: ${entry.response}\n`;
  }
  context += "\n";
  
  return context;
}

// Helper: Generate image
async function generateImage(api, threadID, messageID, prompt) {
  const waitingMsg = await api.sendMessage(`🎨 Generating image: "${prompt}"...`, threadID);
  
  try {
    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true`;
    
    const response = await axios.get(imageUrl, { responseType: "arraybuffer", timeout: 60000 });
    
    const cacheDir = path.join(__dirname, "cache", "chipp");
    await fs.ensureDir(cacheDir);
    
    const imgPath = path.join(cacheDir, `gen_${Date.now()}.jpg`);
    fs.writeFileSync(imgPath, Buffer.from(response.data));
    
    await api.unsendMessage(waitingMsg.messageID);
    
    api.sendMessage({
      body: `🎨 Generated Image\n━━━━━━━━━━━━━━━━\n📝 Prompt: ${prompt}`,
      attachment: fs.createReadStream(imgPath)
    }, threadID, () => {
      setTimeout(() => fs.unlinkSync(imgPath).catch(()=>{}), 10000);
    }, messageID);
    
  } catch (err) {
    console.error("Generate Error:", err);
    await api.unsendMessage(waitingMsg.messageID);
    api.sendMessage("❌ Failed to generate image. Please try again.", threadID, messageID);
  }
}

// Helper: Search web
async function searchWeb(api, threadID, messageID, query) {
  const waitingMsg = await api.sendMessage(`🔍 Searching: "${query}"...`, threadID);
  
  try {
    const searchUrl = `https://restapijay.onrender.com/api/webpilot?q=${encodeURIComponent(query)}`;
    const response = await axios.get(searchUrl, { timeout: 20000 });
    
    let answer = response.data?.answer || response.data?.result || "No results found.";
    
    await api.unsendMessage(waitingMsg.messageID);
    api.sendMessage(`🔍 Search Results\n━━━━━━━━━━━━━━━━\n📝 ${query}\n━━━━━━━━━━━━━━━━\n${answer}`, threadID, messageID);
    
  } catch (err) {
    console.error("Search Error:", err);
    await api.unsendMessage(waitingMsg.messageID);
    api.sendMessage("❌ Search failed. Please try again.", threadID, messageID);
  }
}
