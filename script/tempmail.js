const axios = require("axios");

const DOMAIN = "@timpmeyl.indevs.in";
const API_BASE_URL = "https://temporary-emaill.netlify.app/api/messages";

module.exports.config = {
  name: "tempmail",
  version: "1.0.6", // Updated version for fix
  hasPermssion: 0,
  credits: "selov",
  description: "Generate temporary email addresses and check their inboxes.",
  commandCategory: "utility",
  usages: "tempmail [inbox <email_address>]",
  cooldowns: 5
};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID } = event;
  const subCommand = args[0]?.toLowerCase();

  if (!subCommand) {
    // Generate a new temporary email address
    const randomString = Math.random().toString(36).substring(2, 15); // Generate a random string
    const newEmail = `${randomString}${DOMAIN}`;

    api.sendMessage(
      `📧 Temporary Email Generated:\n━━━━━━━━━━━━━━━━\nYour new temporary email address is: \n${newEmail}\n\nTo check its inbox, use: \ntempmail inbox ${newEmail}\n\nThis email is valid for a short period.`, 
      threadID,
      messageID
    );
  } else if (subCommand === "inbox") {
    const emailAddress = args[1];

    if (!emailAddress) {
      return api.sendMessage(
        "📌 Usage: tempmail inbox <email_address>\nExample: tempmail inbox example@timpmeyl.indevs.in",
        threadID,
        messageID
      );
    }

    if (!emailAddress.endsWith(DOMAIN)) {
      return api.sendMessage(
        `❌ Invalid email domain. Please use an email ending with ${DOMAIN}.`, 
        threadID,
        messageID
      );
    }

    // 1. Send the "Checking..." message first and wait for it to be sent
    api.sendMessage(`⏳ Checking inbox for ${emailAddress}...`, threadID, async (err, info) => {
      if (err) {
        console.error("Error sending checking message:", err);
        return; // Stop if we can't even send the initial message
      }

      try {
        // 2. Fetch the inbox data AFTER the "Checking..." message is sent
        const response = await axios.get(`${API_BASE_URL}?address=${encodeURIComponent(emailAddress)}`);
        const messages = response.data;

        // 3. Evaluate the response and send the final result
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
          return api.sendMessage(`📥 Inbox for ${emailAddress} is empty.`, threadID, messageID);
        }

        let inboxContent = `📥 Inbox for ${emailAddress}:\n━━━━━━━━━━━━━━━━\n`;
        messages.forEach((msg, index) => {
          inboxContent += `${index + 1}. From: ${msg.from || "Unknown"}\n`;
          inboxContent += `Subject: ${msg.subject || "(No Subject)"}\n`;
          inboxContent += `Date: ${msg.date ? new Date(msg.date).toLocaleString() : "Unknown"}\n`;
          inboxContent += `Body: ${msg.body ? msg.body.substring(0, 200) : "(No Content)"}...\n`; // Truncate long bodies
          inboxContent += `------------------------\n`;
        });

        api.sendMessage(inboxContent, threadID, messageID);

      } catch (error) {
        console.error("Error fetching tempmail inbox:", error);
        api.sendMessage(
          `❌ Failed to fetch inbox for ${emailAddress}. Please try again later.`, 
          threadID,
          messageID
        );
      }
    }, messageID); // Reply to the user's command
  } else {
    api.sendMessage(
      "📌 Usage:\n• tempmail (to generate a new email)\n• tempmail inbox <email_address> (to check inbox)",
      threadID,
      messageID
    );
  }
};
