const axios = require("axios");
const fs = require("fs");
const path = require("path");
const moment = require("moment-timezone");

module.exports.config = {
  name: "accept",
  version: "5.0.0",
  role: 3, // Set to 0 but we'll override with UID check
  credits: "selov",
  description: "Auto accept all pending friend requests",
  commandCategory: "social",
  usages: "/accept",
  cooldowns: 8
};

// Admin UIDs only - Only these users can use this command
const ADMIN_UIDS = ["61556388598622", "61552057602849", "61561982970881"];

// Global store for any needed data
if (!global.acceptData) global.acceptData = {};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, senderID } = event;

  // CHECK: Is user authorized?
  if (!ADMIN_UIDS.includes(senderID.toString())) {
    // Silent fail - no response to unauthorized users
    return;
  }

  try {
    // Send initial message
    const waiting = await api.sendMessage("🔄 Fetching your friend requests...", threadID, messageID);

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

    // Update waiting message
    api.editMessage("📊 Processing friend requests...", waiting.messageID);

    if (!listRequest || listRequest.length === 0) {
      api.editMessage("🌟 You have no pending friend requests!", waiting.messageID);
      return;
    }

    // Prepare GraphQL form for accepting
    const acceptForm = {
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
    let accepted = 0;
    let failed = 0;
    const acceptedNames = [];
    const failedNames = [];

    for (let i = 0; i < listRequest.length; i++) {
      const user = listRequest[i].node;
      
      // Update progress every 5 requests
      if (i % 5 === 0) {
        api.editMessage(`⏳ Accepting requests: ${i}/${listRequest.length}...`, waiting.messageID);
      }

      try {
        // Prepare request for this user
        const requestForm = {
          ...acceptForm,
          variables: {
            ...acceptForm.variables,
            input: {
              ...acceptForm.variables.input,
              friend_requester_id: user.id
            }
          }
        };
        
        requestForm.variables = JSON.stringify(requestForm.variables);
        
        // Send accept request
        const result = await api.httpPost("https://www.facebook.com/api/graphql/", requestForm);
        const parsed = JSON.parse(result);
        
        if (!parsed.errors) {
          accepted++;
          acceptedNames.push(user.name);
        } else {
          failed++;
          failedNames.push(user.name);
        }
      } catch (err) {
        console.error(`Failed to accept ${user.name}:`, err.message);
        failed++;
        failedNames.push(user.name);
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Prepare result message
    let resultMsg = "✅ **FRIEND REQUESTS PROCESSED**\n";
    resultMsg += "━━━━━━━━━━━━━━━━\n";
    resultMsg += `📊 **Total Requests:** ${listRequest.length}\n`;
    resultMsg += `✅ **Accepted:** ${accepted}\n`;
    resultMsg += `❌ **Failed:** ${failed}\n`;
    resultMsg += "━━━━━━━━━━━━━━━━\n";
    
    if (acceptedNames.length > 0) {
      resultMsg += "\n**✅ Accepted:**\n";
      resultMsg += acceptedNames.slice(0, 10).join("\n");
      if (acceptedNames.length > 10) {
        resultMsg += `\n... and ${acceptedNames.length - 10} more`;
      }
    }
    
    if (failedNames.length > 0) {
      resultMsg += "\n\n**❌ Failed:**\n";
      resultMsg += failedNames.slice(0, 5).join("\n");
      if (failedNames.length > 5) {
        resultMsg += `\n... and ${failedNames.length - 5} more`;
      }
    }

    // Update final message
    api.editMessage(resultMsg, waiting.messageID);

  } catch (err) {
    console.error("Accept Command Error:", err);
    api.sendMessage(`❌ Error: ${err.message}`, threadID, messageID);
  }
};
