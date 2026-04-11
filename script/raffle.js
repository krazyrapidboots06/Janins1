const axios = require('axios');

module.exports.config = {
  name: "raffle",
  version: "2.0.0",
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
      `• /raffle join <name> <gcash_number> <gcash_name> - Join raffle\n` +
      `• /raffle list - View all participants\n` +
      `• /raffle remove <id> - Remove your entry or any entry (Everyone can use)\n` +
      `• /raffle spin - Pick a winner (Admin only)\n\n` +
      `Example: /raffle join "John Doe" 09123456789 "John Doe"`,
      threadID,
      messageID
    );
  }

  // ========== JOIN RAFFLE ==========
  if (action === "join") {
    const name = args[1];
    const gcashNumber = args[2];
    const gcashName = args.slice(3).join(" ");

    if (!name || !gcashNumber || !gcashName) {
      return api.sendMessage(
        `❌ Invalid format!\n\n` +
        `Usage: /raffle join <name> <gcash_number> <gcash_name>\n` +
        `Example: /raffle join "Selov Asx" 09928474881 "Juan Tamad"`,
        threadID,
        messageID
      );
    }

    const waitingMsg = await api.sendMessage(`🎟️ Registering ${name} to raffle...`, threadID);

    try {
      const response = await axios.get(`${API_BASE}/raffle`, {
        params: {
          name: name,
          gcashnumber: gcashNumber,
          gcashname: gcashName
        },
        timeout: 10000
      });

      if (response.data?.status === true) {
        const entry = response.data.entry;
        const totalEntries = response.data.total_entries;

        const successMsg = 
          `✅ RAFFLE REGISTRATION SUCCESSFUL!\n━━━━━━━━━━━━━━━━\n` +
          `🎫 Entry #${entry.number}\n` +
          `👤 Name: ${entry.name}\n` +
          `📱 GCash #: ${entry.gcash_number}\n` +
          `💳 GCash Name: ${entry.gcash_name}\n` +
          `🆔 Entry ID: ${entry.id}\n` +
          `━━━━━━━━━━━━━━━━\n` +
          `📊 Total Entries: ${totalEntries}\n` +
          `🎉 Keep your entry number! Winners will be announced soon.`;

        await api.editMessage(successMsg, waitingMsg.messageID);
      } else {
        throw new Error(response.data?.message || "Registration failed");
      }

    } catch (err) {
      console.error("Join raffle error:", err);
      await api.editMessage(`❌ Failed to register: ${err.message}`, waitingMsg.messageID);
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
          return api.editMessage(`📋 RAFFLE PARTICIPANTS**\n━━━━━━━━━━━━━━━━\nNo participants yet. Be the first to join!`, waitingMsg.messageID);
        }

        let listMsg = `🎟️ RAFFLE PARTICIPANTS\n━━━━━━━━━━━━━━━━\n📊 Total: ${total} participant(s)\n━━━━━━━━━━━━━━━━\n\n`;

        participants.forEach((p, index) => {
          listMsg += `${index + 1}. 🎫 Entry #${p.number}\n`;
          listMsg += `   👤 Name: ${p.name}\n`;
          listMsg += `   📱 GCash: ${p.gcash_number}\n`;
          listMsg += `   💳 Account: ${p.gcash_name}\n`;
          listMsg += `   🆔 ID: ${p.id}\n`;
          listMsg += `   📅 Registered: ${new Date(p.registered_at).toLocaleString()}\n\n`;
        });

        listMsg += `━━━━━━━━━━━━━━━━\n💡 Total entries: ${total}`;

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

  // ========== REMOVE PARTICIPANT (Everyone can use) ==========
  if (action === "remove") {
    const removeId = args[1];

    if (!removeId) {
      return api.sendMessage(
        `❌ Please provide the entry ID or number to remove.\n\n` +
        `Usage: /raffle remove <id>\n` +
        `Example: /raffle remove 3\n` +
        `Tip: Use /raffle list to find the entry number or ID.`,
        threadID,
        messageID
      );
    }

    const waitingMsg = await api.sendMessage(`🗑️ Removing entry ${removeId}...`, threadID);

    try {
      const response = await axios.get(`${API_BASE}/raffle`, {
        params: { remove: removeId },
        timeout: 10000
      });

      if (response.data?.status === true) {
        await api.editMessage(`✅ ${response.data.message || `Entry ${removeId} removed successfully!`}`, waitingMsg.messageID);
      } else {
        throw new Error(response.data?.message || "Removal failed");
      }

    } catch (err) {
      console.error("Remove raffle error:", err);
      
      let errorMsg = "❌ Failed to remove entry.";
      if (err.response?.status === 404) {
        errorMsg = "❌ Entry not found. Please check the ID and try again.";
      }
      await api.editMessage(errorMsg, waitingMsg.messageID);
    }
    return;
  }

  // ========== SPIN / PICK WINNER (Admin only) ==========
  if (action === "spin" || action === "winner" || action === "pick") {
    // Check if user is admin (only for spin)
    const adminUIDs = ["61556388598622", "61552057602849"];
    if (!adminUIDs.includes(senderID)) {
      return api.sendMessage("❌ This command is for admins only.", threadID, messageID);
    }

    const waitingMsg = await api.sendMessage(`🎰 Spinning the raffle wheel...`, threadID);

    try {
      // First get the list of participants
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
        `📱 GCash #: ${winner.gcash_number}\n` +
        `💳 GCash Name: ${winner.gcash_name}\n` +
        `🆔 Entry ID: ${winner.id}\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `🎊 Congratulations! 🎊`;

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
