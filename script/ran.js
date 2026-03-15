const axios = require("axios");
const fs = require("fs");
const path = require("path");

module.exports.config = {
  name: "ran",
  version: "2.0.0",
  role: 0,
  credits: "selov",
  description: "Get random videos (Admin Only)",
  commandCategory: "video",
  usages: "/ran",
  cooldowns: 5
};

// Admin UIDs only - Only these users can use this command
const ADMIN_UIDS = ["61556388598622", "61552057602849"];

// Your API key
const API_KEY = "f4d88af66e3d36f9117ae53243248bd5";

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, senderID } = event;

  // CHECK: Is user authorized?
  if (!ADMIN_UIDS.includes(senderID.toString())) {
    // Silent fail - no response to unauthorized users
    return;
  }

  try {
    const user = await api.getUserInfo(senderID);
    const senderName = user[senderID]?.name || "Admin";

    // Fetch random video from API
    const apiUrl = `https://deku-api.giize.com/randgore?apikey=${API_KEY}`;
    
    const response = await axios.get(apiUrl, { timeout: 10000 });

    // Get video data from response
    const videoData = response.data.result;
    
    if (!videoData) {
      return api.sendMessage("❌ No video available.", threadID, messageID);
    }

    // Get video URL (use video1 or video2)
    const videoUrl = videoData.video1 || videoData.video2;
    
    if (!videoUrl) {
      return api.sendMessage("❌ Video URL not found.", threadID, messageID);
    }

    // Create cache directory
    const cacheDir = path.join(__dirname, "cache");
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    // Download video
    const videoPath = path.join(cacheDir, `ran_${Date.now()}.mp4`);
    
    const videoResponse = await axios.get(videoUrl, {
      responseType: "arraybuffer",
      timeout: 60000,
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://seegore.com/'
      }
    });

    fs.writeFileSync(videoPath, videoResponse.data);

    // Get file size
    const fileSizeMB = (fs.statSync(videoPath).size / (1024 * 1024)).toFixed(2);

    // Send video with info
    api.sendMessage(
      {
        body: `🎬 **RANDOM VIDEO**\n━━━━━━━━━━━━━━━━\n` +
              `**Title:** ${videoData.title || 'Untitled'}\n` +
              `**Size:** ${fileSizeMB} MB\n` +
              `**Views:** ${videoData.view || 'N/A'}\n` +
              `**Upload:** ${videoData.upload || 'N/A'}\n` +
              `━━━━━━━━━━━━━━━━\n` +
              `👑 Requested by: ${senderName} (Admin)`,
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
    console.error("Random Video Error:", err);
    // Only show error to admins
    if (ADMIN_UIDS.includes(senderID.toString())) {
      api.sendMessage(`❌ Error: ${err.message}`, threadID, messageID);
    }
  }
};
