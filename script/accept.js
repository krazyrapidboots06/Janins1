const axios = require("axios");
const fs = require("fs");
const path = require("path");
const moment = require("moment-timezone");

module.exports.config = {
  name: "accept",
  version: "2.0.0",
  role: 1, // Everyone can use (but only for their own requests)
  credits: "selov",
  description: "Manage friend requests",
  commandCategory: "social",
  usages: "/accept - Show pending friend requests",
  cooldowns: 8
};

// Store reply handlers
const replyHandlers = {};

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
    let msg = "╔═══《 **FRIEND REQUESTS** 》═══╗\n\n";
    
    listRequest.forEach((user, index) => {
      msg += `💠 **No. ${index + 1}**\n`;
      msg += `👤 **Name:** ${user.node.name}\n`;
      msg += `🆔 **ID:** ${user.node.id}\n`;
      msg += `🔗 **Profile:** ${user.node.url.replace("www.facebook", "fb")}\n`;
      msg += "━━━━━━━━━━━━━━━━\n";
    });

    msg += "\n💡 **Reply with:**\n";
    msg += "✅ **add <number>** — Accept request\n";
    msg += "❌ **del <number>** — Reject request\n";
    msg += "💫 **add all** — Accept all\n";
    msg += "🔥 **del all** — Reject all\n\n";
    msg += "⏳ This menu will auto-delete in 2 minutes.\n";
    msg += "╚═══════════════════╝";

    // Send the message and store for reply handling
    api.sendMessage(msg, threadID, (err, info) => {
      if (err) return console.error("Send error:", err);
      
      // Store in replyHandlers
      replyHandlers[info.messageID] = {
        commandName: "accept",
        messageID: info.messageID,
        listRequest: listRequest,
        author: senderID,
        unsendTimeout: setTimeout(() => {
          api.unsendMessage(info.messageID);
          delete replyHandlers[info.messageID];
        }, 2 * 60 * 1000)
      };
    }, messageID);

  } catch (err) {
    console.error("Accept Command Error:", err);
    api.sendMessage(`❌ Error: ${err.message}`, threadID, messageID);
  }
};

// Handle replies to process accept/reject
module.exports.handleReply = async function ({ api, event, handleReply }) {
  const { threadID, messageID, senderID, body } = event;

  // Check if user is the one who requested
  if (senderID !== handleReply.author) {
    return api.sendMessage("❌ You cannot reply to someone else's friend request list.", threadID, messageID);
  }

  const args = body.trim().toLowerCase().split(/\s+/);
  const { listRequest, messageID: replyMessageID } = handleReply;

  // Clear the auto-delete timeout
  clearTimeout(handleReply.unsendTimeout);

  // Prepare GraphQL form
  const form = {
    av: api.getCurrentUserID(),
    fb_api_caller_class: "RelayModern",
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

  // Determine action type
  let actionType;
  if (args[0] === "add") {
    form.fb_api_req_friendly_name = "FriendingCometFriendRequestConfirmMutation";
    form.doc_id = "3147613905362928";
    actionType = "Accepted";
  } else if (args[0] === "del") {
    form.fb_api_req_friendly_name = "FriendingCometFriendRequestDeleteMutation";
    form.doc_id = "4108254489275063";
    actionType = "Rejected";
  } else {
    api.unsendMessage(replyMessageID);
    return api.sendMessage("❌ Invalid command. Use: add <number> or del <number>", threadID, messageID);
  }

  // Determine target request numbers
  let targetNumbers = args.slice(1);
  if (args[1] === "all") {
    targetNumbers = Array.from({ length: listRequest.length }, (_, i) => (i + 1).toString());
  }

  const targetRequests = [];
  const promises = [];

  const success = [];
  const failed = [];

  // Process each target number
  for (const num of targetNumbers) {
    const index = parseInt(num) - 1;
    const user = listRequest[index];
    
    if (!user) {
      failed.push(`🚫 Cannot find request #${num}`);
      continue;
    }

    form.variables.input.friend_requester_id = user.node.id;
    form.variables = JSON.stringify(form.variables);
    
    targetRequests.push(user);
    promises.push(api.httpPost("https://www.facebook.com/api/graphql/", form));
    
    form.variables = JSON.parse(form.variables);
  }

  // Execute all requests
  const results = await Promise.allSettled(promises);

  results.forEach((result, index) => {
    const user = targetRequests[index];
    if (result.status === "fulfilled" && !JSON.parse(result.value).errors) {
      success.push(`✅ **Successfully ${actionType}:** ${user.node.name} (${user.node.id})`);
    } else {
      failed.push(`❌ **Failed:** ${user.node.name} (${user.node.id})`);
    }
  });

  // Prepare response message
  let replyMsg = "";
  if (success.length > 0) replyMsg += success.join("\n") + "\n";
  if (failed.length > 0) replyMsg += failed.join("\n");

  // Send results
  if (replyMsg) {
    api.sendMessage(replyMsg, threadID, messageID);
  } else {
    api.sendMessage("❌ No valid requests were processed.", threadID, messageID);
  }

  // Delete the original request list
  api.unsendMessage(replyMessageID);
  delete replyHandlers[replyMessageID];
};
