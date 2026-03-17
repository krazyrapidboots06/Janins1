const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

const SEARCH_URL = 'https://rapido-api.vercel.app/api/sp';
const API_KEY = 'zk-f50c8cb6ab9a0932f90abe0ea147959f227845da812fbeb30c8e114950a3ddd4';

module.exports.config = {
  name: "spotify",
  version: "2.0.0",
  role: 0,
  hasPrefix: true,
  aliases: ['spotifydl', 'spdl'],
  usage: 'spotify [song name]',
  description: 'Search and download songs from Spotify',
  credits: 'Selov',
  cooldown: 10
};

module.exports.run = async function ({ api, event, args }) {
  const songName = args.join(' ');
  if (!songName) {
    return api.sendMessage(`🎵 **Usage:** spotify <song name>\nExample: spotify Umbrella`, event.threadID, event.messageID);
  }

  const searchingMsg = await api.sendMessage(`🔍 Searching for "${songName}" on Spotify...`, event.threadID);

  try {
    // Search Spotify
    const searchRes = await axios.get(`${SEARCH_URL}?query=${encodeURIComponent(songName)}&apikey=${API_KEY}`);
    
    // Log response for debugging
    console.log("Spotify API Response:", JSON.stringify(searchRes.data, null, 2).substring(0, 500));

    // Extract tracks from response
    let tracks = [];
    
    // Handle different response formats
    if (searchRes.data && Array.isArray(searchRes.data)) {
      tracks = searchRes.data;
    } else if (searchRes.data && searchRes.data.tracks && Array.isArray(searchRes.data.tracks)) {
      tracks = searchRes.data.tracks;
    } else if (searchRes.data && searchRes.data.result && Array.isArray(searchRes.data.result)) {
      tracks = searchRes.data.result;
    } else if (searchRes.data && typeof searchRes.data === 'object') {
      // If it's an object with numeric keys
      tracks = Object.values(searchRes.data).filter(item => item && typeof item === 'object');
    }

    if (tracks.length === 0) {
      return api.editMessage(`❌ No results found for "${songName}".`, searchingMsg.messageID);
    }

    // Get first track
    const track = tracks[0];
    
    // Extract track info
    const title = track.name || track.title || "Unknown Title";
    const artist = track.artist || track.artists?.[0]?.name || "Unknown Artist";
    const url = track.url || track.external_urls?.spotify || "";
    const image = track.image || track.album?.images?.[0]?.url || "";
    const duration = track.duration || track.duration_ms ? formatDuration(track.duration_ms) : "Unknown";

    // If we have a download URL directly
    if (track.downloadUrl || track.mp3Url || track.audioUrl) {
      const downloadUrl = track.downloadUrl || track.mp3Url || track.audioUrl;
      
      await api.editMessage(`⬇️ Downloading: ${title} - ${artist}...`, searchingMsg.messageID);
      
      return await downloadAndSendAudio(api, event, {
        url: downloadUrl,
        title,
        artist,
        image,
        duration
      }, searchingMsg.messageID);
    }
    
    // If we have a Spotify URL but no direct download, try to get download link
    if (url) {
      await api.editMessage(`🔗 Found track. Attempting to get download link...`, searchingMsg.messageID);
      
      // Try to get download link (you might need a different endpoint)
      // For now, just send track info with Spotify link
      
      const trackInfo = 
        `🎵 **${title}**\n` +
        `👤 **Artist:** ${artist}\n` +
        `⏱️ **Duration:** ${duration}\n\n` +
        `🔗 **Listen on Spotify:**\n${url}`;
      
      // Download image if available
      let attachment = null;
      if (image) {
        try {
          const imgPath = path.join(__dirname, 'cache', `spotify_${Date.now()}.jpg`);
          const imgRes = await axios.get(image, { responseType: 'arraybuffer' });
          fs.writeFileSync(imgPath, imgRes.data);
          attachment = fs.createReadStream(imgPath);
          
          setTimeout(() => fs.unlinkSync(imgPath), 10000);
        } catch (e) {}
      }
      
      await api.editMessage(trackInfo, searchingMsg.messageID);
      
      return api.sendMessage({
        body: trackInfo,
        attachment
      }, event.threadID, event.messageID);
    }

    // If we reach here, no downloadable content found
    return api.editMessage(`❌ No downloadable content found for this track.`, searchingMsg.messageID);

  } catch (err) {
    console.error('Spotify error:', err.message);
    console.error('Full error:', err);
    api.editMessage(`❌ Error: ${err.message}`, searchingMsg?.messageID || event.messageID);
  }
};

// Helper function to download and send audio
async function downloadAndSendAudio(api, event, trackInfo, originalMsgId) {
  const { url, title, artist, image, duration } = trackInfo;
  
  try {
    const cacheDir = path.join(__dirname, 'cache');
    await fs.ensureDir(cacheDir);
    
    const filePath = path.join(cacheDir, `spotify_${Date.now()}.mp3`);
    
    const downloadRes = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream',
      timeout: 30000
    });

    const writer = fs.createWriteStream(filePath);
    downloadRes.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', async () => {
        try {
          const stats = fs.statSync(filePath);
          const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
          
          // Check file size (max 25MB)
          if (stats.size > 25 * 1024 * 1024) {
            fs.unlinkSync(filePath);
            api.editMessage(`⚠️ File too large (${fileSizeMB}MB). Max 25MB.`, originalMsgId);
            return resolve();
          }

          const messageBody = 
            `🎵 **${title}**\n` +
            `👤 **Artist:** ${artist}\n` +
            `⏱️ **Duration:** ${duration}\n` +
            `📦 **Size:** ${fileSizeMB} MB`;

          await api.unsendMessage(originalMsgId);
          
          api.sendMessage({
            body: messageBody,
            attachment: fs.createReadStream(filePath)
          }, event.threadID, () => {
            fs.unlinkSync(filePath);
          }, event.messageID);
          
          resolve();
        } catch (err) {
          reject(err);
        }
      });

      writer.on('error', reject);
    });

  } catch (err) {
    api.editMessage(`❌ Download failed: ${err.message}`, originalMsgId);
  }
}

// Helper function to format duration
function formatDuration(ms) {
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes}:${seconds.padStart(2, '0')}`;
}
