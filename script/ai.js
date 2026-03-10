const axios = require("axios");

module.exports.config = {
  name: "ai",
  version: "2.0.0",
  hasPermssion: 0,
  credits: "Yasis",
  description: "ask a questions",
  commandCategory: "search",
  usages: "ai <ask a questions> made by yasis",
  cooldowns: 2
};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, attachments, senderID } = event;

  let prompt = args.join(" ").trim();

  try {
    // get user name safely
    const user = await api.getUserInfo(senderID);
    const senderName = user[senderID]?.name || "User";

    // check image
    if (attachments && attachments.length > 0) {
      const photo = attachments.find(a => a.type === "photo");

      if (photo) {
        const imageUrl = photo.url;
        prompt = `Describe this photo in detail like a human:\n${imageUrl}`;
      }
    }

    if (!prompt) {
      return api.sendMessage(
        "📌 Usage:\n• ai <ask a question>\n• yasis describe it",
        threadID,
        messageID
      );
    }

    const apiUrl = `https://vern-rest-api.vercel.app/api/chatgpt4?prompt=${encodeURIComponent(prompt)}`;

    const response = await axios.get(apiUrl);

    if (!response.data) {
      return api.sendMessage("❌ No response from AI server.", threadID, messageID);
    }

    // detect response format automatically
    const reply =
      response.data.result ||
      response.data.response ||
      response.data.message ||
      response.data.answer;

    if (!reply) {
      console.log("API RAW RESPONSE:", response.data);
      return api.sendMessage(
        "❌ AI returned an unknown response format.",
        threadID,
        messageID
      );
    }

    return api.sendMessage(
      `🤖 AI Response for ${senderName}:\n\n${reply}`,
      threadID,
      messageID
    );

  } catch (err) {
    console.error("AI command error:", err);

    return api.sendMessage(
      `❌ Failed to get AI response.\n${err.message}`,
      threadID,
      messageID
    );
  }
};