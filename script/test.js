const axios = require("axios");
const fs = require("fs");
const path = require("path");

module.exports.config = {
  name: "test",
  version: "2.0.0",
  hasPermssion: 0,
  credits: "Yasis",
  description: "Video database manager",
  commandCategory: "test",
  usages: "/test (random) or /test list or /test add <url> | <title>",
  cooldowns: 2
};

// Path to JSON file
const jsonPath = path.join(__dirname, "cache", "videos.json");

// Initialize JSON file if it doesn't exist
function initJSON() {
  if (!fs.existsSync(jsonPath)) {
    const defaultVideos = [
      {
        url: "https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4",
        title: "Sample Video",
        duration: "0:30",
        source: "Sample"
      }
    ];
    fs.writeFileSync(jsonPath, JSON.stringify(defaultVideos, null, 2));
  }
}

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, senderID } = event;
  const command = args[0]?.toLowerCase();

  try {
    // Initialize JSON file
    initJSON();

    const user = await api.getUserInfo(senderID);
    const senderName = user[senderID]?.name || "User";

    // Read videos from JSON
    const jsonData = fs.readFileSync(jsonPath, 'utf8');
    const videos = JSON.parse(jsonData);

    // Handle different subcommands
    if (command === "list") {
      let list = "📋 **VIDEO DATABASE**\n━━━━━━━━━━━━━━━━\n";
      videos.forEach((video, index) => {
        list += `${index + 1}. ${video.title}\n   📎 ${video.url}\n   ⏱️ ${video.duration}\n\n`;
      });
      list += `━━━━━━━━━━━━━━━━\n**Total:** ${videos.length} videos`;
      return api.sendMessage(list, threadID, messageID);
    }

    if (command === "add") {
      const input = args.slice(1).join(" ").split("|").map(s => s.trim());
      if (input.length < 2) {
        return api.sendMessage(
          "❌ Usage: /test add <url> | <title>\nExample: /test add https://example.com/vid.mp4 | Funny Cat",
          threadID,
          messageID
        );
      }

      const newVideo = {
        url: input[0],
        title: input[1] || "Untitled",
        duration: input[2] || "Unknown",
        source: input[3] || "User Added",
        addedBy: senderName,
        addedAt: new Date().toLocaleString()
      };

      videos.push(newVideo);
      fs.writeFileSync(jsonPath, JSON.stringify(videos, null, 2));

      return api.sendMessage(
        `✅ Video added successfully!\n**Title:** ${newVideo.title}\n**Total videos:** ${videos.length}`,
        threadID,
        messageID
      );
    }

    if (command === "remove" || command === "delete") {
      const index = parseInt(args[1]) - 1;
      if (isNaN(index) || index < 0 || index >= videos.length) {
        return api.sendMessage("❌ Invalid video number.", threadID, messageID);
      }

      const removed = videos.splice(index, 1);
      fs.writeFileSync(jsonPath, JSON.stringify(videos, null, 2));

      return api.sendMessage(
        `✅ Removed: ${removed[0].title}\n**Remaining:** ${videos.length} videos`,
        threadID,
        messageID
      );
    }

    // Default: send random video
    const randomIndex = Math.floor(Math.random() * videos.length);
    const selectedVideo = videos[randomIndex];

    api.sendTypingIndicator(threadID, true);
    const waiting = await api.sendMessage("🎬 Fetching random video...", threadID, messageID);

    // Download video
    const cacheDir = path.join(__dirname, "cache", "temp");
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    const videoPath = path.join(cacheDir, `test_${Date.now()}.mp4`);
    
    const videoRes = await axios.get(selectedVideo.url, { 
      responseType: "arraybuffer",
      timeout: 30000
    });

    fs.writeFileSync(videoPath, videoRes.data);
    const stats = fs.statSync(videoPath);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

    api.unsendMessage(waiting.messageID);

    api.sendMessage(
      {
        body: `🎬 **RANDOM VIDEO**\n━━━━━━━━━━━━━━━━\n` +
              `**Title:** ${selectedVideo.title}\n` +
              `**Duration:** ${selectedVideo.duration}\n` +
              `**Source:** ${selectedVideo.source || 'Database'}\n` +
              `**Size:** ${fileSizeMB} MB\n` +
              `**Video #:** ${randomIndex + 1}/${videos.length}\n` +
              `━━━━━━━━━━━━━━━━\n` +
              `💬 Requested by: ${senderName}`,
        attachment: fs.createReadStream(videoPath)
      },
      threadID,
      (err) => {
        if (err) console.error("Error sending video:", err);
        try { fs.unlinkSync(videoPath); } catch (e) {}
      },
      messageID
    );

  } catch (err) {
    console.error("Test Command Error:", err);
    api.sendMessage(`❌ Error: ${err.message}`, threadID, messageID);
  }
};
