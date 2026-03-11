const axios = require("axios");

module.exports.config = {
  name: "music",
  version: "1.3.0",
  hasPermssion: 0,
  credits: "Vern",
  description: "Search your fav music to play",
  commandCategory: "music",
  usages: "[song name]",
  cooldowns: 3
};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID } = event;

  if (!args.length) {
    return api.sendMessage("📌 Usage: music<song name>", threadID, messageID);
  }

  const query = args.join(" ");

  const loadingMsg = await api.sendMessage(
    "🔎 Searching song...\n🎧 Preparing audio...",
    threadID
  );

  try {
    const apiUrl = `https://api-library-kohi.onrender.com/api/spotify?song=${encodeURIComponent(query)}`;
    const res = await axios.get(apiUrl);
    const data = res.data;

    if (!data.status || !data.data?.audioUrl) {
      return api.sendMessage(
        `❌ No results found for "${query}".`,
        threadID,
        loadingMsg.messageID
      );
    }

    const song = data.data;

    // fetching song
    await api.sendMessage(
      {
        body:
          `🎵 ${song.title}\n` +
          `👤 ${song.artist}\n` +
          `⏱ ${Math.floor(song.duration / 60)}:${(song.duration % 60)
            .toString()
            .padStart(2, "0")}`,
        attachment: await axios
          .get(song.thumbnail, { responseType: "stream" })
          .then(r => r.data)
      },
      threadID
    );

    // 🎧 STREAM AUDIO DIRECTLY (NO DOWNLOAD)
    const audioStream = await axios.get(song.audioUrl, {
      responseType: "stream"
    });

    await api.sendMessage(
      {
        body: "▶️ Now Playing:",
        attachment: audioStream.data
      },
      threadID
    );

    api.unsendMessage(loadingMsg.messageID);

  } catch (err) {
    console.error("SPOTIFY FAST ERROR:", err.message);
    api.sendMessage("❌ Failed to send audio.", threadID, loadingMsg.messageID);
  }
};