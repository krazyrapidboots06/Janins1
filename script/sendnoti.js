const axios = require("axios");

// Admin UIDs - Replace with actual admin UIDs for the bot
const ADMIN_UIDS = ["61556388598622"]; 

module.exports.config = {
  name: "sendnoti",
  version: "1.0.0",
  hasPermssion: 2, // Only admins (permission level 2) can use this command
  credits: "Manus",
  description: "Sends a notification message to all group chats the bot is in.",
  commandCategory: "admin",
  usages: "sendnoti <message>",
  cooldowns: 5
};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, senderID } = event;
  const message = args.join(" ").trim();

  // Check if the sender is an admin
  if (!ADMIN_UIDS.includes(senderID)) {
    return api.sendMessage("❌ You do not have permission to use this command.", threadID, messageID);
  }

  if (!message) {
    return api.sendMessage(
      "📌 Usage:\n• sendnoti <your message here>",
      threadID,
      messageID
    );
  }

  let successCount = 0;
  let failCount = 0;
  const failedThreads = [];

  try {
    // Get all threads the bot is part of. Max 100 threads, filtering for INBOX.
    const allThreads = await api.getThreadList(100, null, ["INBOX"]); 

    for (const thread of allThreads) {
      // Only send to group chats and exclude the current thread where the command was issued
      if (thread.isGroup && thread.threadID !== threadID) {
        try {
          await api.sendMessage(`📢 **NOTIFICATION FROM ADMIN**\n━━━━━━━━━━━━━━\n${message}`, thread.threadID);
          successCount++;
        } catch (error) {
          console.error(`Failed to send message to thread ${thread.threadID}: ${error.message}`);
          failCount++;
          failedThreads.push(thread.threadID);
        }
      }
    }

    let replyMessage = `✅ Sent notification to ${successCount} group chats.`;
    if (failCount > 0) {
      replyMessage += `\n❌ Failed to send to ${failCount} group chats: ${failedThreads.join(", ")}.`;
    }
    api.sendMessage(replyMessage, threadID, messageID);

  } catch (err) {
    console.error(err);
    api.sendMessage(
      `❌ An error occurred while sending notifications: ${err.message}`,
      threadID,
      messageID
    );
  }
};
