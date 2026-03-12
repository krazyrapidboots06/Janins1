const axios = require("axios");
const fs = require("fs");
const path = require("path");

module.exports.config = {
  name: "red",
  version: "1.0.0",
  hasPermssion: 0,
  credits: "Yasis",
  description: "Fetch a random video from the API",
  commandCategory: "media",
  usages: "red",
  cooldowns: 5
};

module.exports.run = async function ({ api, event }) {
  const { threadID, messageID } = event;

  try {
    api.sendMessage("🎬 Fetching a random video... please wait.", threadID, messageID);

    const res = await axios.get("https://deku-api.giize.com/prn/home");
    const data = res.data;

    if (!data || !Object.keys(data).length) {
      return api.sendMessage("❌ Failed to fetch video.", threadID, messageID);
    }

    // Pick a random key (0,1,2,...)
    const keys = Object.keys(data).filter(k => k !== "status" && k !== "author");
    const randomKey = keys[Math.floor(Math.random() * keys.length)];
    const videoInfo = data[randomKey];

    const videoUrl = videoInfo.video;
    const thumbnailUrl = videoInfo.thumbnail;
    const title = videoInfo.title || "No title";
    const duration = videoInfo.duration || "Unknown";
    const uploaderName = videoInfo.uploaderName || "Unknown";
    const uploaderProfile = videoInfo.uploaderProfile || "";

    const videoPath = path.join(__dirname, "cache", `video_${Date.now()}.mp4`);
    const thumbPath = path.join(__dirname, "cache", `thumb_${Date.now()}.jpg`);

    // Download video
    const videoResp = await axios.get(videoUrl, { responseType: "arraybuffer" });
    fs.writeFileSync(videoPath, videoResp.data);

    // Download thumbnail
    const thumbResp = await axios.get(thumbnailUrl, { responseType: "arraybuffer" });
    fs.writeFileSync(thumbPath, thumbResp.data);

    // Send message with video + thumbnail
    api.sendMessage(
      {
        body: `🎬 ${title}\n⏱ Duration: ${duration}\n👤 Uploader: ${uploaderName}\n🔗 Profile: ${uploaderProfile}`,
        attachment: fs.createReadStream(videoPath)
      },
      threadID,
      () => {
        fs.unlinkSync(videoPath);
        fs.unlinkSync(thumbPath);
      },
      messageID
    );

  } catch (err) {
    console.error(err);
    api.sendMessage("❌ Error fetching video.", threadID, messageID);
  }
};