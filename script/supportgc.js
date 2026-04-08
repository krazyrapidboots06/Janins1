module.exports.config = {
  name: "supportgc",
  version: "1.0.0",
  hasPermssion: 0,
  credits: "selov",
  description: "Join the official support group chat",
  commandCategory: "system",
  usages: "/supportgc",
  cooldowns: 3
};

// Your support group thread ID
const SUPPORT_GROUP_ID = "1231424145851292";

module.exports.run = async function ({ api, event }) {
  const { threadID, messageID, senderID } = event;

  try {
    // Check if user is already in the support group
    const threadInfo = await api.getThreadInfo(SUPPORT_GROUP_ID).catch(() => null);
    
    if (threadInfo) {
      const participantIDs = threadInfo.participantIDs || [];
      
      if (participantIDs.includes(senderID)) {
        return api.sendMessage(
          "✅ You are already a member of our support group!\n\n" +
          "📌 **Group Link:**\n" +
          `https://www.facebook.com/messages/t/${SUPPORT_GROUP_ID}`,
          threadID,
          messageID
        );
      }
    }

    // Send waiting message
    api.sendMessage("🔄 Adding you to support group...", threadID, messageID);

    // Add user to support group
    await api.addUserToGroup(senderID, SUPPORT_GROUP_ID);

    // Send confirmation
    api.sendMessage(
      "✅ **Successfully added to support group!**\n\n" +
      "Please check your Facebook inbox/spam folder for the group invite.\n\n" +
      "📌 **Group Link:**\n" +
      `https://www.facebook.com/messages/t/${SUPPORT_GROUP_ID}`,
      threadID,
      messageID
    );

  } catch (err) {
    console.error("Support Group Error:", err);
    
    // Handle specific errors
    let errorMessage = "❌ CHAT MO OWNER KO PARA MA ADD SA SUPPORT GC: https://facebook.com/quart.hade  or https://www.facebook.com/messages/t/1231424145851292\n\n";
    
    if (err.message.includes("block")) {
      errorMessage += "**Reason:** You have blocked the bot or have privacy settings that prevent being added.";
    } else if (err.message.includes("permission")) {
      errorMessage += "**Reason:** Bot doesn't have permission to add members.";
    } else if (err.message.includes("limit")) {
      errorMessage += "**Reason:** Group has reached maximum member limit.";
    } else {
      errorMessage += `**Error:** ${err.message}`;
    }

    errorMessage += "\n\n📌 **Manual Join:**\n" +
                    `https://www.facebook.com/messages/t/${SUPPORT_GROUP_ID}`;

    api.sendMessage(errorMessage, threadID, messageID);
  }
};
