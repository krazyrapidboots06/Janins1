const axios = require("axios");
const fs = require("fs");
const path = require("path");

module.exports.config = {
  name: "red",
  version: "5.0.0",
  hasPermssion: 0,
  credits: "Yasis",
  description: "Fetch a random video from the API",
  commandCategory: "media",
  usages: "red",
  cooldowns: 5
};

module.exports.run = async function ({ api, event }) {
  const { threadID, messageID } = event;

  try {
    const waiting = await api.sendMessage("🎬 Fetching a random video... please wait.", threadID, messageID);

    // API endpoint
    const apiUrl = "https://betadash-api-swordslush-production.up.railway.app/lootedpinay?page=1";
    
    const res = await axios.get(apiUrl, { timeout: 10000 });

    // Get videos from response
    const videos = res.data.result || [];
    
    if (videos.length === 0) {
      api.unsendMessage(waiting.messageID);
      return api.sendMessage("❌ No videos found.", threadID, messageID);
    }

    // Get random video
    const randomVideo = videos[Math.floor(Math.random() * videos.length)];
    
    const videoUrl = randomVideo.videoUrl;
    const title = randomVideo.title || "Untitled";

    if (!videoUrl) {
      api.unsendMessage(waiting.messageID);
      return api.sendMessage("❌ Video URL not found.", threadID, messageID);
    }

    api.editMessage(`📥 Checking video size...`, waiting.messageID);

    // Create cache directory
    const cacheDir = path.join(__dirname, "cache", "red");
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    // First, check the file size without downloading fully
    try {
      const headResponse = await axios.head(videoUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Referer': 'https://pinayflix.top/'
        }
      });

      const contentLength = headResponse.headers['content-length'];
      
      if (contentLength) {
        const fileSizeMB = (parseInt(contentLength) / (1024 * 1024)).toFixed(2);
        
        // Facebook limit is around 25MB for videos
        if (parseInt(contentLength) > 25 * 1024 * 1024) {
          api.unsendMessage(waiting.messageID);
          return api.sendMessage(
            `❌ Video is too large (${fileSizeMB} MB). Facebook limit is 25MB.\nTry another video.`,
            threadID,
            messageID
          );
        }
      }
    } catch (headErr) {
      console.log("Head request failed, proceeding with download anyway:", headErr.message);
    }

    api.editMessage(`📥 Downloading: ${title}...`, waiting.messageID);

    // Download video with size limit
    const videoPath = path.join(cacheDir, `red_${Date.now()}.mp4`);
    
    try {
      const videoResp = await axios.get(videoUrl, { 
        responseType: "stream",
        timeout: 60000,
        maxContentLength: 30 * 1024 * 1024, // 30MB limit
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Accept': 'video/mp4,video/*;q=0.9,*/*;q=0.8',
          'Referer': 'https://pinayflix.top/'
        }
      });

      // Check content length from response headers
      const contentLength = videoResp.headers['content-length'];
      if (contentLength) {
        const fileSizeMB = (parseInt(contentLength) / (1024 * 1024)).toFixed(2);
        if (parseInt(contentLength) > 25 * 1024 * 1024) {
          api.unsendMessage(waiting.messageID);
          return api.sendMessage(
            `❌ Video is too large (${fileSizeMB} MB). Facebook limit is 25MB.`,
            threadID,
            messageID
          );
        }
      }

      // Create write stream
      const writer = fs.createWriteStream(videoPath);
      videoResp.data.pipe(writer);

      // Wait for download to complete
      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      // Check final file size
      const stats = fs.statSync(videoPath);
      const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
      
      if (stats.size > 25 * 1024 * 1024) {
        fs.unlinkSync(videoPath);
        api.unsendMessage(waiting.messageID);
        return api.sendMessage(
          `❌ Video is too large (${fileSizeMB} MB). Facebook limit is 25MB.`,
          threadID,
          messageID
        );
      }

      api.unsendMessage(waiting.messageID);

      // Send video
      api.sendMessage(
        {
          body: `🎬 **RANDOM VIDEO**\n━━━━━━━━━━━━━━━━\n` +
                `**Title:** ${title}\n` +
                `**Size:** ${fileSizeMB} MB\n` +
                `━━━━━━━━━━━━━━━━`,
          attachment: fs.createReadStream(videoPath)
        },
        threadID,
        (err) => {
          if (err) {
            console.error("Send error:", err);
            api.sendMessage("❌ Failed to send video. It might be too large.", threadID);
          }
          setTimeout(() => {
            try { fs.unlinkSync(videoPath); } catch (e) {}
          }, 60000);
        },
        messageID
      );

    } catch (downloadErr) {
      console.error("Download error:", downloadErr);
      
      // Check if it's a size limit error
      if (downloadErr.message.includes('maxContentLength')) {
        api.editMessage("❌ Video is too large (over 30MB). Try another video.", waiting.messageID);
      } else {
        api.editMessage("❌ Download failed. Try another video.", waiting.messageID);
      }
      
      // Clean up if file was partially created
      if (fs.existsSync(videoPath)) {
        try { fs.unlinkSync(videoPath); } catch (e) {}
      }
    }

  } catch (err) {
    console.error("Red Command Error:", err);
    api.sendMessage(`❌ Error: ${err.message}`, threadID, messageID);
  }
};
