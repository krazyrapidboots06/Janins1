const axios = require("axios");

module.exports.config = {
  name: "gemini",
  version: "3.0.0",
  hasPermssion: 0,
  credits: "Yasis",
  description: "ask a question",
  commandCategory: "search",
  usages: "gemini <ask a questions> made by yasis",
  cooldowns: 2
};

// simple memory per thread
const memory = {};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, senderID, attachments } = event;

  let prompt = args.join(" ").trim();

  try {

    // get sender name
    const user = await api.getUserInfo(senderID);
    const senderName = user[senderID]?.name || "User";

    // detect photo
    if (attachments && attachments.length > 0) {
      const photo = attachments.find(a => a.type === "photo");

      if (photo) {
        prompt = `Describe this image in detail:\n${photo.url}`;
      }
    }

    if (!prompt) {
      return api.sendMessage(
        "📌 Usage:\n• ai <question>\n• send a photo to describe it",
        threadID,
        messageID
      );
    }

    // memory system
    if (!memory[threadID]) memory[threadID] = [];

    memory[threadID].push(`User: ${prompt}`);

    const history = memory[threadID].slice(-6).join("\n");

    const fullPrompt = `${history}\nAI:`;


    const apiUrl = `https://text.pollinations.ai/${encodeURIComponent(fullPrompt)}`;

    const res = await axios.get(apiUrl);

    const reply = res.data;

    if (!reply) {
      return api.sendMessage(
        "❌ AI returned empty response.",
        threadID,
        messageID
      );
    }

    memory[threadID].push(`AI: ${reply}`);

    api.sendMessage(
      `🤖 AI\n━━━━━━━━━━━━━━\n${reply}`,
      threadID,
      messageID
    );

  } catch (err) {

    console.error(err);

    api.sendMessage(
      `❌ AI Error:\n${err.message}`,
      threadID,
      messageID
    );

  }
};