const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

const API_BASE = 'https://oreo.gleeze.com/api';
const API_KEY = '8bba3b09c3bba06c435701f3fba84f83d8e124be47c9a42e07002f4952d24f63';

// List of possible working endpoints to try
const endpoints = [
  `/shawty?api_key=${API_KEY}`,
  `/shawty?stream=false&api_key=${API_KEY}`,
  `/tiktok/random?api_key=${API_KEY}`,
  `/random/tiktok?api_key=${API_KEY}`
];

module.exports.config = {
  name: "shawty",
  version: "2.1.0",
  role: 0,
  credits: "selov",
  description: "Get random TikTok videos",
  commandCategory: "video",
  usages: "/shawty",
  cooldowns: 5
};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID } = event;
  const waitingMsg = await api.sendMessage("🎬 Fetching random TikTok video...", threadID);

  let lastError = null;

  // Try each endpoint until one works
  for (const endpoint of endpoints) {
    try {
      const url = `${API_BASE}${endpoint}`;
      console.log(`Trying: ${url}`);
      
      const response = await axios.get(url, { 
        timeout: 10000,
        validateStatus: status => status === 200 // Only accept 200 as success
      });

      if (response.data?.success) {
        // Found working endpoint, process video
        return await processVideo(response.data, api, event, waitingMsg, messageID);
      }
    } catch (err) {
      console.log(`Endpoint failed: ${err.message}`);
      lastError = err;
      // Continue to next endpoint
    }
  }

  // If all endpoints failed
  await api.unsendMessage(waitingMsg.messageID);
  api.sendMessage(
    `❌ Failed to fetch video. All endpoints are currently unavailable.\n` +
    `Last error: ${lastError?.message || 'Unknown error'}`,
    threadID,
    messageID
  );
};

async function processVideo(data, api, event, waitingMsg, messageID) {
  const { threadID } = event;
  
  try {
    // Extract video URL (same logic as before)
    let videoUrl = data.url || data.meta?.play || data.meta?.wmplay;
    
    if (!videoUrl) {
      throw new Error("No video URL in response");
    }

    const meta = data.meta || {};
    await api.editMessage(`📥 Downloading video...`, waitingMsg.messageID);

    const cacheDir = path.join(__dirname, 'cache', 'shawty');
    await fs.ensureDir(cacheDir);
    
    const filePath = path.join(cacheDir, `shawty_${Date.now()}.mp4`);
    
    const downloadStream = await axios({
      method: 'GET',
      url: videoUrl,
      responseType: 'stream',
      timeout: 60000
    });

    const writer = fs.createWriteStream(filePath);
    downloadStream.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    await api.unsendMessage(waitingMsg.messageID);

    const infoMsg = 
      `🎬 **TikTok Video**\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `👤 **Author:** ${meta.author?.nickname || 'Unknown'}\n` +
      `📝 **Title:** ${meta.title || 'Untitled'}\n` +
      `⏱️ **Duration:** ${meta.duration || '?'}s\n` +
      `👁️ **Plays:** ${formatNumber(meta.play_count || 0)}\n` +
      `━━━━━━━━━━━━━━━━`;

    api.sendMessage({
      body: infoMsg,
      attachment: fs.createReadStream(filePath)
    }, threadID, () => fs.unlinkSync(filePath), messageID);

  } catch (err) {
    console.error('Processing error:', err);
    await api.unsendMessage(waitingMsg.messageID);
    api.sendMessage(`❌ Error: ${err.message}`, threadID, messageID);
  }
}

function formatNumber(num) {
  if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
  return num.toString();
}
