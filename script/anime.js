const axios = require("axios");
const fs = require("fs");
const path = require("path");

module.exports.config = {
  name: "anime",
  version: "1.0.0",
  role: 0,
  credits: "selov",
  description: "Get random anime images",
  usages: "anime <category>",
  cooldown: 2,
  hasPrefix: true,
};

// Available categories for waifu.pics API (SFW only)
const categories = {
  'waifu': 'waifu',
  'neko': 'neko',
  'shinobu': 'shinobu',
  'megumin': 'megumin',
  'bully': 'bully',
  'cuddle': 'cuddle',
  'cry': 'cry',
  'hug': 'hug',
  'awoo': 'awoo',
  'kiss': 'kiss',
  'lick': 'lick',
  'pat': 'pat',
  'smug': 'smug',
  'bonk': 'bonk',
  'yeet': 'yeet',
  'blush': 'blush',
  'smile': 'smile',
  'wave': 'wave',
  'highfive': 'highfive',
  'handhold': 'handhold',
  'nom': 'nom',
  'bite': 'bite',
  'glomp': 'glomp',
  'slap': 'slap',
  'kill': 'kill',
  'kick': 'kick',
  'happy': 'happy',
  'wink': 'wink',
  'poke': 'poke',
  'dance': 'dance',
  'cringe': 'cringe'
};

module.exports.run = async ({ api, event, args }) => {
  const { threadID, messageID, senderID } = event;
  
  // Set reaction
  api.setMessageReaction("⏳", messageID, (err) => {}, true);
  
  try {
    // Get category from args (default to waifu)
    let category = args[0] ? args[0].toLowerCase() : 'waifu';
    
    // Check if category exists
    if (!categories[category]) {
      const availableCats = Object.keys(categories).join(', ');
      return api.sendMessage(
        `❌ Invalid category.\n\nAvailable categories:\n${availableCats}`,
        threadID,
        messageID
      );
    }

    // Send typing indicator
    api.sendTypingIndicator(threadID, true);

    // CORRECTED API URL - using waifu.pics SFW endpoint
    const apiUrl = `https://api.waifu.pics/sfw/${categories[category]}`;
    
    console.log("Fetching from:", apiUrl); // Debug log
    
    const response = await axios.get(apiUrl);
    
    console.log("API Response:", response.data); // Debug log
    
    // Check if response contains URL
    if (!response.data || !response.data.url) {
      return api.sendMessage("❌ No image found from API.", threadID, messageID);
    }

    const imageUrl = response.data.url;

    // Create cache directory
    const cacheDir = path.join(__dirname, "cache");
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    // Download image
    const imagePath = path.join(cacheDir, `anime_${Date.now()}.jpg`);
    const imageRes = await axios.get(imageUrl, { 
      responseType: "arraybuffer",
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    fs.writeFileSync(imagePath, imageRes.data);

    // Get file size
    const stats = fs.statSync(imagePath);
    const fileSizeKB = (stats.size / 1024).toFixed(2);

    // Get user info
    const user = await api.getUserInfo(senderID);
    const senderName = user[senderID]?.name || "User";

    // Prepare message
    const message = `🎨 ANIME ${category.toUpperCase()}\n━━━━━━━━━━━━━━━━\n` +
                    `🏷️ Category: ${category}\n` +
                    `📦 Size: ${fileSizeKB} KB\n` +
                    `━━━━━━━━━━━━━━━━\n` +
                    `💬 Requested by: ${senderName}`;

    // Send image
    api.setMessageReaction("✅", messageID, (err) => {}, true);
    
    api.sendMessage(
      {
        body: message,
        attachment: fs.createReadStream(imagePath)
      },
      threadID,
      (err) => {
        if (err) console.error("Error sending image:", err);
        // Clean up
        try {
          if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
        } catch (e) {}
      },
      messageID
    );

  } catch (err) {
    console.error("Anime Command Error:", err);
    
    // More specific error message
    let errorMessage = err.message;
    if (err.response) {
      errorMessage = `API returned status ${err.response.status}`;
      console.log("Error response data:", err.response.data);
    }
    
    api.setMessageReaction("❌", messageID, (err) => {}, true);
    api.sendMessage(`❌ Error: ${errorMessage}`, threadID, messageID);
  }
};
