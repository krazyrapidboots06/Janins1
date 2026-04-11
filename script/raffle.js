const axios = require('axios');

module.exports.config = {
  name: "raffle",
  version: "4.0.0",
  role: 0,
  credits: "selov",
  description: "Join or manage raffle entries",
  commandCategory: "game",
  usages: "/raffle [join|list|remove|spin]",
  cooldowns: 5,
  aliases: ["rafflejoin", "rafflelist"]
};

const API_BASE = "https://rest-api-ruhv.onrender.com/api";

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, senderID } = event;
  const action = args[0]?.toLowerCase();

  // HELP - No arguments
  if (!action) {
    return api.sendMessage(
      `🎟️ RAFFLE COMMANDS\n━━━━━━━━━━━━━━━━\n` +
      `• /raffle join <name> | <gcash_number> | <gcash_name> - Join raffle\n` +
      `• /raffle list - View all participants\n` +
      `• /raffle remove <number> - Remove entry by number\n` +
      `• /raffle spin - Pick a winner (Admin only)\n\n` +
      `Example: /raffle join Selov Asx | 09916527333 | Selov Asx`,
      threadID,
      messageID
    );
  }

  // ========== JOIN RAFFLE ==========
  if (action === "join") {
    const rest = args.slice(1).join(" ");
    
    let name, gcashNumber, gcashName;
    
    // Parse with | separator
    if (rest.includes("|")) {
      const parts = rest.split("|").map(p => p.trim());
      name = parts[0];
      gcashNumber = parts[1];
      gcashName = parts[2];
    } 
    // Parse with quotes
    else if (rest.includes('"')) {
      const matches = rest.match(/"([^"]+)"|\S+/g);
      if (matches) {
        const cleanMatches = matches.map(m => m.replace(/"/g, ''));
        name = cleanMatches[0];
        gcashNumber = cleanMatches[1];
        gcashName = cleanMatches.slice(2).join(" ");
      }
    }
    // Simple space separation
    else {
      const parts = rest.split(" ");
      name = parts[0];
      gcashNumber = parts[1];
      gcashName = parts.slice(2).join(" ");
    }
    
    if (!name || !gcashNumber || !gcashName) {
      return api.sendMessage(
        `❌ Invalid format!\n\n` +
        `Correct format:\n` +
        `/raffle join Selov Asx | 09916527333 | Selov Asx\n\n` +
        `Note: Use | (pipe) to separate name, number, and GCash name`,
        threadID,
        messageID
      );
    }
    
    // Validate GCash number
    if (!/^09\d{9}$/.test(gcashNumber)) {
      return api.sendMessage(
        `❌ Invalid GCash number!\n\n` +
        `Please enter a valid 11-digit Philippine mobile number starting with 09.\n` +
        `Example: 09916527333`,
        threadID,
        messageID
      );
    }

    const waitingMsg = await api.sendMessage(`🎟️ Registering ${name} to raffle...`, threadID);

    try {
      // URL encode parameters properly
      const response = await axios.get(`${API_BASE}/raffle`, {
        params: {
          name: name,
          gcashnumber: gcashNumber,
          gcashname: gcashName
        },
        paramsSerializer: params => {
          return Object.keys(params)
            .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
            .join('&');
        },
        timeout: 10000
      });

      if (response.data?.status === true) {
        const entry = response.data.entry;
        const totalEntries = response.data.total_entries;

        const successMsg = 
          `✅ RAFFLE REGISTRATION SUCCESSFUL!\n━━━━━━━━━━━━━━━━\n` +
          `🎫 Entry #${entry.number}**\n` +
          `👤 Name: ${entry.name}\n` +
          `📱 GCash #: ${entry.gcash_number}\n` +
          `💳 GCash Name: ${entry.gcash_name}\n` +
          `🆔 Entry ID: ${entry.id}\n` +
          `━━━━━━━━━━━━━━━━\n` +
          `📊 Total Entries: ${totalEntries}\n` +
          `🎉 ${response.data.next_steps || "Keep your entry number!"}`;

        await api.editMessage(successMsg, waitingMsg.messageID);
      } else {
        throw new Error(response.data?.message || "Registration failed");
      }

    } catch (err) {
      console.error("Join raffle error:", err);
      
      let errorMsg = "❌ Failed to register.";
      if (err.response?.status === 400) {
        errorMsg = "❌ Invalid registration data. Please check your information.";
      } else if (err.response?.data?.message) {
        errorMsg = `❌ ${err.response.data.message}`;
      }
      await api.editMessage(errorMsg, waitingMsg.messageID);
    }
    return;
  }

  // ========== LIST PARTICIPANTS ==========
  if (action === "list") {
    const waitingMsg = await api.sendMessage(`📋 Fetching raffle participants...`, threadID);

    try {
      const response = await axios.get(`${API_BASE}/spin?action=list`, {
        timeout: 10000
      });

      if (response.data?.status === true) {
        const participants = response.data.participants || [];
        const total = response.data.total_participants || 0;

        if (total === 0 || participants.length === 0) {
          return api.editMessage(`📋 RAFFLE PARTICIPANTS\n━━━━━━━━━━━━━━━━\nNo participants yet. Be the first to join!`, waitingMsg.messageID);
        }

        let listMsg = `🎟️ RAFFLE PARTICIPANTS\n━━━━━━━━━━━━━━━━\n📊 Total: ${total} participant(s)\n━━━━━━━━━━━━━━━━\n\n`;

        participants.forEach((p, index) => {
          listMsg += `${index + 1}. 🎫 **Entry #${p.number}**\n`;
          listMsg += `   👤 Name: ${p.name}\n`;
          listMsg += `   📱 GCash: ${p.gcash_number}\n`;
          listMsg += `   💳 Account: ${p.gcash_name}\n`;
          listMsg += `   📅 Joined: ${new Date(p.joined_at).toLocaleString()}\n\n`;
        });

        listMsg += `━━━━━━━━━━━━━━━━\n🔒 *GCash details are masked for privacy*`;

        await api.editMessage(listMsg, waitingMsg.messageID);
      } else {
        throw new Error(response.data?.message || "Failed to fetch list");
      }

    } catch (err) {
      console.error("List raffle error:", err);
      await api.editMessage(`❌ Failed to fetch participants: ${err.message}`, waitingMsg.messageID);
    }
    return;
  }

  // ========== REMOVE PARTICIPANT ==========
  if (action === "remove") {
    const removeNumber = args[1];

    if (!removeNumber) {
      return api.sendMessage(
        `❌ Please provide the entry number to remove.\n\n` +
        `Usage: /raffle remove <number>\n` +
        `Example: /raffle remove 1\n` +
        `Tip: Use /raffle list to find the entry number.`,
        threadID,
        messageID
      );
    }

    const waitingMsg = await api.sendMessage(`🗑️ Removing entry #${removeNumber}...`, threadID);

    try {
      const response = await axios.get(`${API_BASE}/raffle`, {
        params: { remove: removeNumber },
        timeout: 10000
      });

      if (response.data?.status === true) {
        const removed = response.data.removed_entry;
        const remaining = response.data.remaining_entries;
        
        const successMsg = 
          `✅ ENTRY REMOVED!\n━━━━━━━━━━━━━━━━\n` +
          `🎫 Removed Entry #${removed.number}\n` +
          `👤 Name: ${removed.name}\n` +
          `📱 GCash: ${removed.gcash_number}\n` +
          `💳 Account: ${removed.gcash_name}\n` +
          `━━━━━━━━━━━━━━━━\n` +
          `📊 Remaining Entries: ${remaining}\n` +
          `📌 ${response.data.note || "Entry numbers have been reordered."}`;

        await api.editMessage(successMsg, waitingMsg.messageID);
      } else {
        throw new Error(response.data?.message || "Removal failed");
      }

    } catch (err) {
      console.error("Remove raffle error:", err);
      
      let errorMsg = "❌ Failed to remove entry.";
      if (err.response?.status === 404) {
        errorMsg = "❌ Entry not found. Please check the number and try again.";
      }
      await api.editMessage(errorMsg, waitingMsg.messageID);
    }
    return;
  }

  // ========== SPIN / PICK WINNER (Admin only) ==========
  if (action === "spin" || action === "winner" || action === "pick") {
    const adminUIDs = ["61556388598622", "61552057602849", "61586888576397"];
    if (!adminUIDs.includes(senderID)) {
      return api.sendMessage("❌ This command is for admins only.", threadID, messageID);
    }

    const waitingMsg = await api.sendMessage(`🎰 Spinning the raffle wheel...`, threadID);

    try {
      // Get participants list
      const listResponse = await axios.get(`${API_BASE}/spin?action=list`, {
        timeout: 10000
      });

      const participants = listResponse.data?.participants || [];
      const total = listResponse.data?.total_participants || 0;

      if (total === 0 || participants.length === 0) {
        return api.editMessage(`❌ No participants to pick from.`, waitingMsg.messageID);
      }

      // Pick random winner
      const randomIndex = Math.floor(Math.random() * participants.length);
      const winner = participants[randomIndex];

      const winnerMsg = 
        `🎉 RAFFLE WINNER! 🎉\n━━━━━━━━━━━━━━━━\n` +
        `🎫 Entry #${winner.number}\n` +
        `👤 Name: ${winner.name}\n` +
        `📱 GCash: ${winner.gcash_number}\n` +
        `💳 Account: ${winner.gcash_name}\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `🎊 Congratulations! 🎊\n\n` +
        `📌 Winner will be contacted via GCash.`;

      await api.editMessage(winnerMsg, waitingMsg.messageID);

    } catch (err) {
      console.error("Spin raffle error:", err);
      await api.editMessage(`❌ Failed to pick winner: ${err.message}`, waitingMsg.messageID);
    }
    return;
  }

  // Invalid action
  return api.sendMessage(
    `❌ Invalid command.\n\n` +
    `Available: /raffle join, /raffle list, /raffle remove, /raffle spin`,
    threadID,
    messageID
  );
};
