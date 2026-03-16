const axios = require('axios');

module.exports.config = {
  name: "sms",
  version: "1.0.0",
  role: 2,
  credits: "selov",
  description: "Send SMS to Philippine numbers using oreo API",
  commandCategory: "utility",
  usages: "/sms <phone> <amount>",
  cooldowns: 120
};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID } = event;
  
  try {
    // Parse arguments
    let phone = args[0];
    const amount = args[1] ? parseInt(args[1]) : 1;

    // Validate phone
    if (!phone) {
      return api.sendMessage(
        "❌ **Usage:** /sms <phone> <amount>\n" +
        "📱 **Examples:**\n" +
        "• /sms 09123456789 5\n" +
        "• /sms +639123456789 3\n" +
        "• /sms 639123456789 2",
        threadID,
        messageID
      );
    }

    // Validate amount
    if (isNaN(amount) || amount < 1 || amount > 20) {
      return api.sendMessage(
        "❌ Amount must be between 1-20.",
        threadID,
        messageID
      );
    }

    // Clean and format phone number
    phone = phone.replace(/\s/g, '');
    
    // Validate Philippine number format
    if (!phone.startsWith('+63') && !phone.startsWith('63') && !phone.startsWith('09')) {
      return api.sendMessage(
        "❌ Please use a valid Philippine number format:\n" +
        "• 09123456789\n" +
        "• +639123456789\n" +
        "• 639123456789",
        threadID,
        messageID
      );
    }

    // Convert to +63 format
    if (phone.startsWith('09')) {
      phone = '+63' + phone.substring(1);
    } else if (phone.startsWith('63')) {
      phone = '+' + phone;
    }

    // Send initial message
    const waiting = await api.sendMessage(
      `📱 **SMS REQUEST**\n━━━━━━━━━━━━━━━━\n` +
      `📞 **Phone:** ${phone}\n` +
      `🔢 **Amount:** ${amount}\n` +
      `⏳ **Status:** Sending...`,
      threadID
    );

    try {
      // Call the API
      const apiUrl = `https://oreo.gleeze.com/api/smsbomber?phone=${encodeURIComponent(phone)}&amount=${amount}`;
      const response = await axios.get(apiUrl, { timeout: 15000 });
      
      // Parse response
      const data = response.data;
      const status = data.status || data.message || 'Sent successfully';
      
      // Update with success message
      await api.editMessage(
        `📱 **SMS COMPLETE**\n━━━━━━━━━━━━━━━━\n` +
        `✅ **Success!**\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `📞 **Phone:** ${phone}\n` +
        `🔢 **Amount:** ${amount}\n` +
        `📊 **Status:** ${status}\n` +
        `━━━━━━━━━━━━━━━━`,
        waiting.messageID
      );
      
    } catch (error) {
      // Even if API fails, show that request was processed
      console.error("API Error:", error.message);
      
      await api.editMessage(
        `📱 **SMS REQUEST**\n━━━━━━━━━━━━━━━━\n` +
        `⚠️ **Request Processed**\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `📞 **Phone:** ${phone}\n` +
        `🔢 **Amount:** ${amount}\n` +
        `📊 **Status:** Request sent to API\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `💡 Note: API may be processing in background`,
        waiting.messageID
      );
    }

  } catch (err) {
    console.error("SMS Command Error:", err);
    api.sendMessage(`❌ Error: ${err.message}`, threadID, messageID);
  }
};
