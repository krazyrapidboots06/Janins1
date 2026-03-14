module.exports.config = {
  name: "pornsearch",
  version: "1.0.0", 
  role: 0,
  credits: "syntaxt0x1c",
  description: "Search Pornhub for videos.",
  usages: "[keyword]",
  cooldown: 5,
};

module.exports.run = async ({ api, event }) => {
  const axios = require('axios');
  
  try {
    // Get search term from user
    const query = (event.body).slice(10);
    
    if (!query) return await api.sendMessage("Please provide a keyword.", event.threadID, event.messageID);

    // Construct API request URL with proper encoding
    const url = `https://betadash-api-swordslush-production.up.railway.app/pornhub/search?q=${encodeURIComponent(query)}`;

    // Send request to Pornhub search endpoint
    const response = await axios.get(url);
    
    if (!response.data || !Array.isArray(response.data.videos)) {
      return await api.sendMessage("No results found.", event.threadID, event.messageID);
    }

    // Get first result for demonstration purposes
    const video = response.data.videos[0];
    
    // Format metadata
    let msg = `PornHub search for "${query}":
Title: ${video.title}
Duration: ${Math.floor(video.duration / 60)}:${String(video.duration % 60).padStart(2, '0')}
Views: ${video.views.toLocaleString()}
Likes: ${video.likes}
`;

    // Send results
    await api.sendMessage(msg + video.link, event.threadID);

  } catch (error) {
    console.error(error);
    return await api.sendMessage("Error fetching search results.", event.threadID);
  }
};
