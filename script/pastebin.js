const axios = require("axios");

module.exports.config = {
  name: "pastebin",
  version: "1.0.0",
  hasPermssion: 0,
  credits: "Yasis",
  description: "Upload text to Pastebin",
  commandCategory: "tools",
  usages: "pastebin <text> or reply to text",
  cooldowns: 3
};

module.exports.run = async function ({ api, event, args }) {

  const { threadID, messageID, messageReply } = event;

  let text;

  // if replying to message
  if (messageReply && messageReply.body) {
    text = messageReply.body;
  } 
  // if user typed text
  else if (args.length > 0) {
    text = args.join(" ");
  }

  if (!text) {
    return api.sendMessage(
      "📌 Please enter text or reply to a message to upload to Pastebin.",
      threadID,
      messageID
    );
  }

  try {

    const apiUrl = `https://yin-api.vercel.app/tools/pastebin?text=${encodeURIComponent(text)}`;

    const res = await axios.get(apiUrl);

    if (!res.data || !res.data.url) {
      return api.sendMessage(
        "❌ Failed to upload to Pastebin.",
        threadID,
        messageID
      );
    }

    const pasteUrl = res.data.url;

    api.sendMessage(
      `📄 Pastebin Created\n\n🔗 ${pasteUrl}`,
      threadID,
      messageID
    );

  } catch (err) {

    console.error(err);

    api.sendMessage(
      "❌ Error uploading to Pastebin.",
      threadID,
      messageID
    );

  }

};