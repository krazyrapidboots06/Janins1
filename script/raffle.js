const axios = require('axios');

module.exports.config = {
  name: "raffle",
  version: "7.0.0",
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

// Admin UIDs
const ADMIN_UIDS = ["61556388598622", "61552057602849", "61586888576397"];

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, senderID } = event;
  const action = args[0]?.toLowerCase();

  // HELP
  if (!action) {
    return api.sendMessage(
      `🎟️ **RAFFLE COMMANDS**\n━━━━━━━━━━━━━━━━\n` +
      `• /raffle join <name> | <gcash_number> | <gcash_name> - Join raffle\n` +
      `• /raffle list - View all participants\n` +
      `• /raffle spin - Pick a random winner (Admin only)\n` +
      `• /raffle winners - View all winners (Admin only)\n` +
      `• /raffle reset - Reset raffle (Admin only)\n\n` +
      `**Example:** /raffle join Selov Asx | 09916527333 | Selov asx`,
      threadID,
      messageID
    );
  }

  // ========== JOIN RAFFLE ==========
  if (action === "join") {
    const rest = args.slice(1).join(" ");
    
    let name, gcashNumber, gcashName;
    
    if (rest.includes("|")) {
      const parts = rest.split("|").map(p => p.trim());
      name = parts[0];
      gcashNumber = parts[1];
      gcashName = parts[2];
    } else if (rest.includes('"')) {
      const matches = rest.match(/"([^"]+)"|\S+/g);
      if (matches) {
        const cleanMatches = matches.map(m => m.replace(/"/g, ''));
        name = cleanMatches[0];
        gcashNumber = cleanMatches[1];
        gcashName = cleanMatches.slice(2).join(" ");
      }
    } else {
      const parts = rest.split(" ");
      name = parts[0];
      gcashNumber = parts[1];
      gcashName = parts.slice(2).join(" ");
    }
    
    if (!name || !gcashNumber || !gcashName) {
      return api.sendMessage(
        `❌ **Invalid format!**\n\n` +
        `**Correct format:**\n` +
        `/raffle join Selov Asx | 09916527333 | Selov Asx`,
        threadID,
        messageID
      );
    }
    
    if (!/^09\d{9}$/.test(gcashNumber)) {
      return api.sendMessage(
        `❌ **Invalid GCash number!**\n\n` +
        `Please enter a valid 11-digit Philippine mobile number starting with 09.\n` +
        `Example: 09916527333`,
        threadID,
        messageID
      );
    }

    const waitingMsg = await api.sendMessage(`🎟️ Registering ${name} to raffle...`, threadID);

    try {
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
        const successMsg = 
          `✅ **RAFFLE REGISTRATION SUCCESSFUL!**\n━━━━━━━━━━━━━━━━\n` +
          `👤 **Name:** ${name}\n` +
          `📱 **GCash #:** ${gcashNumber}\n` +
          `💳 **GCash Name:** ${gcashName}\n` +
          `━━━━━━━━━━━━━━━━\n` +
          `🎉 Good luck!`;

        await api.editMessage(successMsg, waitingMsg.messageID);
      } else {
        throw new Error(response.data?.message || "Registration failed");
      }

    } catch (err) {
      console.error("Join raffle error:", err);
      let errorMsg = "❌ Failed to register.";
      if (err.response?.data?.message) {
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
          return api.editMessage(`📋 **RAFFLE PARTICIPANTS**\n━━━━━━━━━━━━━━━━\nNo participants yet. Be the first to join!`, waitingMsg.messageID);
        }

        let listMsg = `🎟️ **RAFFLE PARTICIPANTS**\n━━━━━━━━━━━━━━━━\n📊 **Total:** ${total} participant(s)\n━━━━━━━━━━━━━━━━\n\n`;

        participants.forEach((p, index) => {
          listMsg += `${index + 1}. 🎫 **#${p.number || index + 1}**\n`;
          listMsg += `   👤 Name: ${p.name}\n`;
          listMsg += `   📱 GCash: ${p.gcash_number || p.gcashnumber}\n`;
          listMsg += `   💳 Account: ${p.gcash_name || p.gcashname}\n\n`;
        });

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
    if (!ADMIN_UIDS.includes(senderID)) {
      return api.sendMessage("❌ This command is for admins only.", threadID, messageID);
    }

    const waitingMsg = await api.sendMessage(`🎰 Spinning the raffle wheel...`, threadID);

    try {
      const response = await axios.get(`${API_BASE}?action=spin&apikey=${API_KEY}`, {
        timeout: 15000
      });

      console.log("Spin response:", JSON.stringify(response.data, null, 2));

      if (response.data?.status === true) {
        const winner = response.data.winner || response.data.result;
        
        const winnerMsg = 
          `🎉 **RAFFLE WINNER!** 🎉\n━━━━━━━━━━━━━━━━\n` +
          `🎫 **Spin #${winner?.spin_number || '?'}**\n` +
          `👤 **Name:** ${winner?.name || 'Unknown'}\n` +
          `💰 **Prize:** ${winner?.prize || '₱50 GCash'}\n` +
          `━━━━━━━━━━━━━━━━\n` +
          `🎊 **Congratulations!** 🎊`;

        await api.editMessage(winnerMsg, waitingMsg.messageID);
      } else {
        // Handle the "All 4 winners already selected" case
        const errorMsg = response.data?.error || response.data?.message;
        const winners = response.data?.winners || [];
        
        if (winners.length > 0) {
          let winnersListMsg = `❌ **${errorMsg || 'No more winners available!'}**\n━━━━━━━━━━━━━━━━\n\n`;
          winnersListMsg += `🏆 **WINNERS SO FAR:**\n`;
          winners.forEach((winner, index) => {
            winnersListMsg += `${index + 1}. 🎫 **Spin #${winner.spin_number}** - ${winner.name} - ${winner.prize}\n`;
          });
          winnersListMsg += `\n📌 Maximum of 4 winners only!\n💡 Use /raffle winners to see full list.`;
          
          await api.editMessage(winnersListMsg, waitingMsg.messageID);
        } else {
          await api.editMessage(`❌ ${response.data?.message || 'Failed to pick winner. No participants available.'}`, waitingMsg.messageID);
        }
      }

    } catch (err) {
      console.error("Spin raffle error:", err);
      await api.editMessage(`❌ Failed to pick winner: ${err.message}`, waitingMsg.messageID);
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

      console.log("Winners response:", JSON.stringify(response.data, null, 2));

      if (response.data?.status === true) {
        const winners = response.data.winners || [];
        const total = response.data.total_winners || 0;
        const prizePerWinner = response.data.prize_per_winner || "₱50";
        const totalPrize = response.data.total_prize_awarded || "₱0";

        if (total === 0 || winners.length === 0) {
          return api.editMessage(`🏆 **WINNERS LIST**\n━━━━━━━━━━━━━━━━\nNo winners yet. Use /raffle spin to pick winners!\n\n📌 Maximum of 4 winners only.`, waitingMsg.messageID);
        }

        let winnersMsg = `🏆 **WINNERS LIST**\n━━━━━━━━━━━━━━━━\n`;
        winnersMsg += `📊 **Total Winners:** ${total}/${response.data.expected_winners || 4}\n`;
        winnersMsg += `💰 **Prize per Winner:** ${prizePerWinner}\n`;
        winnersMsg += `💵 **Total Prize Awarded:** ${totalPrize}\n`;
        winnersMsg += `━━━━━━━━━━━━━━━━\n\n`;

        winners.forEach((winner, index) => {
          const date = new Date(winner.date).toLocaleString();
          winnersMsg += `${index + 1}. 🎫 **Spin #${winner.spin_number}**\n`;
          winnersMsg += `   👤 Name: ${winner.name}\n`;
          winnersMsg += `   📱 GCash: ${winner.gcash_number}\n`;
          winnersMsg += `   💳 Account: ${winner.gcash_name}\n`;
          winnersMsg += `   💰 Prize: ${winner.prize}\n`;
          winnersMsg += `   📅 Date: ${date}\n\n`;
        });

        if (total >= 4) {
          winnersMsg += `━━━━━━━━━━━━━━━━\n🎉 All ${total} winners have been selected!\n📌 The raffle is now complete.`;
        } else {
          winnersMsg += `━━━━━━━━━━━━━━━━\n🎟️ ${4 - total} winner(s) remaining!\n💡 Use /raffle spin to pick more winners.`;
        }

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
      // Try different reset parameter formats
      let response;
      try {
        response = await axios.get(`${API_BASE}?action=reset&apikey=${API_KEY}`, {
          timeout: 10000
        });
      } catch (e) {
        response = await axios.get(`${API_BASE}?action=reset&reset=true&apikey=${API_KEY}`, {
          timeout: 10000
        });
      }

      console.log("Reset response:", JSON.stringify(response.data, null, 2));

      if (response.data?.status === true) {
        await api.editMessage(`✅ RAFFLE RESET SUCCESSFUL!\n━━━━━━━━━━━━━━━━\n${response.data.message || 'All entries have been cleared.'}\n\n🎟️ New raffle session started!`, waitingMsg.messageID);
      } else {
        throw new Error(response.data?.message || "Reset failed");
      }

    } catch (err) {
      console.error("Reset raffle error:", err);
      
      let errorMsg = "❌ Failed to reset raffle.";
      if (err.response?.data?.message) {
        errorMsg = `❌ ${err.response.data.message}`;
      }
      await api.editMessage(errorMsg, waitingMsg.messageID);
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
