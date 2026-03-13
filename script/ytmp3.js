const axios = require("axios");
const fs = require("fs");
const path = require("path");

module.exports.config = {
  name: "ytmp3",
  version: "1.0.0",
  hasPermssion: 0,
  credits: "Yasis",
  description: "Download YouTube audio as MP3",
  commandCategory: "music",
  usages: "ytmp3 <song name>",
  cooldowns: 3
};

// Simple memory per thread
const memory = {};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, senderID } = event;
  const query = args.join(" ").trim();

  try {
    // Get sender name
    const user = await api.getUserInfo(senderID);
    const senderName = user[senderID]?.name || "User";

    // Initialize memory
    if (!memory[threadID]) memory[threadID] = [];
    memory[threadID].push(`${senderName} requested: ${query}`);

    if (!query) {
      return api.sendMessage(
        "🎵 Please enter a song name.\n\nExample: ytmp3 Umaasa", 
        threadID, 
        messageID
      );
    }

    const searching = await api.sendMessage("🔍 Searching and downloading MP3...", threadID, messageID);

    // Your working API
    const apiUrl = `https://haji-mix-api.gleeze.com/api/youtube?search=${encodeURIComponent(query)}&stream=false&limit=1`;
    
    const res = await axios.get(apiUrl);
    const videos = res.data;

    if (!videos || videos.length === 0) {
      return api.editMessage("❌ No videos found.", searching.messageID);
    }

    // Get the first video result
    const video = videos[0];
    
    // Get the audio URL from the play field
    const audioUrl = video.play;
    
    if (!audioUrl) {
      return api.editMessage("❌ No audio stream available.", searching.messageID);
    }

    // Update searching message
    api.editMessage(
      `📥 Downloading: ${video.title}\n⏱️ Duration: ${video.duration.timestamp}\n📦 Please wait...`, 
      searching.messageID
    );

    // Create cache directory
    const cacheDir = path.join(__dirname, "cache");
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    // Download the audio file
    const audioPath = path.join(cacheDir, `yt_${Date.now()}.mp3`);
    const audioRes = await axios.get(audioUrl, { 
      responseType: "arraybuffer",
      timeout: 60000, // 60 seconds timeout for larger files
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    fs.writeFileSync(audioPath, audioRes.data);

    // Get file size
    const stats = fs.statSync(audioPath);
    const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);

    // Format view count
    const views = formatNumber(video.views);

    // Send the audio file
    api.sendMessage(
      {
        body: `🎵 YOUTUBE MP3\n━━━━━━━━━━━━━━━━\n` +
              `🎤 Title: ${video.title}\n` +
              `👤 Channel: ${video.author.name}\n` +
              `⏱️ Duration: ${video.duration.timestamp}\n` +
              `👁️ Views: ${views}\n` +
              `📦 Size: ${fileSizeInMB} MB\n` +
              `━━━━━━━━━━━━━━━━\n` +
              `🔗 Source: ${video.url}\n` +
              `💬 Requested by: ${senderName}`,
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

    // Store in memory
    memory[threadID].push(`Downloaded: ${video.title}`);

  } catch (err) {
    console.error("YouTube MP3 Error:", err);
    
    return api.sendMessage(
      `❌ Error: ${err.message}`,
      threadID,
      messageID
    );
  }
};

// Helper function to format numbers (views)
function formatNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}
