const axios = require("axios");
const fs = require("fs");
const path = require("path");

module.exports.config = {
  name: "pinay",
  version: "3.0.0",
  hasPermssion: 0,
  credits: "Yasis",
  description: "Get random Pinay videos",
  commandCategory: "video",
  usages: "/pinay",
  cooldowns: 5
};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, senderID } = event;

  try {
    const user = await api.getUserInfo(senderID);
    const senderName = user[senderID]?.name || "User";

    // Fetch videos from API
    const apiUrl = "https://betadash-api-swordslush-production.up.railway.app/lootedpinay?page=1";
    
    const response = await axios.get(apiUrl, { timeout: 10000 });

    const videos = response.data.result || [];
    
    if (videos.length === 0) {
      return api.sendMessage("❌ No videos available.", threadID, messageID);
    }

    // Get random video
    const randomVideo = videos[Math.floor(Math.random() * videos.length)];
    const videoUrl = randomVideo.videoUrl;

    if (!videoUrl) {
      return api.sendMessage("❌ Video not found.", threadID, messageID);
    }

    // Create cache directory
    const cacheDir = path.join(__dirname, "cache");
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    // Download video
    const videoPath = path.join(cacheDir, `pinay_${Date.now()}.mp4`);
    
    const videoResponse = await axios.get(videoUrl, {
      responseType: "arraybuffer",
      timeout: 60000,
      headers: { 'Referer': 'https://pinayflix.top/' }
    });

    fs.writeFileSync(videoPath, videoResponse.data);

    // Send video only - no extra messages
    api.sendMessage(
      {
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
    // Silent fail - no error message shown
    console.error(err); // Only you see this in console
  }
};
