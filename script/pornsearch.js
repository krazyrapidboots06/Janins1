module.exports.config = {
  name: "porn",
  version: "1.0", 
  role: 0,
  credits: "syntaxt0x1c",
  description: "Search PornHub for videos.",
  usages: "[keyword]",
};

module.exports.run = async ({ api, event }) => {
  const axios = require('axios');
  
  try {
    // Extract search query
    let query = (event.body).slice(6);
    
    if (!query) return await api.sendMessage("Please provide a keyword.", event.threadID);

    // Construct API request URL with proper encoding
    const url = `https://betadash-api-swordslush-production.up.railway.app/pornhub/search?q=${encodeURIComponent(query)}`;

    // Send request to PornHub search endpoint
    const response = await axios.get(url);
    
    if (!response.data || !Array.isArray(response.data.videos)) {
      return await api.sendMessage("No results found.", event.threadID);
    }

    // Extract first video URL
    let videoUrl;
    for (let i = 0; i < Math.min(3, response.data.videos.length); i++) {
      const video = response.data.videos[i];
      
      if (!video.link) continue;

      try {
        // Test if the link is valid with timeout
        await axios.head(video.link, { timeout: 5000 });
        
        videoUrl = video.link;
        break;
      } catch (e) {}
    }

    if (!videoUrl) return await api.sendMessage("No playable videos found.", event.threadID);

    // Send the video
    const cacheDir = path.join(__dirname, "cache");
    fs.existsSync(cacheDir) || fs.mkdirSync(cacheDir, { recursive: true });
    
    const tempPath = path.join(cacheDir, `porn_${Date.now()}.mp4`);
    await axios.get(videoUrl, {
      responseType: 'stream',
      timeout: 15000
    }).then(response => response.data.pipe(fs.createWriteStream(tempPath)));

    // Send the video to chat and cleanup when done
    api.sendMessage({ attachment: fs.createReadStream(tempPath) }, event.threadID);
    
    setTimeout(() => {
      try { 
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); 
      } catch(e) {}
    }, 3000);

  } catch (error) {
    console.error("Porn search error:", error.message);
    return await api.sendMessage(`Error searching porn: ${error.message}`, event.threadID);
  }
};
