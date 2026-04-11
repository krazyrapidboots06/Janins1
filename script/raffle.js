const axios = require('axios');

module.exports.config = {
  name: "raffle",
  version: "5.0.0",
  role: 0,
  credits: "selov",
  description: "Join or manage raffle entries",
  commandCategory: "game",
  usages: "/raffle [join|list|spin|winners|reset]",
  cooldowns: 5,
  aliases: ["rafflejoin", "rafflelist"]
};

const API_BASE = "https://restapijay.onrender.com/api/spin";
const API_KEY = "selovasx2024";

// Admin UIDs (only these can use spin, winners, reset)
const ADMIN_UIDS = ["61556388598622", "61552057602849", "61586888576397"];

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, senderID } = event;
  const action = args[0]?.toLowerCase();

  // HELP - No arguments
  if (!action) {
    return api.sendMessage(
      `🎟️ RAFFLE COMMANDS**\n━━━━━━━━━━━━━━━━\n` +
      `• /raffle join <name> | <gcash_number> | <gcash_name> - Join raffle\n` +
      `• /raffle list - View all participants\n` +
      `• /raffle spin - Pick a random winner (Admin only)\n` +
      `• /raffle winners - View all winners (Admin only)\n` +
      `• /raffle reset - Reset raffle (Admin only)\n\n` +
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
    
    // Validate GCash number (11 digits starting with 09)
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
      const response = await axios.get(`${API_BASE}?action=join`, {
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
        const totalEntries = response.data.total_entries || response.data.total_participants;

        const successMsg = 
          `✅ RAFFLE REGISTRATION SUCCESSFUL!\n━━━━━━━━━━━━━━━━\n` +
          `🎫 Entry #${entry?.number || totalEntries}\n` +
          `👤 Name: ${name}\n` +
          `📱 GCash #: ${gcashNumber}\n` +
          `💳 GCash Name: ${gcashName}\n` +
          `━━━━━━━━━━━━━━━━\n` +
          `📊 Total Entries: ${totalEntries}\n` +
          `🎉 Good luck!`;


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
      const response = await axios.get(`${API_BASE}?action=list`, {
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
          listMsg += `${index + 1}. 🎫 **#${p.number || index + 1}**\n`;
          listMsg += `   👤 Name: ${p.name}\n`;
          listMsg += `   📱 GCash: ${p.gcash_number || p.gcashnumber}\n`;
          listMsg += `   💳 Account: ${p.gcash_name || p.gcashname}\n`;
          if (p.joined_at) {
            listMsg += `   📅 Joined: ${new Date(p.joined_at).toLocaleString()}\n`;
          }
          listMsg += `\n`;
        });

        listMsg += `━━━━━━━━━━━━━━━━\n🔒 GCash details are masked for privacy`;

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

  // ========== SPIN (Pick Winner) - Admin only ==========
  if (action === "spin") {
    // Check if user is admin
    if (!ADMIN_UIDS.includes(senderID)) {
      return api.sendMessage("❌ This command is for admins only.", threadID, messageID);
    }

    const waitingMsg = await api.sendMessage(`🎰 Spinning the raffle wheel...`, threadID);

    try {
      const response = await axios.get(`${API_BASE}?action=spin&apikey=${API_KEY}`, {
        timeout: 10000
      });

      if (response.data?.status === true) {
        const winner = response.data.winner || response.data.result;
        
        const winnerMsg = 
          `🎉 RAFFLE WINNER! 🎉\n━━━━━━━━━━━━━━━━\n` +
          `🎫 Entry #${winner?.number || '?'}\n` +
          `👤 Name: ${winner?.name || 'Unknown'}\n` +
          `📱 Gcash: ${winner?.gcash_number || winner?.gcashnumber || 'Hidden'}\n` +
          `💳 Account: ${winner?.gcash_name || winner?.gcashname || 'Hidden'}\n` +
          `━━━━━━━━━━━━━━━━\n` +
          `🎊 Congratulations! 🎊\n\n` +
          `📌 Winner will be contacted via GCash.`;

        await api.editMessage(winnerMsg, waitingMsg.messageID);
      } else {
        throw new Error(response.data?.message || "Spin failed");
      }

    } catch (err) {
      console.error("Spin raffle error:", err);
      
      let errorMsg = "❌ Failed to pick winner.";
      if (err.response?.data?.message) {
        errorMsg = `❌ ${err.response.data.message}`;
      }
      await api.editMessage(errorMsg, waitingMsg.messageID);
    }
    return;
  }

  // ========== WINNERS LIST - Admin only ==========
  if (action === "winners") {
    if (!ADMIN_UIDS.includes(senderID)) {
      return api.sendMessage("❌ This command is for admins only.", threadID, messageID);
    }

    const waitingMsg = await api.sendMessage(`📋 Fetching winners list...`, threadID);

    try {
      const response = await axios.get(`${API_BASE}?action=winners`, {
        timeout: 10000
      });

      if (response.data?.status === true) {
        const winners = response.data.winners || response.data.results || [];
        const total = winners.length;

        if (total === 0) {
          return api.editMessage(`🏆 WINNERS LIST\n━━━━━━━━━━━━━━━━\nNo winners yet. Use /raffle spin to pick winners!`, waitingMsg.messageID);
        }

        let winnersMsg = `🏆 **WINNERS LIST**\n━━━━━━━━━━━━━━━━\n📊 **Total Winners: ${total}\n━━━━━━━━━━━━━━━━\n\n`;

        winners.forEach((winner, index) => {
          winnersMsg += `${index + 1}. 🎫 #${winner.number || index + 1}\n`;
          winnersMsg += `   👤 Name: ${winner.name}\n`;
          winnersMsg += `   📱 GCash: ${winner.gcash_number || winner.gcashnumber}\n`;
          winnersMsg += `   💳 Account: ${winner.gcash_name || winner.gcashname}\n`;
          if (winner.won_at) {
            winnersMsg += `   🏆 Won: ${new Date(winner.won_at).toLocaleString()}\n`;
          }
          winnersMsg += `\n`;
        });

        await api.editMessage(winnersMsg, waitingMsg.messageID);
      } else {
        throw new Error(response.data?.message || "Failed to fetch winners");
      }

    } catch (err) {
      console.error("Winners raffle error:", err);
      await api.editMessage(`❌ Failed to fetch winners: ${err.message}`, waitingMsg.messageID);
    }
    return;
  }

  // ========== RESET RAFFLE - Admin only ==========
  if (action === "reset") {
    if (!ADMIN_UIDS.includes(senderID)) {
      return api.sendMessage("❌ This command is for admins only.", threadID, messageID);
    }

    const waitingMsg = await api.sendMessage(`🔄 Resetting raffle...`, threadID);

    try {
      const response = await axios.get(`${API_BASE}?action=reset&reset=true&apikey=${API_KEY}`, {
        timeout: 10000
      });

      if (response.data?.status === true) {
        await api.editMessage(`✅ RAFFLE RESET SUCCESSFUL!\n━━━━━━━━━━━━━━━━\n${response.data.message || 'All entries have been cleared.'}\n\n🎟️ New raffle session started!`, waitingMsg.messageID);
      } else {
        throw new Error(response.data?.message || "Reset failed");
      }

    } catch (err) {
      console.error("Reset raffle error:", err);
      await api.editMessage(`❌ Failed to reset raffle: ${err.message}`, waitingMsg.messageID);
    }
    return;
  }

  // Invalid action
  return api.sendMessage(
    `❌ Invalid command.\n\n` +
    `Available: /raffle join, /raffle list, /raffle spin, /raffle winners, /raffle reset`,
    threadID,
    messageID
  );
};
