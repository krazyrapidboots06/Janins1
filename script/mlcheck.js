const axios = require('axios');

module.exports.config = {
  name: "mlcheck",
  version: "2.0.0",
  role: 0,
  credits: "selov",
  description: "Check Mobile Legends account details",
  commandCategory: "game",
  usages: "/mlcheck <userid> <zoneid>",
  cooldowns: 5
};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID } = event;
  
  const userId = args[0];
  const zoneId = args[1];
  
  if (!userId || !zoneId) {
    return api.sendMessage(
      "🎮 **MLBB ACCOUNT CHECKER**\n━━━━━━━━━━━━━━━━\n" +
      "Usage: /mlcheck <userid> <zoneid>\n\n" +
      "Example: /mlcheck 2002113712 19417\n\n" +
      "Find your User ID and Zone ID in your MLBB profile.",
      threadID,
      messageID
    );
  }
  
  // Validate IDs are numbers
  if (isNaN(userId) || isNaN(zoneId)) {
    return api.sendMessage("❌ User ID and Zone ID must be numbers.", threadID, messageID);
  }
  
  const waitingMsg = await api.sendMessage(`🔍 Checking account: ${userId} (Zone ${zoneId})...`, threadID);
  
  try {
    // Try PuruBoy API first
    let response;
    try {
      response = await axios.post('https://puruboy-api.vercel.app/api/tools/mlbb', {
        userId: userId,
        zoneId: zoneId
      }, {
        timeout: 10000,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (puruError) {
      console.log("PuruBoy API failed, trying alternative...");
      
      // Alternative API if PuruBoy fails
      try {
        const altResponse = await axios.get(`https://api.diioffc.web.id/api/mlbb/${userId}/${zoneId}`, {
          timeout: 10000
        });
        response = { data: altResponse.data };
      } catch (altError) {
        throw new Error("All APIs are currently unavailable");
      }
    }
    
    const data = response.data;
    
    // Check different response formats
    if (!data.success && !data.status) {
      throw new Error(data.message || "Account not found");
    }
    
    // Extract result from different response structures
    const result = data.result || data.data || data;
    
    const resultMsg = 
      `🎮 **MLBB ACCOUNT DETAILS**\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `📊 **User ID:** ${userId}\n` +
      `🌍 **Zone ID:** ${zoneId}\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `👤 **Nickname:** ${result.nickname || result.username || result.name || 'N/A'}\n` +
      `🌏 **Region:** ${result.region || result.country || 'N/A'}\n` +
      `📅 **Last Login:** ${result.lastLogin || result.last_active || 'N/A'}\n` +
      `🕐 **Created:** ${result.createdAt || result.created_at || 'N/A'}\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `🔍 Checked by: Selov`;
    
    await api.editMessage(resultMsg, waitingMsg.messageID);
    
  } catch (err) {
    console.error("MLBB Check Error:", err);
    
    let errorMsg = 
      `❌ **MLBB Check Failed**\n━━━━━━━━━━━━━━━━\n` +
      `📊 **User ID:** ${userId}\n` +
      `🌍 **Zone ID:** ${zoneId}\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `🔴 **Error:** ${err.message}\n\n` +
      `💡 **Possible reasons:**\n` +
      `• Invalid User ID or Zone ID\n` +
      `• Account does not exist\n` +
      `• API service is temporarily down\n\n` +
      `Try again later or check your IDs.`;
    
    await api.editMessage(errorMsg, waitingMsg.messageID);
  }
};
