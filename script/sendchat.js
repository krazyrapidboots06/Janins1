const axios = require("axios");

// Admin UIDs (optional, but good practice to define if not using hasPermssion: 2 for global admin)
// const ADMIN_UIDS = ["YOUR_ADMIN_UID_1", "YOUR_ADMIN_UID_2"]; 

module.exports.config = {
  name: "sendchat",
  version: "1.0.0",
  hasPermssion: 3, // Set to 2 for admin-only access
  credits: "selov",
  description: "Send a message to a specific group chat by its threadID.",
  commandCategory: "admin",
  usages: "sendchat <message> | <threadID>",
  cooldowns: 5
};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, senderID } = event;

  // Check if the sender is an admin (hasPermssion: 2 already handles this, but good for clarity)
  // if (!ADMIN_UIDS.includes(senderID)) {
  //   return api.sendMessage("❌ You do not have permission to use this command.", threadID, messageID);
  // }

  const input = args.join(" ");
  const parts = input.split("|").map(part => part.trim());

  if (parts.length < 2) {
    return api.sendMessage(
      "📌 Usage: sendchat <message> | <threadID>\nExample: sendchat Hello everyone! | 1234567890",
      threadID,
      messageID
    );
  }

  const messageToSend = parts[0];
  const targetThreadID = parts[1];

  if (!messageToSend || !targetThreadID) {
    return api.sendMessage(
      "📌 Usage: sendchat <message> | <threadID>\nExample: sendchat Hello everyone! | 1234567890",
      threadID,
      messageID
    );
  }

  try {
    // Validate if targetThreadID is a valid number
    if (isNaN(targetThreadID)) {
      return api.sendMessage("❌ Invalid Thread ID. Please provide a numeric Thread ID.", threadID, messageID);
    }

    await api.sendMessage(
      `📢 Admin message from ${senderID}:\n${messageToSend}`,
      targetThreadID
    );

    api.sendMessage(
      `✅ Message successfully sent to threadID: ${targetThreadID}`, 
      threadID,
      messageID
    );
  } catch (error) {
    console.error(`[sendchat] Failed to send message to ${targetThreadID}:`, error);
    api.sendMessage(
      `❌ Failed to send message to threadID: ${targetThreadID}. Error: ${error.message}`,
      threadID,
      messageID
    );
  }
};
