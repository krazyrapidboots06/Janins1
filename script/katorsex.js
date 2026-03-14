const axios = require("axios");
const fs = require("fs");
const path = require("path");

module.exports.config = {
  name: "katorsex",
  version: "4.1.0",
  hasPermssion: 0,
  credits: "Yasis",
  description: "Get random video",
  commandCategory: "video",
  usages: "/katorsex",
  cooldowns: 5
};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, senderID } = event;

  try {
    const user = await api.getUserInfo(senderID);
    const senderName = user[senderID]?.name || "User";

    const waiting = await api.sendMessage("🔍 Fetching random video...", threadID, messageID);

    // Fetch videos from API
    const apiUrl = "https://betadash-api-swordslush-production.up.railway.app/katorsex?page=1";
    
    const response = await axios.get(apiUrl, { 
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    // Get videos array from response
    let videos = response.data.results || [];
    
    if (videos.length === 0) {
      return api.editMessage("❌ No videos available.", waiting.messageID);
    }

    // Select random video
    const randomVideo = videos[Math.floor(Math.random() * videos.length)];
    
    // Find video URL (try different fields)
    const videoUrl = randomVideo.videoUrl || randomVideo.downloadUrl || 
                     randomVideo.url || randomVideo.link || randomVideo.video;

    if (!videoUrl) {
      return api.editMessage("❌ Video URL not found.", waiting.messageID);
    }

    api.editMessage("📥 Downloading video...", waiting.messageID);

    // Create cache directory
    const cacheDir = path.join(__dirname, "cache", "videos");
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    // Download video
    const videoPath = path.join(cacheDir, `video_${Date.now()}.mp4`);
    
    const videoResponse = await axios.get(videoUrl, {
      responseType: "arraybuffer",
      timeout: 60000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    fs.writeFileSync(videoPath, videoResponse.data);
    
    const fileSizeMB = (fs.statSync(videoPath).size / (1024 * 1024)).toFixed(2);

    // Send video
    api.unsendMessage(waiting.messageID);
    
    api.sendMessage(
      {
        body: `🎬 **RANDOM VIDEO**\n━━━━━━━━━━━━━━━━\n` +
              `📹 ${randomVideo.title || 'Untitled'}\n` +
              `📦 ${fileSizeMB} MB\n` +
              `━━━━━━━━━━━━━━━━\n` +
              `👤 ${senderName}`,
        attachment: fs.createReadStream(videoPath)
      },
      threadID,
      () => {
        setTimeout(() => {
          try { fs.unlinkSync(videoPath); } catch (e) {}
        }, 60000);
      },
      messageID
    );

  } catch (err) {
    console.error("Error:", err);
    api.sendMessage(`❌ ${err.message}`, threadID, messageID);
  }
};
