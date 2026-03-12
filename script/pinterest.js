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

    if (!res.data || !res.data.result.result.pins) {
      return api.sendMessage("❌ Failed to search Pinterest.", threadID, messageID);
    }

    const pins = res.data.result.result.pins.slice(0, 10);
    const attachments = [];
    const imgPaths = [];

    for (let i = 0; i < pins.length; i++) {
      const imageUrl = pins[i].media.images.large.url;
      const imgPath = path.join(__dirname, "cache", `pinterest_${Date.now()}_${i}.jpg`);

      const img = await axios.get(imageUrl, { responseType: "arraybuffer" });

      fs.writeFileSync(imgPath, img.data);
      attachments.push(fs.createReadStream(imgPath));
      imgPaths.push(imgPath);
    }

    api.sendMessage(
      {
        body: `📌 Pinterest Search: "${query}"\n\n📸 Found ${attachments.length} images`,
        attachment: attachments
      },
      threadID,
      () => {
        imgPaths.forEach(imgPath => fs.unlinkSync(imgPath));
      },
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