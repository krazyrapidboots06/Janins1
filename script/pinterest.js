const axios = require("axios");
const fs = require("fs");
const path = require("path");

module.exports.config = {
  name: "pinterest",
  version: "1.0.0",
  hasPermssion: 0,
  credits: "Yasis",
  description: "Search and download images from Pinterest",
  commandCategory: "search",
  usages: "pinterest <query>",
  cooldowns: 5
};

module.exports.run = async function ({ api, event, args }) {

  const { threadID, messageID } = event;
  const query = args.join(" ");

  if (!query) {
    return api.sendMessage(
      "📌 Please enter a search query.\n\nExample:\n pinterest cat",
      threadID,
      messageID
    );
  }

  try {

    api.sendMessage("🔍 Searching Pinterest... please wait.", threadID, messageID);

    const apiUrl = `https://deku-api.giize.com/search/pinterest?q=${encodeURIComponent(query)}`;

    const res = await axios.get(apiUrl);

    if (!res.data || !res.data.status || !res.data.result.result.pins || res.data.result.result.pins.length === 0) {
      return api.sendMessage("❌ No images found for your search.", threadID, messageID);
    }

    const pins = res.data.result.result.pins.slice(0, 10);
    const attachments = [];

    for (let i = 0; i < pins.length; i++) {
      const pin = pins[i];
      const imageUrl = pin.media.images.large.url;

      try {
        const img = await axios.get(imageUrl, { responseType: "arraybuffer" });
        attachments.push(img.data);
      } catch (imgErr) {
        console.error(`Failed to download image ${i + 1}:`, imgErr.message);
      }
    }

    if (attachments.length === 0) {
      return api.sendMessage("❌ Failed to download images.", threadID, messageID);
    }

    api.sendMessage(
      {
        body: `📌 Pinterest Search: "${query}"\n\n📸 Found ${attachments.length} images`,
        attachment: attachments
      },
      threadID,
      messageID
    );

  } catch (err) {

    console.error(err);

    api.sendMessage(
      "❌ Error searching Pinterest.",
      threadID,
      messageID
    );
  }

};