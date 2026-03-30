"use strict";

const axios = require("axios");

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🔧 ADMIN UIDs — Add your Facebook UID(s) here
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const ADMIN_UIDS = ["61552057602849"];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ⚙️ COMMAND CONFIG
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

module.exports.config = {
  name: "callad",
  version: "2.1.0",
  role: 0,
  credits: "NTKhang & Manus (fixed by selov)",
  description: "Send reports, feedback, bugs to bot admin",
  commandCategory: "contacts",
  usages: "/callad <message>",
  cooldowns: 5,
  aliases: ["report", "feedback"]
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🔧 GLOBAL REPLY HANDLER STORE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

if (!global.calladReplyHandlers) global.calladReplyHandlers = {};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🔧 HELPER: Download attachment as stream
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function getAttachmentStreams(attachments) {
  if (!attachments || !attachments.length) return [];
  const streams = [];
  for (const att of attachments) {
    try {
      const url = att.url || att.playbackUrl || att.previewUrl;
      if (!url) continue;
      const res = await axios.get(url, { responseType: "stream", timeout: 10000 });
      streams.push(res.data);
    } catch (_) {}
  }
  return streams;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🚀 MAIN RUN FUNCTION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, senderID, isGroup, attachments, messageReply } = event;
  const userMessage = args.join(" ").trim();

  // ── NO MESSAGE ──
  if (!userMessage && !(attachments && attachments.length)) {
    return api.sendMessage(
      `📨 CALL ADMIN\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Send a message or report to the bot admin.\n\n` +
      `📌 Usage: /callad <message>\n` +
      `📖 Example: /callad There is a bug in the bot\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━`,
      threadID,
      messageID
    );
  }

  if (!ADMIN_UIDS.length) {
    return api.sendMessage(
      `❌ No admin UID configured in this bot.`,
      threadID,
      messageID
    );
  }

  // ── GET SENDER INFO ──
  let senderName = "User";
  try {
    const userInfo = await api.getUserInfo(senderID);
    senderName = userInfo[senderID]?.name || "User";
  } catch (e) {
    console.error("[callad] getUserInfo error:", e?.message);
  }

  // ── GET THREAD INFO ──
  let threadName = "Private Chat";
  if (isGroup) {
    try {
      const threadInfo = await api.getThreadInfo(threadID);
      threadName = threadInfo.threadName || threadInfo.name || "Group Chat";
    } catch (e) {
      console.error("[callad] getThreadInfo error:", e?.message);
      threadName = "Group Chat";
    }
  }

  // ── SET REACTION ──
  try {
    api.setMessageReaction("📨", messageID, () => {}, true);
  } catch (_) {}

  // ── BUILD MESSAGE BODY ──
  const msgBody =
    `📨 CALL ADMIN — NEW MESSAGE\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 User     : ${senderName}\n` +
    `🆔 UID      : ${senderID}\n` +
    `💬 Source   : ${isGroup ? `Group Chat\n📌 Group    : ${threadName}\n🔢 Group ID : ${threadID}` : "Private Message"}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📝 Message  :\n${userMessage || "(No text — see attachment)"}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `💡 Reply to this message to respond to the user.`;

  // ── BUILD FORM ──
  const formSend = { body: msgBody };

  // Attach media if present
  const streams = await getAttachmentStreams(attachments || []);
  if (streams.length) formSend.attachment = streams;

  // ── SEND TO ALL ADMINS VIA PRIVATE MESSAGE ──
  const successIDs = [];
  const failedIDs  = [];

  for (const adminUID of ADMIN_UIDS) {
    try {
      // FIX 1: Send directly to adminUID (their personal inbox thread).
      // Do NOT use api.getThreadInfo on a UID — that's for group threads.
      // api.sendMessage(form, uid) sends a private/direct message when
      // uid is a user ID (not a thread ID).
      const sentMsg = await new Promise((resolve, reject) => {
        api.sendMessage(formSend, adminUID, (err, info) => {
          if (err) return reject(err);
          resolve(info);
        });
      });

      successIDs.push(adminUID);

      // Store reply handler keyed by the sent message ID
      global.calladReplyHandlers[sentMsg.messageID] = {
        type: "userCallAdmin",
        userThreadID: threadID,        // thread where user typed /callad
        userMessageID: messageID,      // original message ID from user
        userSenderID: senderID,        // user's UID
        userSenderName: senderName,    // user's name
        adminUID: adminUID             // which admin we sent to
      };

      console.log(`[callad] ✅ Sent to admin ${adminUID}, msgID: ${sentMsg.messageID}`);
    } catch (err) {
      console.error(`[callad] ❌ Failed to send to admin ${adminUID}:`, err?.message || err);
      failedIDs.push({ uid: adminUID, error: err?.message || "Unknown error" });
    }
  }

  // ── RESULT TO USER ──
  if (successIDs.length > 0) {
    return api.sendMessage(
      `✅ MESSAGE SENT!\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Your message has been sent to ${successIDs.length} admin(s).\n` +
      `Please wait for their response. 🙏`,
      threadID,
      messageID
    );
  }

  // All failed
  let failDetail = failedIDs.map(f => `• UID ${f.uid}: ${f.error}`).join("\n");
  return api.sendMessage(
    `❌ FAILED TO REACH ADMIN\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `Could not send your message to any admin.\n\n` +
    `💡 Possible reasons:\n` +
    `• Admin UID is incorrect\n` +
    `• Bot is not friends with the admin account\n` +
    `• Admin has blocked the bot\n\n` +
    `🔍 Details:\n${failDetail}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━`,
    threadID,
    messageID
  );
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 💬 HANDLE REPLY
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

module.exports.handleReply = async function ({ api, event }) {
  const { threadID, messageID, senderID, body, attachments, messageReply } = event;

  // Must be a reply
  if (!messageReply) return;

  const repliedMsgID = messageReply.messageID;
  const handler = global.calladReplyHandlers[repliedMsgID];
  if (!handler) return;

  const replyText = (body || "").trim();

  // Get replier's name
  let replierName = "Unknown";
  try {
    const info = await api.getUserInfo(senderID);
    replierName = info[senderID]?.name || "Unknown";
  } catch (_) {}

  // Get attachment streams if any
  const streams = await getAttachmentStreams(attachments || []);

  // ── ADMIN REPLYING TO USER ──────────────────────
  if (handler.type === "userCallAdmin") {
    const { userThreadID, userMessageID, userSenderID, userSenderName } = handler;

    const replyBody =
      `📨 ADMIN REPLY\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 From Admin : ${replierName}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `💬 Message    :\n${replyText || "(See attachment)"}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `💡 Reply to this message to respond back.`;

    const replyForm = { body: replyBody };
    if (streams.length) replyForm.attachment = streams;

    // FIX 2: Send back to the user's thread (group or private)
    // using userThreadID — which is the correct thread/inbox
    api.sendMessage(replyForm, userThreadID, (err, info) => {
      if (err) {
        console.error("[callad] ❌ Admin reply to user failed:", err?.message);
        return api.sendMessage(
          `❌ Failed to send reply to user.\n` +
          `Error: ${err?.message || "Unknown error"}`,
          threadID,
          messageID
        );
      }

      // Confirm to admin
      api.sendMessage(
        `✅ Reply sent to ${userSenderName} successfully!`,
        threadID,
        messageID
      );

      // FIX 3: Re-register handler on the NEW sent message ID
      // so the user can reply back and it chains correctly
      global.calladReplyHandlers[info.messageID] = {
        type: "adminReply",
        adminThreadID: threadID,      // admin's inbox thread
        adminMsgID: messageID,
        adminUID: senderID,
        adminName: replierName,
        userSenderID: userSenderID,
        userSenderName: userSenderName,
        userThreadID: userThreadID
      };

      console.log(`[callad] ✅ Admin reply delivered. New handlerID: ${info.messageID}`);
    });
  }

  // ── USER REPLYING BACK TO ADMIN ─────────────────
  else if (handler.type === "adminReply") {
    const { adminThreadID, adminUID, adminName, userSenderID, userSenderName, userThreadID } = handler;

    // Get source thread name if group
    let sourceInfo = "Private Message";
    try {
      const tInfo = await api.getThreadInfo(threadID);
      if (tInfo && tInfo.threadName) {
        sourceInfo = `Group: ${tInfo.threadName} (${threadID})`;
      }
    } catch (_) {}

    const replyBody =
      `📨 USER REPLY\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 User   : ${userSenderName || replierName}\n` +
      `🆔 UID    : ${userSenderID || senderID}\n` +
      `💬 Source : ${sourceInfo}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `💬 Message:\n${replyText || "(See attachment)"}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `💡 Reply to continue the conversation.`;

    const replyForm = { body: replyBody };
    if (streams.length) replyForm.attachment = streams;

    // FIX 4: Send back to admin's thread (their private inbox)
    api.sendMessage(replyForm, adminThreadID, (err, info) => {
      if (err) {
        console.error("[callad] ❌ User reply to admin failed:", err?.message);
        return api.sendMessage(
          `❌ Failed to send reply to admin.\n` +
          `Error: ${err?.message || "Unknown error"}`,
          threadID,
          messageID
        );
      }

      // Confirm to user
      api.sendMessage(
        `✅ Reply sent to admin successfully!`,
        threadID,
        messageID
      );

      // Re-register handler so admin can keep replying
      global.calladReplyHandlers[info.messageID] = {
        type: "userCallAdmin",
        userThreadID: userThreadID || threadID,
        userMessageID: messageID,
        userSenderID: userSenderID || senderID,
        userSenderName: userSenderName || replierName,
        adminUID: adminUID
      };

      console.log(`[callad] ✅ User reply delivered to admin. New handlerID: ${info.messageID}`);
    });
  }
};
