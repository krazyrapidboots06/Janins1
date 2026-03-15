const axios = require("axios");
const fs = require("fs");
const path = require("path");

module.exports.config = {
  name: "red",
  version: "4.0.0",
  hasPermssion: 0,
  credits: "Yasis",
  description: "Get random videos from pinayot API",
  commandCategory: "video",
  usages: "red",
  cooldowns: 5
};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID } = event;

  try {
    const waiting = await api.sendMessage("🎬 Fetching random video...", threadID, messageID);

    // Fetch videos from the new API
    const response = await axios.get("https://betadash-api-swordslush-production.up.railway.app/pinayot?page=1", {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    // The API returns data in result array
    const videos = response.data.result || [];
    
    if (videos.length === 0) {
      api.unsendMessage(waiting.messageID);
      return api.sendMessage("❌ No videos found.", threadID, messageID);
    }

    // Get random video
    const randomIndex = Math.floor(Math.random() * videos.length);
    const videoInfo = videos[randomIndex];

    // Extract video information
    const videoUrl = videoInfo.videoUrl;
    const description = videoInfo.description || "No description";
    const uploadDate = videoInfo.uploadDate ? new Date(videoInfo.uploadDate).toLocaleDateString() : "Unknown";
    const thumbnailUrl = videoInfo.thumbnailUrl;

    if (!videoUrl) {
      api.unsendMessage(waiting.messageID);
      return api.sendMessage("❌ Video URL not found.", threadID, messageID);
    }

    // Update waiting message
    api.editMessage(`📥 Downloading video...`, waiting.messageID);

    // Create cache directory
    const cacheDir = path.join(__dirname, "cache", "red");
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    // Download video
    const videoPath = path.join(cacheDir, `red_${Date.now()}.mp4`);
    
    try {
      const videoResponse = await axios.get(videoUrl, {
        responseType: "arraybuffer",
        timeout: 60000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://pinayot.com/'
        }
      });

      fs.writeFileSync(videoPath, videoResponse.data);
      
      // Check if file was downloaded properly
      if (fs.statSync(videoPath).size === 0) {
        throw new Error("Downloaded file is empty");
      }

      const fileSizeMB = (fs.statSync(videoPath).size / (1024 * 1024)).toFixed(2);

      // Delete waiting message
      api.unsendMessage(waiting.messageID);

      // Send video with info
      api.sendMessage(
        {
          body: `🎬 **RANDOM VIDEO**\n━━━━━━━━━━━━━━━━\n` +
                `**Description:** ${description}\n` +
                `**Upload Date:** ${uploadDate}\n` +
                `**Size:** ${fileSizeMB} MB\n` +
                `━━━━━━━━━━━━━━━━`,
          attachment: fs.createReadStream(videoPath)
        },
        threadID,
        (err) => {
          if (err) console.error("Send error:", err);
          // Delete file after sending
          setTimeout(() => {
            try { fs.unlinkSync(videoPath); } catch (e) {}
          }, 60000);
        },
        messageID
      );

    } catch (downloadErr) {
      console.error("Download error:", downloadErr);
      api.unsendMessage(waiting.messageID);
      api.sendMessage(`❌ Download failed: ${downloadErr.message}`, threadID, messageID);
    }

  } catch (err) {
    console.error("Red Command Error:", err);
    api.sendMessage(`❌ Error: ${err.message}`, threadID, messageID);
  }
};
