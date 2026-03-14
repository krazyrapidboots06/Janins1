const axios = require("axios");
const fs = require("fs");
const path = require("path");

module.exports.config = {
  name: "katorsex",
  version: "6.0.0",
  hasPermssion: 0,
  credits: "Yasis",
  description: "Get random video (Admin Only)",
  commandCategory: "video",
  usages: "/katorsex",
  cooldowns: 5
};

// Admin Facebook UIDs - Only these users can use this command
const ADMIN_UIDS = [
  "61556388598622",
  "61552057602849"
];

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, senderID } = event;

  try {
    // Check if user is admin
    if (!ADMIN_UIDS.includes(senderID.toString())) {
      // Get user info for logging
      const user = await api.getUserInfo(senderID);
      const userName = user[senderID]?.name || "Unknown";
      
      // Log unauthorized attempt
      console.log(`❌ UNAUTHORIZED ACCESS ATTEMPT:
User: ${userName}
UID: ${senderID}
Time: ${new Date().toLocaleString()}
Command: katorsex`);
      
      // Send clear permission denied message
      return api.sendMessage(
        "⛔ **Access Denied**\n\nThis command is restricted to admins only.\n\nIf you believe this is an error, please contact the bot administrator. ",
        threadID,
        messageID
      );
    }

    // Get admin user's name
    const user = await api.getUserInfo(senderID);
    const senderName = user[senderID]?.name || "Admin";

    // Log authorized access
    console.log(`✅ Admin access: ${senderName} (${senderID})`);

    const waiting = await api.sendMessage("🔍 Accessing video source...", threadID, messageID);

    // Try to fetch videos
    const apiUrl = "https://betadash-api-swordslush-production.up.railway.app/katorsex?page=1";
    
    api.editMessage("📡 Connecting to video server...", waiting.messageID);
    
    const response = await axios.get(apiUrl, { 
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      }
    });

    // Get videos array from response
    let videos = [];
    
    if (response.data && Array.isArray(response.data)) {
      videos = response.data;
    } else if (response.data && response.data.results && Array.isArray(response.data.results)) {
      videos = response.data.results;
    } else if (response.data && response.data.data && Array.isArray(response.data.data)) {
      videos = response.data.data;
    } else if (response.data && response.data.videos && Array.isArray(response.data.videos)) {
      videos = response.data.videos;
    }

    if (videos.length === 0) {
      api.editMessage("❌ No videos found in response.", waiting.messageID);
      return;
    }

    api.editMessage(`✅ Found ${videos.length} videos. Selecting one...`, waiting.messageID);

    // Get random video
    const randomIndex = Math.floor(Math.random() * videos.length);
    const selectedVideo = videos[randomIndex];

    // Find video URL in different possible fields
    let videoUrl = null;
    const possibleFields = [
      'videoUrl', 'downloadUrl', 'url', 'link', 'video', 
      'mp4', 'file', 'src', 'source', 'content', 'path'
    ];

    for (const field of possibleFields) {
      if (selectedVideo[field]) {
        videoUrl = selectedVideo[field];
        break;
      }
    }

    // Also check nested objects
    if (!videoUrl && selectedVideo.video_info) {
      for (const field of possibleFields) {
        if (selectedVideo.video_info[field]) {
          videoUrl = selectedVideo.video_info[field];
          break;
        }
      }
    }

    if (!videoUrl) {
      api.editMessage("❌ Could not find video URL in the data.", waiting.messageID);
      return;
    }

    api.editMessage(`📥 Downloading video (${randomIndex + 1}/${videos.length})...`, waiting.messageID);

    // Create cache directory
    const cacheDir = path.join(__dirname, "cache", "videos");
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    // Download the video
    const videoPath = path.join(cacheDir, `video_${Date.now()}.mp4`);
    
    try {
      const videoResponse = await axios.get(videoUrl, {
        responseType: "arraybuffer",
        timeout: 60000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'video/mp4,video/*;q=0.9,*/*;q=0.8'
        }
      });

      fs.writeFileSync(videoPath, videoResponse.data);
      
      const stats = fs.statSync(videoPath);
      const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

      api.unsendMessage(waiting.messageID);

      // Send the video with admin badge
      api.sendMessage(
        {
          body: `🎬 **ADMIN VIDEO**\n━━━━━━━━━━━━━━━━\n` +
                `**Title:** ${selectedVideo.title || 'Untitled'}\n` +
                `**Size:** ${fileSizeMB} MB\n` +
                `**Video #:** ${randomIndex + 1}/${videos.length}\n` +
                `━━━━━━━━━━━━━━━━\n` +
                `👑 Requested by: ${senderName} (Admin)`,
          attachment: fs.createReadStream(videoPath)
        },
        threadID,
        (err) => {
          if (err) console.error("Send error:", err);
          setTimeout(() => {
            try { fs.unlinkSync(videoPath); } catch (e) {}
          }, 60000);
        },
        messageID
      );

    } catch (downloadErr) {
      console.error("Download error:", downloadErr);
      api.editMessage(`❌ Download failed: ${downloadErr.message}`, waiting.messageID);
    }

  } catch (err) {
    console.error("Command Error:", err);
    
    // Only show detailed error to admins
    if (ADMIN_UIDS.includes(senderID.toString())) {
      let errorMessage = err.message;
      if (err.response) {
        errorMessage = `API returned status ${err.response.status}`;
      }
      api.sendMessage(`❌ Error: ${errorMessage}`, threadID, messageID);
    }
  }
};
