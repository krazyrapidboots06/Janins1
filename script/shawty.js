const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

const API_BASE = 'https://oreo.gleeze.com/api';
const API_KEY = '8bba3b09c3bba06c435701f3fba84f83d8e124be47c9a42e07002f4952d24f63';

// List of possible working endpoints to try
const endpoints = [
  `/shawty?api_key=${API_KEY}`,
  `/shawty?stream=false&api_key=${API_KEY}`
];

module.exports.config = {
  name: "shawty",
  version: "3.0.0",
  role: 0,
  credits: "selov",
  description: "Get random TikTok videos (silent mode)",
  commandCategory: "video",
  usages: "/shawty",
  cooldowns: 5
};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID } = event;
  
  // NO VISIBLE MESSAGES - just typing indicator
  api.sendTypingIndicator(threadID, true);
  
  let lastError = null;

  // Try each endpoint until one works
  for (const endpoint of endpoints) {
    try {
      const url = `${API_BASE}${endpoint}`;
      
      const response = await axios.get(url, { 
        timeout: 10000,
        validateStatus: status => status === 200
      });

      if (response.data?.success) {
        // Found working endpoint, process video silently
        await processVideo(response.data, api, event, messageID);
        return; // Exit after success
      }
    } catch (err) {
      console.log(`Endpoint failed: ${err.message}`);
      lastError = err;
    }
  }

  // If all endpoints failed - silent fail (no message to user)
  console.error('All endpoints failed:', lastError?.message);
};

async function processVideo(data, api, event, messageID) {
  const { threadID } = event;
  
  try {
    // Extract video URL
    let videoUrl = data.url || data.meta?.play || data.meta?.wmplay;
    
    if (!videoUrl) {
      throw new Error("No video URL in response");
    }

    const meta = data.meta || {};
    
    const cacheDir = path.join(__dirname, 'cache', 'shawty');
    await fs.ensureDir(cacheDir);
    
    const filePath = path.join(cacheDir, `shawty_${Date.now()}.mp4`);
    
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

    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    // Send ONLY the video - no text, no info
    api.sendMessage({
      attachment: fs.createReadStream(filePath)
    }, threadID, () => fs.unlinkSync(filePath), messageID);

  } catch (err) {
    console.error('Processing error:', err);
    // Silent fail - no message to user
  }
}
