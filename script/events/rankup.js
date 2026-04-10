const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

module.exports.config = {
  name: "rankup",
  version: "4.0.0",
  role: 0,
  credits: "VincentSensei",
  description: "Rankup notification with GIF only",
  commandCategory: "system",
  usages: "/rankup [on|off]",
  cooldowns: 5,
  aliases: ["rankupv2", "levelup"]
};

// Store rankup settings per thread
if (!global.rankupSettings) global.rankupSettings = {};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID } = event;
  const command = args[0]?.toLowerCase();

  // Initialize thread settings
  if (!global.rankupSettings[threadID]) {
    global.rankupSettings[threadID] = {
      enabled: false
    };
  }

  // Show status
  if (!command) {
    const status = global.rankupSettings[threadID].enabled ? "✅ ON" : "❌ OFF";
    return api.sendMessage(
      `📊 RANKUP STATUS\n━━━━━━━━━━━━━━━━\nStatus: ${status}\n\n` +
      `📝 Usage:\n/rankup on - Enable rankup GIF\n` +
      `/rankup off - Disable rankup GIF`,
      threadID,
      messageID
    );
  }

  // Turn ON
  if (command === "on") {
    global.rankupSettings[threadID].enabled = true;
    return api.sendMessage(
      `✅ Rankup GIF ENABLED\n━━━━━━━━━━━━━━━━\n` +
      `Members will receive rankup GIF when they level up!`,
      threadID,
      messageID
    );
  }

  // Turn OFF
  if (command === "off") {
    global.rankupSettings[threadID].enabled = false;
    return api.sendMessage(
      `❌ Rankup GIF DISABLED\n━━━━━━━━━━━━━━━━\n` +
      `Members will no longer receive rankup GIF.`,
      threadID,
      messageID
    );
  }

  return api.sendMessage(`❌ Invalid command. Use /rankup on or /rankup off`, threadID, messageID);
};

// Handle rankup events
module.exports.handleEvent = async function ({ api, event }) {
  const { threadID, senderID, isGroup, body } = event;
  
  // Only work in groups
  if (!isGroup) return;
  
  // Check if rankup is enabled for this thread
  if (!global.rankupSettings[threadID]?.enabled) return;
  
  // Test trigger: /testrankup [level]
  if (body && body.toLowerCase().startsWith("/testrankup")) {
    const args = body.split(" ");
    const level = args[1] || 5;
    
    // Get user info
    let userName = "Member";
    try {
      const userInfo = await api.getUserInfo(senderID);
      userName = userInfo[senderID]?.name || "Member";
    } catch (e) {}
    
    // Try to get rankup GIF from API
    try {
      const cacheDir = path.join(__dirname, 'cache', 'rankup');
      await fs.ensureDir(cacheDir);
      const imagePath = path.join(cacheDir, `rankup_${senderID}_${Date.now()}.gif`);
      
      const response = await axios({
        method: "get",
        url: `https://rankup-api-b1rv.vercel.app/api/rankup?uid=${senderID}&name=${encodeURIComponent(userName)}&level=${level}`,
        responseType: "stream",
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0'
        }
      });
      
      const writer = fs.createWriteStream(imagePath);
      response.data.pipe(writer);
      
      await new Promise((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", reject);
      });
      
      // Send ONLY the GIF (no text message)
      await api.sendMessage({
        attachment: fs.createReadStream(imagePath)
      }, threadID);
      
      // Clean up
      setTimeout(() => {
        try { fs.unlinkSync(imagePath); } catch (e) {}
      }, 10000);
      
    } catch (gifErr) {
      console.error("[RANKUP] GIF error:", gifErr.message);
      // Silent fail - no message if GIF fails
    }
  }
};
