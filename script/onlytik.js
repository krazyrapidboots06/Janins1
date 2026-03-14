/**
 * OnlyTik – Send a random TikTok video
 *
 * API: https://haji-mix-api.gleeze.com/api/onlytik?stream=true
 *
 * Dependencies:
 *   - axios
 *   - fs
 *   - path
 *
 * Usage:
 *   !onlytik          (sends a random video)
 */
const axios = require('axios');
const fs = require('fs');
const path = require('path');

module.exports.config = {
  name: 'onlytik',
  version: '1.0.0',
  role: 2,
  credits: 'selov',
  description: 'Send a random TikTok video from the OnlyTik API',
  usages: '',
  cooldown: 3,
  hasPrefix: true,
};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID } = event;

  // Show that we’re working
  api.setMessageReaction('⏳', messageID, () => {}, true);

  const apiUrl = 'https://haji-mix-api.gleeze.com/api/onlytik?stream=true';

  try {
    // Fetch the data
    const res = await axios.get(apiUrl, { timeout: 30000 });

    // Verify structure
    const videos = res.data?.data?.videos;
    if (!Array.isArray(videos) || videos.length === 0) {
      api.setMessageReaction('❌', messageID, () => {}, true);
      return api.sendMessage('❌ No video found. Try again later.', threadID, messageID);
    }

    // Grab the first video
    const videoInfo = videos[0];
    const videoUrl = videoInfo.play || videoInfo.wmplay;
    if (!videoUrl) {
      api.setMessageReaction('❌', messageID, () => {}, true);
      return api.sendMessage('❌ No video URL available.', threadID, messageID);
    }

    // Prepare a local temp file
    const cacheDir = path.join(__dirname, 'cache');
    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
    const filePath = path.join(cacheDir, `onlytik_${Date.now()}.mp4`);

    // Download the video
    const videoRes = await axios.get(videoUrl, { responseType: 'arraybuffer', timeout: 60000 });
    fs.writeFileSync(filePath, videoRes.data);

    // Send it back
    api.sendMessage(
      { body: '🎵 Random TikTok 🎬', attachment: fs.createReadStream(filePath) },
      threadID,
      () => {
        // Clean up the temp file
        try { fs.unlinkSync(filePath); } catch (e) {}
      },
      messageID
    );

    api.setMessageReaction('✅', messageID, () => {}, true);

  } catch (err) {
    console.error('OnlyTik error:', err);
    api.setMessageReaction('❌', messageID, () => {}, true);
    const errMsg = err.response
      ? `❌ Request failed (${err.response.status})`
      : `❌ ${err.message}`;
    api.sendMessage(errMsg, threadID, messageID);
  }
};
