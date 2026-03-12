const axios = require("axios");
const fs = require("fs");
const path = require("path");

module.exports.config = {
  name: "spotify",
  version: "1.0.0",
  hasPermssion: 0,
  credits: "Yasis",
  description: "Search Spotify and send song",
  commandCategory: "music",
  usages: "spotify <song name>",
  cooldowns: 5
};

module.exports.run = async function ({ api, event, args }) {

  const { threadID, messageID } = event;
  const query = args.join(" ");

  if (!query) {
    return api.sendMessage(
      "🎵 Please enter a song name.\n\nExample:\nspotify multo",
      threadID,
      messageID
    );
  }

  try {

    api.sendMessage("🎧 Searching Spotify... please wait.", threadID, messageID);

    const apiUrl = `https://deku-api.giize.com/search/spotify?q=${encodeURIComponent(query)}`;

    const res = await axios.get(apiUrl);

    if (!res.data || !res.data.result || res.data.result.length === 0) {
      return api.sendMessage("❌ Song not found.", threadID, messageID);
    }

    const song = res.data.result[0];

    const title = song.title || "Unknown";
    const artist = song.artist || "Unknown";
    const cover = song.image;
    const audio = song.audio || song.download || song.preview;

    const audioPath = path.join(__dirname, "cache", `spotify_${Date.now()}.mp3`);
    const coverPath = path.join(__dirname, "cache", `spotify_${Date.now()}.jpg`);

    if (cover) {
      const img = await axios.get(cover, { responseType: "arraybuffer" });
      fs.writeFileSync(coverPath, img.data);
    }

    if (audio) {
      const aud = await axios.get(audio, { responseType: "arraybuffer" });
      fs.writeFileSync(audioPath, aud.data);
    }

    api.sendMessage(
      {
        body: `🎵 ${title}\n👤 Artist: ${artist}`,
        attachment: [
          fs.existsSync(coverPath) ? fs.createReadStream(coverPath) : null,
          fs.existsSync(audioPath) ? fs.createReadStream(audioPath) : null
        ].filter(Boolean)
      },
      threadID,
      () => {
        if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
        if (fs.existsSync(coverPath)) fs.unlinkSync(coverPath);
      },
      messageID
    );

  } catch (err) {

    console.error(err);

    api.sendMessage(
      "❌ Failed to fetch the song.",
      threadID,
      messageID
    );
  }

};