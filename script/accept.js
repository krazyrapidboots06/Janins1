const axios = require("axios");

module.exports.config = {
  name: "accept",
  version: "1.0.0",
  role: 1, // Only bot admins
  credits: "selov",
  description: "Manage friend requests",
  commandCategory: "admin",
  usages: "{pn} [list|accept|reject] [number|all]",
  cooldowns: 3
};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID } = event;
  const command = args[0]?.toLowerCase();
  const option = args[1]?.toLowerCase();

  try {
    // Get all friend requests
    const friendRequests = await api.getFriendRequests();
    
    if (!friendRequests || friendRequests.length === 0) {
      return api.sendMessage("📭 No pending friend requests.", threadID, messageID);
    }

    // LIST COMMAND - Show all friend requests
    if (command === "list") {
      let listMessage = `📋 **PENDING FRIEND REQUESTS**\n━━━━━━━━━━━━━━━━\n`;
      
      friendRequests.forEach((req, index) => {
        listMessage += `${index + 1}. 👤 **${req.name || 'Unknown'}**\n`;
        listMessage += `   🆔 ID: ${req.userID}\n`;
        if (req.message) listMessage += `   💬 Message: ${req.message}\n`;
        listMessage += `\n`;
      });
      
      listMessage += `━━━━━━━━━━━━━━━━\n`;
      listMessage += `💡 Use:\n`;
      listMessage += `• ${global.config.PREFIX}friend accept [number/all]\n`;
      listMessage += `• ${global.config.PREFIX}friend reject [number/all]`;
      
      return api.sendMessage(listMessage, threadID, messageID);
    }

    // ACCEPT COMMAND
    if (command === "accept" || command === "add") {
      if (!option) {
        return api.sendMessage(
          "❌ Please specify which request to accept.\n\n" +
          `Example: ${global.config.PREFIX}friend accept 1\n` +
          `Example: ${global.config.PREFIX}friend accept all`,
          threadID,
          messageID
        );
      }

      if (option === "all") {
        let accepted = 0;
        let failed = 0;

        for (const req of friendRequests) {
          try {
            await api.acceptFriendRequest(req.userID);
            accepted++;
          } catch (err) {
            console.error(`Failed to accept ${req.userID}:`, err.message);
            failed++;
          }
        }

        return api.sendMessage(
          `✅ **Friend requests processed**\n━━━━━━━━━━━━━━━━\n` +
          `• Accepted: ${accepted}\n` +
          `• Failed: ${failed}\n` +
          `━━━━━━━━━━━━━━━━`,
          threadID,
          messageID
        );
      } else {
        const index = parseInt(option) - 1;
        
        if (isNaN(index) || index < 0 || index >= friendRequests.length) {
          return api.sendMessage(
            `❌ Invalid number. Please choose 1-${friendRequests.length}.`,
            threadID,
            messageID
          );
        }

        const req = friendRequests[index];
        
        try {
          await api.acceptFriendRequest(req.userID);
          
          return api.sendMessage(
            `✅ **Friend request accepted**\n━━━━━━━━━━━━━━━━\n` +
            `👤 Name: ${req.name || 'Unknown'}\n` +
            `🆔 ID: ${req.userID}`,
            threadID,
            messageID
          );
        } catch (err) {
          return api.sendMessage(
            `❌ Failed to accept request: ${err.message}`,
            threadID,
            messageID
          );
        }
      }
    }

    // REJECT COMMAND
    if (command === "reject" || command === "del" || command === "delete") {
      if (!option) {
        return api.sendMessage(
          "❌ Please specify which request to reject.\n\n" +
          `Example: ${global.config.PREFIX}friend reject 1\n` +
          `Example: ${global.config.PREFIX}friend reject all`,
          threadID,
          messageID
        );
      }

      if (option === "all") {
        let rejected = 0;
        let failed = 0;

        for (const req of friendRequests) {
          try {
            await api.rejectFriendRequest(req.userID);
            rejected++;
          } catch (err) {
            console.error(`Failed to reject ${req.userID}:`, err.message);
            failed++;
          }
        }

        return api.sendMessage(
          `✅ **Friend requests processed**\n━━━━━━━━━━━━━━━━\n` +
          `• Rejected: ${rejected}\n` +
          `• Failed: ${failed}\n` +
          `━━━━━━━━━━━━━━━━`,
          threadID,
          messageID
        );
      } else {
        const index = parseInt(option) - 1;
        
        if (isNaN(index) || index < 0 || index >= friendRequests.length) {
          return api.sendMessage(
            `❌ Invalid number. Please choose 1-${friendRequests.length}.`,
            threadID,
            messageID
          );
        }

        const req = friendRequests[index];
        
        try {
          await api.rejectFriendRequest(req.userID);
          
          return api.sendMessage(
            `✅ **Friend request rejected**\n━━━━━━━━━━━━━━━━\n` +
            `👤 Name: ${req.name || 'Unknown'}\n` +
            `🆔 ID: ${req.userID}`,
            threadID,
            messageID
          );
        } catch (err) {
          return api.sendMessage(
            `❌ Failed to reject request: ${err.message}`,
            threadID,
            messageID
          );
        }
      }
    }

    // DEFAULT - Show help
    const helpMessage = 
      `🤝 **FRIEND REQUEST MANAGER**\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `**Commands:**\n` +
      `• ${global.config.PREFIX}friend list - View pending requests\n` +
      `• ${global.config.PREFIX}friend accept [number/all] - Accept request(s)\n` +
      `• ${global.config.PREFIX}friend reject [number/all] - Reject request(s)\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `**Examples:**\n` +
      `• ${global.config.PREFIX}friend accept 1\n` +
      `• ${global.config.PREFIX}friend accept all\n` +
      `• ${global.config.PREFIX}friend reject 3\n` +
      `• ${global.config.PREFIX}friend reject all`;

    return api.sendMessage(helpMessage, threadID, messageID);

  } catch (err) {
    console.error("Friend Command Error:", err);
    return api.sendMessage(`❌ Error: ${err.message}`, threadID, messageID);
  }
};
