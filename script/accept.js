const axios = require("axios");
const fs = require("fs");
const path = require("path");
const moment = require("moment-timezone");

module.exports.config = {
  name: "accept",
  version: "3.0.0",
  role: 2,
  credits: "selov",
  description: "Accept all pending friend requests",
  commandCategory: "social",
  usages: "/accept - Show pending friend requests, then reply with 'add all'",
  cooldowns: 8
};

// Global store for reply handlers
if (!global.acceptReplyHandlers) global.acceptReplyHandlers = {};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, senderID } = event;

  try {
    // Fetch friend requests from Facebook
    const form = {
      av: api.getCurrentUserID(),
      fb_api_req_friendly_name: "FriendingCometFriendRequestsRootQueryRelayPreloader",
      fb_api_caller_class: "RelayModern",
      doc_id: "4499164963466303",
      variables: JSON.stringify({ input: { scale: 3 } })
    };

    const response = await api.httpPost("https://www.facebook.com/api/graphql/", form);
    const listRequest = JSON.parse(response).data.viewer.friending_possibilities.edges;

    if (!listRequest || listRequest.length === 0) {
      return api.sendMessage("🌟 You have no pending friend requests!", threadID, messageID);
    }

    // Format the list of requests
    let msg = "╔═══《 **PENDING FRIEND REQUESTS** 》═══╗\n\n";
    
    listRequest.forEach((user, index) => {
      msg += `💠 **No. ${index + 1}**\n`;
      msg += `👤 **Name:** ${user.node.name}\n`;
      msg += `🆔 **ID:** ${user.node.id}\n`;
      msg += `🔗 **Profile:** ${user.node.url.replace("www.facebook", "fb")}\n`;
      msg += "━━━━━━━━━━━━━━━━\n";
    });

    msg += `\n📊 **Total Requests:** ${listRequest.length}\n`;
    msg += "━━━━━━━━━━━━━━━━\n";
    msg += "💡 **Reply with:** `add all` to accept ALL requests\n\n";
    msg += "⏳ This menu will auto-delete in 2 minutes.\n";
    msg += "╚═══════════════════╝";

    // Send the message and store for reply handling
    api.sendMessage(msg, threadID, (err, info) => {
      if (err) return console.error("Send error:", err);
      
      // Store in global reply handlers
      global.acceptReplyHandlers[info.messageID] = {
        commandName: "accept",
        messageID: info.messageID,
        listRequest: listRequest,
        author: senderID,
        threadID: threadID,
        unsendTimeout: setTimeout(() => {
          api.unsendMessage(info.messageID);
          delete global.acceptReplyHandlers[info.messageID];
        }, 2 * 60 * 1000)
      };
    });

  } catch (err) {
    console.error("Accept Command Error:", err);
    api.sendMessage(`❌ Error: ${err.message}`, threadID, messageID);
  }
};

// Handle replies to accept all requests
module.exports.handleReply = async function ({ api, event }) {
  const { threadID, messageID, senderID, type, messageReply, body } = event;

  // CHECK 1: Is this a reply to a message?
  if (type !== "message_reply") {
    return api.sendMessage(
      "❌ Please reply to the bot message with 'add all'.",
      threadID,
      messageID
    );
  }

  // CHECK 2: Does the replied message exist in our handlers?
  const repliedMessageID = messageReply.messageID;
  const handlerData = global.acceptReplyHandlers[repliedMessageID];

  if (!handlerData) {
    return api.sendMessage(
      "❌ This friend request list has expired. Please use /accept again.",
      threadID,
      messageID
    );
  }

  // CHECK 3: Is the replier the same person who requested?
  if (senderID !== handlerData.author) {
    return api.sendMessage(
      "❌ You cannot reply to someone else's friend request list.",
      threadID,
      messageID
    );
  }

  // Clear the auto-delete timeout
  clearTimeout(handlerData.unsendTimeout);

  const replyText = body.trim().toLowerCase();
  const { listRequest, messageID: replyMessageID } = handlerData;

  // CHECK 4: Is the reply exactly "add all"?
  if (replyText !== "add all") {
    api.sendMessage(
      "❌ Invalid reply. Please reply with exactly: `add all`",
      threadID,
      messageID
    );
    return;
  }

  // No requests to process?
  if (listRequest.length === 0) {
    api.unsendMessage(replyMessageID);
    delete global.acceptReplyHandlers[repliedMessageID];
    return api.sendMessage(
      "❌ No friend requests to accept.",
      threadID,
      messageID
    );
  }

  // Send processing message
  const processingMsg = await api.sendMessage(
    `⏳ Accepting ${listRequest.length} friend request(s)... Please wait.`,
    threadID
  );

  // Prepare GraphQL form
  const form = {
    av: api.getCurrentUserID(),
    fb_api_caller_class: "RelayModern",
    fb_api_req_friendly_name: "FriendingCometFriendRequestConfirmMutation",
    doc_id: "3147613905362928",
    variables: {
      input: {
        source: "friends_tab",
        actor_id: api.getCurrentUserID(),
        client_mutation_id: Math.round(Math.random() * 19).toString()
      },
      scale: 3,
      refresh_num: 0
    }
  };

  // Process all requests
  const promises = [];
  const success = [];
  const failed = [];

  for (const user of listRequest) {
    // Prepare the request for each user
    const requestForm = {
      ...form,
      variables: {
        ...form.variables,
        input: {
          ...form.variables.input,
          friend_requester_id: user.node.id
        }
      }
    };
    
    requestForm.variables = JSON.stringify(requestForm.variables);
    promises.push(api.httpPost("https://www.facebook.com/api/graphql/", requestForm));
  }

  // Execute all requests
  const results = await Promise.allSettled(promises);

  results.forEach((result, index) => {
    const user = listRequest[index];
    if (result.status === "fulfilled") {
      try {
        const parsed = JSON.parse(result.value);
        if (!parsed.errors) {
          success.push(`✅ ${user.node.name}`);
        } else {
          failed.push(`❌ ${user.node.name} - API Error`);
        }
      } catch (e) {
        failed.push(`❌ ${user.node.name} - Invalid response`);
      }
    } else {
      failed.push(`❌ ${user.node.name} - ${result.reason?.message || 'Unknown error'}`);
    }
  });

  // Prepare response message
  let replyMsg = "**FRIEND REQUESTS RESULT**\n";
  replyMsg += "━━━━━━━━━━━━━━━━\n";
  replyMsg += `✅ **Accepted:** ${success.length}/${listRequest.length}\n`;
  replyMsg += `❌ **Failed:** ${failed.length}/${listRequest.length}\n`;
  replyMsg += "━━━━━━━━━━━━━━━━\n\n";
  
  if (success.length > 0) {
    replyMsg += "**✅ Accepted:**\n" + success.join("\n") + "\n\n";
  }
  
  if (failed.length > 0) {
    replyMsg += "**❌ Failed:**\n" + failed.join("\n");
  }

  // Delete processing message
  api.unsendMessage(processingMsg.messageID);

  // Send results
  api.sendMessage(replyMsg, threadID, messageID);

  // Delete the original request list
  api.unsendMessage(replyMessageID);
  delete global.acceptReplyHandlers[repliedMessageID];
};
