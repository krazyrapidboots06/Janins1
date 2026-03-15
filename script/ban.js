const axios = require("axios");
const fs = require("fs");
const path = require("path");
const moment = require("moment-timezone");

module.exports.config = {
  name: "ban",
  version: "1.4.0",
  role: 1, // Group admins only
  credits: "selov",
  description: "Ban/unban members from group chat",
  commandCategory: "admin",
  usages: "/ban [@tag|uid|reply] [reason] or /ban list or /ban unban [@tag|uid|reply]",
  cooldowns: 5
};

// Simple memory for banned users (you can replace with database)
const bannedMemory = {};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, senderID } = event;
  const command = args[0]?.toLowerCase();

  try {
    // Initialize memory for this thread
    if (!bannedMemory[threadID]) {
      bannedMemory[threadID] = {
        banned: [],
        admins: []
      };
    }

    // Get thread info
    const threadInfo = await api.getThreadInfo(threadID);
    const adminIDs = threadInfo.adminIDs?.map(admin => admin.id) || [];
    const members = threadInfo.participantIDs || [];

    // Check if user is admin
    if (!adminIDs.includes(senderID)) {
      return api.sendMessage("❌ Only group admins can use this command.", threadID, messageID);
    }

    // HELP command
    if (!command) {
      const helpMsg = 
        `🔨 **BAN COMMAND HELP**\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `• ${global.config.PREFIX}ban @tag <reason> - Ban tagged user\n` +
        `• ${global.config.PREFIX}ban reply <reason> - Ban replied user\n` +
        `• ${global.config.PREFIX}ban uid <uid> <reason> - Ban by UID\n` +
        `• ${global.config.PREFIX}ban list - List banned users\n` +
        `• ${global.config.PREFIX}ban unban @tag/uid/reply - Unban user\n` +
        `• ${global.config.PREFIX}ban check - Check and kick banned users`;
      return api.sendMessage(helpMsg, threadID, messageID);
    }

    // LIST banned users
    if (command === "list") {
      const bannedList = bannedMemory[threadID].banned;
      
      if (bannedList.length === 0) {
        return api.sendMessage("📑 No banned users in this group.", threadID, messageID);
      }

      let listMsg = `📑 **BANNED USERS**\n━━━━━━━━━━━━━━━━\n`;
      
      for (let i = 0; i < bannedList.length; i++) {
        const user = bannedList[i];
        listMsg += `${i + 1}. 👤 ${user.name || 'Unknown'}\n`;
        listMsg += `   🆔 ID: ${user.id}\n`;
        listMsg += `   📝 Reason: ${user.reason}\n`;
        listMsg += `   ⏰ Time: ${user.time}\n\n`;
      }
      
      return api.sendMessage(listMsg, threadID, messageID);
    }

    // CHECK and kick banned users
    if (command === "check") {
      const bannedList = bannedMemory[threadID].banned;
      let kicked = 0;

      for (const user of bannedList) {
        if (members.includes(user.id)) {
          try {
            await api.removeUserFromGroup(user.id, threadID);
            kicked++;
          } catch (err) {
            console.log(`Failed to kick ${user.id}:`, err.message);
          }
        }
      }

      return api.sendMessage(`✅ Checked banned users. Kicked ${kicked} members.`, threadID, messageID);
    }

    // UNBAN user
    if (command === "unban") {
      let target = null;
      const subCommand = args[1];

      // Find target to unban
      if (subCommand?.startsWith('@') && Object.keys(event.mentions || {}).length) {
        target = Object.keys(event.mentions)[0];
      } else if (event.messageReply?.senderID) {
        target = event.messageReply.senderID;
      } else if (!isNaN(subCommand)) {
        target = subCommand;
      } else {
        return api.sendMessage("❌ Please tag, reply, or provide UID of user to unban.", threadID, messageID);
      }

      const index = bannedMemory[threadID].banned.findIndex(u => u.id === target);
      
      if (index === -1) {
        return api.sendMessage(`❌ User with ID ${target} is not banned.`, threadID, messageID);
      }

      const unbannedUser = bannedMemory[threadID].banned[index];
      bannedMemory[threadID].banned.splice(index, 1);

      return api.sendMessage(
        `✅ **Unbanned Successfully**\n━━━━━━━━━━━━━━━━\n` +
        `👤 Name: ${unbannedUser.name || 'Unknown'}\n` +
        `🆔 ID: ${target}`,
        threadID,
        messageID
      );
    }

    // BAN user
    let target = null;
    let reason = args.slice(1).join(" ").trim() || "No reason provided";

    // Find target to ban
    if (command.startsWith('@') && Object.keys(event.mentions || {}).length) {
      target = Object.keys(event.mentions)[0];
      reason = args.slice(1).join(" ").replace(event.mentions[target], "").trim() || "No reason provided";
    } else if (event.messageReply?.senderID) {
      target = event.messageReply.senderID;
    } else if (!isNaN(command)) {
      target = command;
      reason = args.slice(1).join(" ").trim() || "No reason provided";
    } else {
      return api.sendMessage("❌ Please tag, reply, or provide UID of user to ban.", threadID, messageID);
    }

    // Validation checks
    if (target === senderID) {
      return api.sendMessage("❌ You cannot ban yourself.", threadID, messageID);
    }

    if (adminIDs.includes(target)) {
      return api.sendMessage("❌ You cannot ban a group admin.", threadID, messageID);
    }

    if (bannedMemory[threadID].banned.some(u => u.id === target)) {
      return api.sendMessage("❌ This user is already banned.", threadID, messageID);
    }

    // Get user name
    let userName = "Unknown";
    try {
      const userInfo = await api.getUserInfo(target);
      userName = userInfo[target]?.name || "Unknown";
    } catch (e) {}

    // Add to banned list
    const banData = {
      id: target,
      name: userName,
      reason: reason,
      time: moment().tz("Asia/Manila").format("HH:mm:ss MM/DD/YYYY"),
      bannedBy: senderID
    };

    bannedMemory[threadID].banned.push(banData);

    // Try to kick if user is in group
    if (members.includes(target)) {
      try {
        await api.removeUserFromGroup(target, threadID);
        return api.sendMessage(
          `✅ **Banned and Kicked**\n━━━━━━━━━━━━━━━━\n` +
          `👤 Name: ${userName}\n` +
          `🆔 ID: ${target}\n` +
          `📝 Reason: ${reason}\n` +
          `⏰ Time: ${banData.time}`,
          threadID,
          messageID
        );
      } catch (err) {
        return api.sendMessage(
          `⚠️ **Banned but cannot kick**\n` +
          `❌ Bot needs admin privileges to kick members.\n\n` +
          `👤 Name: ${userName}\n` +
          `🆔 ID: ${target}\n` +
          `📝 Reason: ${reason}`,
          threadID,
          messageID
        );
      }
    } else {
      return api.sendMessage(
        `✅ **Banned** (User not in group)\n━━━━━━━━━━━━━━━━\n` +
        `👤 Name: ${userName}\n` +
        `🆔 ID: ${target}\n` +
        `📝 Reason: ${reason}`,
        threadID,
        messageID
      );
    }

  } catch (err) {
    console.error("Ban Command Error:", err);
    api.sendMessage(`❌ Error: ${err.message}`, threadID, messageID);
  }
};
