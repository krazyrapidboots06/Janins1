const axios = require("axios");

module.exports.config = {
  name: "videoSearch",
  role: 0, 
  description: "Search for videos",
  usage: "[title of video]",
  credits: "syntaxt0x1c",
  cooldown: 0,
  hasPrefix: false
}

module.exports.run = async function({ api, event, args }) {
  const query = args.join(" ");

  if (!query) return api.sendMessage("[❌] The video title is 𝗠𝗜𝗦𝗦𝗜𝗡𝗚.", event.threadID, event.messageID);

  try {
    const apiUrl = `https://markdevs-last-api-2epw.onrender.com/pornhubsearch?search=${encodeURIComponent(query)}`;
    const r = await axios.get(apiUrl);
    const { videos } = response.data;

    // Check if videos exist
    if (!videos || videos.length === 0) {
      return api.sendMessage("[❌] No videos found for the provided title.", event.threadID, event.messageID);
    }

    // Get the first video
    const { title, link, thumbnail } = videos[0];

    // Send the video message
    const messageBody = `🎥 𝗛𝗘𝗥𝗘 𝗜𝗦 𝗔 𝗩𝗜𝗗𝗘𝗢\n\n` +
                        `▪[📑] 𝗧𝗜𝗧𝗟𝗘: ${title}\n` +
                        `▪[🔗] 𝗟𝗜𝗡𝗞: ${link}\n` +
                        `━━━━━━━━━━━\n` +
                        `🟢 Enjoy!`;

    // Send the video thumbnail as an attachment
    const thumbnailResponse = await axios.get(thumbnail, { responseType: "arraybuffer" });
    const imgBuffer = Buffer.from(thumbnailResponse.data, "utf-8");
    const img = Buffer.from(imgBuffer);
    
    return api.sendMessage({
      body: messageBody,
      attachment: img
    }, event.threadID, event.messageID);
    
  } catch (error) {
    api.setMessageReaction("😿", event.messageID, (err) => {}, true);
    console.error("Error fetching video:", error);
    return api.sendMessage("[❌] An error occurred while fetching video information. Please try again later.", event.threadID, event.messageID);
  }
}
