const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

// Support Group Thread ID - where reports will be sent
const SUPPORT_GROUP_ID = "1656635809077071";

// Admin UIDs (optional - for notifications)
const ADMIN_UIDS = ["61556388598622", "61552057602849"];

module.exports.config = {
  name: "feedback",
  version: "3.0.0",
  role: 0,
  credits: "selov",
  description: "Send reports, feedback, bugs to support group",
  commandCategory: "contacts",
  usages: "/callad <message>",
  cooldowns: 5,
  aliases: ["report", "feedback", "support"]
};

// Global store for reply handlers
if (!global.calladReplyHandlers) global.calladReplyHandlers = {};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, senderID, isGroup, attachments, messageReply } = event;
  const message = args.join(" ").trim();

  if (!message) {
    return api.sendMessage(
      "📨 SUPPORT REQUEST\n━━━━━━━━━━━━━━━━\n" +
      "Send your report, feedback, or bug to the support group.\n\n" +
      "Example: /callad There's a bug in the bot\n" +
      "Reply to an image: /callad Check this issue",
      threadID,
      messageID
    );
  }

  // Set reaction
  api.setMessageReaction("📨", messageID, () => {}, true);

  // Get sender info
  const userInfo = await api.getUserInfo(senderID);
  const senderName = userInfo[senderID]?.name || "User";

  // Prepare message header
  let msgHeader = `📨 SUPPORT REQUEST\n━━━━━━━━━━━━━━━━\n👤 User: ${senderName}\n🆔 ID: ${senderID}`;
  
  if (isGroup) {
    const threadInfo = await api.getThreadInfo(threadID);
    msgHeader += `\n📌 Group: ${threadInfo.threadName}\n🔢 Group ID: ${threadID}`;
  } else {
    msgHeader += `\n💬 Private Message`;
  }

  // Add timestamp
  msgHeader += `\n📅 Date: ${new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" })}`;

  const formMessage = {
    body: msgHeader + `\n━━━━━━━━━━━━━━━━\n💬 Message:\n${message}\n━━━━━━━━━━━━━━━━\n💡 Admin: Reply to this message to respond to user.`,
    mentions: [{ id: senderID, tag: senderName }]
  };

  // Add attachments if any
  if (attachments && attachments.length > 0) {
    formMessage.attachment = attachments.map(att => 
      fs.createReadStream(att.url)
    );
  }

  try {
    // Send to support group
    const sentMsg = await api.sendMessage(formMessage, SUPPORT_GROUP_ID);
    
    // Store for reply handling
    global.calladReplyHandlers[sentMsg.messageID] = {
      type: "supportRequest",
      threadID: threadID,
      messageIDSender: messageID,
      senderID: senderID,
      senderName: senderName,
      userMessage: message,
      timestamp: Date.now()
    };
    
    // Auto-expire after 24 hours
    setTimeout(() => {
      if (global.calladReplyHandlers[sentMsg.messageID]) {
        delete global.calladReplyHandlers[sentMsg.messageID];
      }
    }, 24 * 60 * 60 * 1000);
    
    // Send confirmation to user
    api.sendMessage(
      `✅ Your message has been sent to the support group!\n\n` +
      `📝 Message: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}\n\n` +
      `💡 The support team will respond as soon as possible.`,
      threadID,
      messageID
    );
    
    // Optionally notify admins via private message (optional)
    for (const adminId of ADMIN_UIDS) {
      try {
        await api.sendMessage(
          `📨 **New Support Request**\n━━━━━━━━━━━━━━━━\n👤 User: ${senderName}\n🆔 ID: ${senderID}\n💬 Message: ${message.substring(0, 200)}\n\n📌 Check support group for details.`,
          adminId
        );
      } catch (e) {}
    }
    
  } catch (err) {
    console.error("Callad Error:", err);
    api.sendMessage(
      `❌ ADD MO MUNA BOT ACC MO SA SUPPORTGC PARA GUMANA.\n\nError: ${err.message}\n\nPlease try again later.`,
      threadID,
      messageID
    );
  }
};

// Handle replies from admins in support group
module.exports.handleReply = async function ({ api, event }) {
  const { threadID, messageID, senderID, body, attachments, messageReply } = event;
  
  // Only process messages from the support group
  if (threadID !== SUPPORT_GROUP_ID) return;
  
  if (!messageReply) return;
  
  const repliedMessageID = messageReply.messageID;
  const handlerData = global.calladReplyHandlers[repliedMessageID];
  
  if (!handlerData) return;
  
  const { type, threadID: userThreadID, messageIDSender, senderID: userSenderID, senderName: userName } = handlerData;
  
  // Get admin info
  const adminInfo = await api.getUserInfo(senderID);
  const adminName = adminInfo[senderID]?.name || "Admin";
  
  const replyText = body || "";
  
  // Send reply to user
  const replyMessage = {
    body: `📨 SUPPORT RESPONSE\n━━━━━━━━━━━━━━━━\n👤 Admin: ${adminName}\n━━━━━━━━━━━━━━━━\n💬 Response:\n${replyText}\n━━━━━━━━━━━━━━━━\n💡 Reply to this message to continue the conversation.`,
    mentions: [{ id: userSenderID, tag: userName || "User" }]
  };
  
  if (attachments && attachments.length > 0) {
    replyMessage.attachment = attachments.map(att => 
      fs.createReadStream(att.url)
    );
  }
  
  api.sendMessage(replyMessage, userThreadID, (err, info) => {
    if (err) {
      console.error("Error sending reply to user:", err);
      api.sendMessage(`❌ Failed to send reply to user.`, threadID, messageID);
      return;
    }
    
    // Send confirmation to admin
    api.sendMessage(`✅ Reply sent to ${userName || "user"} successfully!**`, threadID, messageID);
    
    // Store for further replies from user
    global.calladReplyHandlers[info.messageID] = {
      type: "userReply",
      threadID: threadID,
      messageIDSender: info.messageID,
      senderID: userSenderID,
      senderName: userName,
      adminID: senderID,
      adminName: adminName
    };
    
    // Clean up old handler
    delete global.calladReplyHandlers[repliedMessageID];
  }, messageIDSender);
  
  // Also handle user replies to admin responses
  if (type === "userReply") {
    // This handles when user replies to admin's response
    const userReply = {
      body: `📨 USER REPLY\n━━━━━━━━━━━━━━━━\n👤 **User:** ${userName || "User"}\n━━━━━━━━━━━━━━━━\n💬 **Message:**\n${replyText}\n━━━━━━━━━━━━━━━━\n💡 Reply to continue the conversation.`,
      mentions: [{ id: userSenderID, tag: userName || "User" }]
    };
    
    if (attachments && attachments.length > 0) {
      userReply.attachment = attachments.map(att => 
        fs.createReadStream(att.url)
      );
    }
    
    api.sendMessage(userReply, handlerData.threadID, (err, info) => {
      if (err) {
        console.error("Error sending user reply to admin:", err);
        return;
      }
      
      global.calladReplyHandlers[info.messageID] = {
        type: "supportRequest",
        threadID: userThreadID,
        messageIDSender: info.messageID,
        senderID: userSenderID,
        senderName: userName,
        timestamp: Date.now()
      };
    });
  }
};
