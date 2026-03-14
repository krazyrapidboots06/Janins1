const axios = require("axios");
const fs = require("fs");
const path = require("path");

module.exports.config = {
  name: "onlytik",
  version: "1.0.0",
  role: 0,
  credits: "selov",
  description: "Get random onlytik videos",
  usages: "[search term or random]",
  cooldown: 3,
  hasPrefix: true,
};

module.exports.run = async ({ api, event, args }) => {
  const { messageID, threadID } = event;

  // Show that we’re working
  api.setMessageReaction("⏳", messageID, () => {}, true);

  const query = args.join(" ").trim();

  try {
    /* ---------- Build the correct API URL ---------- */
    let apiUrl;
    if (query) {
      // Search query
      apiUrl = `https://haji-mix-api.gleeze.com/api/onlytik?stream=true&search=${encodeURIComponent(
        query
      )}`;
    } else {
      // Random video
      apiUrl = "https://haji-mix-api.gleeze.com/api/onlytik?stream=true&count=1";
    }

    /* ---------- Call the API ---------- */
    const { data } = await axios.get(apiUrl, { timeout: 30000 });

    /* ---------- Find the video URL ---------- */
    let videoUrl = null;

    if (Array.isArray(data) && data[0] && data[0].play) {
      // Response shape: [{ play: "...", wmplay: "..." }]
      videoUrl = data[0].play || data[0].wmplay;
    } else if (data && data.videos && Array.isArray(data.videos)) {
      // Response shape: { videos: [{ play: "...", wmplay: "..." }] }
      videoUrl = data.videos[0].play || data.videos[0].wmplay;
    }

    if (!videoUrl) {
      api.setMessageReaction("❌", messageID, () => {}, true);
      return api.sendMessage(
        "❌ No video found. Try a different search term.",
        threadID,
        messageID
      );
    }

    /* ---------- Download the video ---------- */
    const cacheDir = path.join(__dirname, "cache");
    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });

    const videoPath = path.join(
      cacheDir,
      `tiktok_${Date.now()}.mp4`
    );
    const videoRes = await axios.get(videoUrl, {
      responseType: "arraybuffer",
      timeout: 60000,
    });
    fs.writeFileSync(videoPath, videoRes.data);

    /* ---------- Send the video ---------- */
    api.setMessageReaction("✅", messageID, () => {}, true);
    api.sendMessage(
      {
        body: query
          ? `🎵 TikTok search: "${query}"`
          : "🎵 Random TikTok video",
        attachment: fs.createReadStream(videoPath),
      },
      threadID,
      () => {
        // Delete the temp file after sending
        try {
          fs.unlinkSync(videoPath);
        } catch (e) {
          console.warn("Could not delete temp file:", e.message);
        }
      },
      messageID
    );
  } catch (err) {
    console.error("TikTok Error:", err);
    api.setMessageReaction("❌", messageID, () => {}, true);
    const errorMsg =
      err.response && err.response.status
        ? `❌ Request failed (${err.response.status}).`
        : `❌ Error: ${err.message}`;
    return api.sendMessage(errorMsg, threadID, messageID);
  }
};
