const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

module.exports.config = {
  name: "shawty",
  version: "1.0.0",
  role: 0,
  credits: "selov",
  description: "Get random TikTok videos",
  commandCategory: "video",
  usages: "/shawty",
  cooldowns: 5
};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID } = event;

  try {
    // Send initial message
    const waitingMsg = await api.sendMessage("🎬 Fetching random TikTok video...", threadID);

    // Fetch video from API
    const apiUrl = 'https://apiremake-production.up.railway.app/api/random/tiktok?apikey=fdv_99SxsNRprZzIiLxRu3JJlA';
    
    const response = await axios.get(apiUrl, { timeout: 15000 });
    
    // Check if API returned successfully
    if (!response.data || !response.data.success) {
      throw new Error("API returned unsuccessful response");
    }

    // Get video URL - OPTION 1: Direct stream URL
    let videoUrl = response.data.url;
    
    // OPTION 2: If direct URL doesn't work, use meta.play
    if (!videoUrl && response.data.meta && response.data.meta.play) {
      videoUrl = response.data.meta.play;
    }
    
    // OPTION 3: Try wmplay (watermarked version)
    if (!videoUrl && response.data.meta && response.data.meta.wmplay) {
      videoUrl = response.data.meta.wmplay;
    }

    if (!videoUrl) {
      console.log("Full API response:", JSON.stringify(response.data, null, 2));
      throw new Error("No video URL found in response");
    }

    // Get video info for display
    const title = response.data.meta?.title || "TikTok Video";
    const author = response.data.meta?.author?.nickname || "Unknown";
    const duration = response.data.meta?.duration || "Unknown";
    const playCount = formatNumber(response.data.meta?.play_count || 0);
    const fileSize = response.data.meta?.size ? (response.data.meta.size / (1024 * 1024)).toFixed(2) + ' MB' : 'Unknown';

    await api.editMessage(`📥 Downloading video...`, waitingMsg.messageID);

    // Create cache directory
    const cacheDir = path.join(__dirname, 'cache', 'shawty');
    await fs.ensureDir(cacheDir);
    
    const filePath = path.join(cacheDir, `shawty_${Date.now()}.mp4`);
    
    // Download the video
    const downloadStream = await axios({
      method: 'GET',
      url: videoUrl,
      responseType: 'stream',
      timeout: 60000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const writer = fs.createWriteStream(filePath);
    downloadStream.data.pipe(writer);

    // Wait for download to complete
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    // Verify file was downloaded
    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      throw new Error("Downloaded file is empty");
    }

    // Delete waiting message
    await api.unsendMessage(waitingMsg.messageID);

    // Send the video
    api.sendMessage({
      body: `🎬 **TikTok Video**\n━━━━━━━━━━━━━━━━\n👤 **Author:** ${author}\n📝 **Title:** ${title}\n⏱️ **Duration:** ${duration}s\n👁️ **Plays:** ${playCount}\n📦 **Size:** ${fileSize}\n━━━━━━━━━━━━━━━━`,
      attachment: fs.createReadStream(filePath)
    }, threadID, () => {
      // Clean up file after sending
      fs.unlinkSync(filePath);
    }, messageID);

  } catch (err) {
    console.error('Shawty error:', err.message);
    console.error('Full error:', err);
    api.sendMessage(`❌ Error: ${err.message}`, threadID, messageID);
  }
};

// Helper function to format numbers
function formatNumber(num) {
  if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
  return num.toString();
}
