const axios = require("axios");

// Admin UIDs - Double-check these are correct
const ADMIN_UIDS = ["61556388598622", "61552057602849"];

module.exports.config = {
  name: "callad",
  version: "2.4.0",
  hasPermssion: 0,
  credits: "NTKhang & Manus",
  description: "Send reports to admin (Ultra-Stable Version)",
  commandCategory: "contacts",
  usages: "callad <message>",
  cooldowns: 5,
  aliases: ["report", "feedback"]
};

if (!global.calladReplyHandlers) global.calladReplyHandlers = {};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, senderID, isGroup } = event;
  const message = args.join(" ").trim();

  if (!message) {
    return api.sendMessage("📨 Please enter a message to send to the admin.", threadID, messageID);
  }

  let senderName = "User";
  try {
    const userInfo = await api.getUserInfo(senderID);
    senderName = userInfo[senderID]?.name || "User";
  } catch (e) { console.error(e); }

  const reportMsg = `📨 **NEW REPORT**\n👤 From: ${senderName}\n🆔 ID: ${senderID}\n💬 Message: ${message}\n\n💡 Reply to this message to respond.`;

  for (const adminID of ADMIN_UIDS) {
    // 1. Send typing indicator first to "wake up" the thread
    api.sendTypingIndicator(adminID, (err) => {
      if (err) console.error(`Typing error for ${adminID}:`, err);
      
      // 2. Send the actual message using the simplest string format
      api.sendMessage(reportMsg, adminID, (err, info) => {
        if (err) {
          console.error(`[callad] ❌ Failed to send to admin ${adminID}:`, err);
        } else if (info) {
          global.calladReplyHandlers[info.messageID] = {
            type: "userCallAdmin",
            threadID: threadID,
            messageIDSender: messageID,
            senderID: senderID,
            senderName: senderName
          };
        }
      });
    });
  }

  // Confirmation to the user
  api.sendMessage(`✅ Your report has been sent to the admins.`, threadID, messageID);
};

module.exports.handleReply = async function ({ api, event }) {
  const { threadID, messageID, senderID, body, messageReply } = event;
  if (!messageReply || !body) return;

  const handler = global.calladReplyHandlers[messageReply.messageID];
  if (!handler) return;

  const isAdmin = ADMIN_UIDS.includes(senderID);

  if (isAdmin && handler.type === "userCallAdmin") {
    api.sendMessage(`📨 **ADMIN REPLY**\n💬 Message: ${body}`, handler.threadID, (err, info) => {
      if (!err && info) {
        global.calladReplyHandlers[info.messageID] = {
          type: "adminReply",
          threadID: threadID,
          messageIDSender: info.messageID,
          senderID: senderID
        };
        api.sendMessage("✅ Reply sent to user.", threadID, messageID);
      }
    }, handler.messageIDSender);
  } else if (!isAdmin && handler.type === "adminReply") {
    api.sendMessage(`📨 **USER REPLY**\n💬 Message: ${body}`, handler.threadID, (err, info) => {
      if (!err && info) {
        global.calladReplyHandlers[info.messageID] = {
          type: "userCallAdmin",
          threadID: threadID,
          messageIDSender: info.messageID,
          senderID: senderID
        };
        api.sendMessage("✅ Reply sent to admin.", threadID, messageID);
      }
    }, handler.messageIDSender);
  }
};
