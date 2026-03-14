const axios = require("axios");
const fs = require("fs");
const path = require("path");

module.exports.config = {
  name: "test",
  version: "1.0.0",
  hasPermssion: 0,
  credits: "selov",
  description: "Send a random video from JSON database",
  commandCategory: "test",
  usages: "/test",
  cooldowns: 2
};

// Path to JSON file
const jsonPath = path.join(__dirname, "videos.json");

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, senderID } = event;

  try {
    // Get user name
    const user = await api.getUserInfo(senderID);
    const senderName = user[senderID]?.name || "User";

    // Check if JSON file exists
    if (!fs.existsSync(jsonPath)) {
      return api.sendMessage(
        "❌ videos.json file not found in cache folder.",
        threadID,
        messageID
      );
    }

    // Read and parse JSON file
    const jsonData = fs.readFileSync(jsonPath, 'utf8');
    const videos = JSON.parse(jsonData);

    if (!videos || videos.length === 0) {
      return api.sendMessage("❌ No videos found in database.", threadID, messageID);
    }

    // Get random video
    const randomIndex = Math.floor(Math.random() * videos.length);
    const selectedVideo = videos[randomIndex];

    // Send typing indicator
    api.sendTypingIndicator(threadID, true);

    const waiting = await api.sendMessage("🎬 Fetching random video...", threadID, messageID);

    // Download the video
    const cacheDir = path.join(__dirname, "cache", "temp");
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    const videoPath = path.join(cacheDir, `test_${Date.now()}.mp4`);
    
    const videoRes = await axios.get(selectedVideo.url, { 
      responseType: "arraybuffer",
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    });

    fs.writeFileSync(videoPath, videoRes.data);

    // Get file size
    const stats = fs.statSync(videoPath);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

    // Delete waiting message
    api.unsendMessage(waiting.messageID);

    // Send the video
    api.sendMessage(
      {
        body: `🎬 **TEST VIDEO**\n━━━━━━━━━━━━━━━━\n` +
              `**Title:** ${selectedVideo.title || 'Untitled'}\n` +
              `**Duration:** ${selectedVideo.duration || 'Unknown'}\n` +
              `**Source:** ${selectedVideo.source || 'Unknown'}\n` +
              `**Size:** ${fileSizeMB} MB\n` +
              `**Video #:** ${randomIndex + 1}/${videos.length}\n` +
              `━━━━━━━━━━━━━━━━\n` +
              `💬 Requested by: ${senderName}`,
        attachment: fs.createReadStream(videoPath)
      },
      threadID,
      (err) => {
        if (err) console.error("Error sending video:", err);
        // Clean up
        try {
          if (fs.existsSync(videoPath)) {
            fs.unlinkSync(videoPath);
          }
        } catch (e) {}
      },
      messageID
    );

  } catch (err) {
    console.error("Test Command Error:", err);
    api.sendMessage(`❌ Error: ${err.message}`, threadID, messageID);
  }
};
