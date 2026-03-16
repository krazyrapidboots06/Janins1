const axios = require('axios');

// User agents list with rotation
const ua_list = [
  "Mozilla/5.0 (Linux; Android 10; Wildfire E Lite) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/105.0.5195.136 Mobile Safari/537.36[FBAN/EMA;FBLC/en_US;FBAV/298.0.0.10.115;]",
  "Mozilla/5.0 (Linux; Android 11; KINGKONG 5 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/87.0.4280.141 Mobile Safari/537.36[FBAN/EMA;FBLC/fr_FR;FBAV/320.0.0.12.108;]",
  "Mozilla/5.0 (Linux; Android 11; G91 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/106.0.5249.126 Mobile Safari/537.36[FBAN/EMA;FBLC/fr_FR;FBAV/325.0.0.1.4.108;]"
];

// In-memory store
let activeShares = new Map();

// Token extraction function
async function extract_token(cookie, ua, retries = 2) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await axios.get(
        "https://business.facebook.com/business_locations",
        {
          headers: {
            "user-agent": ua,
            "referer": "https://www.facebook.com/",
            "Cookie": cookie,
            "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "accept-language": "en-US,en;q=0.5",
            "accept-encoding": "gzip, deflate, br",
            "dnt": "1",
            "connection": "keep-alive",
            "upgrade-insecure-requests": "1"
          },
          timeout: 10000,
          maxRedirects: 3
        }
      );

      const patterns = [
        /(EAAG\w+)/,
        /(EAA[A-Za-z0-9]+)/,
        /access_token=([^&\s"]+)/
      ];

      for (const pattern of patterns) {
        const match = response.data.match(pattern);
        if (match) return match[1];
      }

      return null;
    } catch (err) {
      if (i === retries - 1) return null;
    }
  }
}

// Share function - OPTIMIZED FOR SPEED
async function performShare(post_link, token, cookie, ua, shareId, totalLimit) {
  const results = [];
  const startTime = Date.now();

  // Use Promise.all for concurrent requests (10 at a time)
  const batchSize = 10;
  
  for (let i = 0; i < totalLimit; i += batchSize) {
    if (activeShares.get(shareId) === 'cancelled') {
      break;
    }

    const currentBatchSize = Math.min(batchSize, totalLimit - i);
    const batchPromises = [];

    for (let j = 0; j < currentBatchSize; j++) {
      batchPromises.push(
        axios.post(
          "https://graph.facebook.com/v18.0/me/feed",
          null,
          {
            params: {
              link: post_link,
              access_token: token,
              published: 0
            },
            headers: {
              "user-agent": ua,
              "Cookie": cookie,
              "accept": "application/json, text/plain, */*",
              "accept-language": "en-US,en;q=0.9",
              "origin": "https://business.facebook.com",
              "referer": "https://business.facebook.com/"
            },
            timeout: 8000
          }
        ).then(response => ({
          success: true,
          id: response.data?.id || null
        })).catch(error => ({
          success: false,
          error: error.message
        }))
      );
    }

    // Execute batch concurrently
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    // Small delay between batches to avoid overwhelming
    if (i + batchSize < totalLimit) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  const endTime = Date.now();
  const duration = (endTime - startTime) / 1000;

  return {
    success: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    total: results.length,
    duration
  };
}

module.exports.config = {
  name: "share",
  version: "2.0.0",
  role: 0,
  credits: "selov",
  description: "Fast Facebook post sharing tool",
  commandCategory: "utility",
  usages: "/share [cookie] | [fb link] | [amount]",
  cooldowns: 5
};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, senderID } = event;

  const input = args.join(' ').split('|').map(part => part.trim());
  const cookie = input[0];
  const post_link = input[1];
  const limit = input[2];

  // Validate input
  if (!cookie || !post_link || !limit) {
    return api.sendMessage(
      'Use Dummy account. ❌ Error: Please provide cookie, Facebook link, and amount separated by "|".\n\nExample: /share [cookie] | [fb link] | [amount]',
      threadID,
      messageID
    );
  }

  const limitNum = parseInt(limit, 10);

  if (isNaN(limitNum) || limitNum <= 0) {
    return api.sendMessage(
      '❌ Error: Amount must be a valid positive number.',
      threadID,
      messageID
    );
  }

  if (limitNum > 5000) {
    return api.sendMessage(
      '❌ Error: Maximum limit is 5000 shares per request.',
      threadID,
      messageID
    );
  }

  if (!cookie.includes('=')) {
    return api.sendMessage(
      '❌ Error: Invalid cookie format.',
      threadID,
      messageID
    );
  }

  try {
    new URL(post_link);
  } catch {
    return api.sendMessage(
      '❌ Error: Invalid Facebook URL format.',
      threadID,
      messageID
    );
  }

  const shareId = Date.now();
  const waitingMessage = `⚡ **FAST SHARE MODE** ⚡\n━━━━━━━━━━━━━━━━\n📊 Amount: ${limitNum}\n🔑 Extracting token...`;

  // Send initial message
  const info = await api.sendMessage(waitingMessage, threadID);

  try {
    const ua = ua_list[Math.floor(Math.random() * ua_list.length)];
    
    await api.editMessage('⚡ Extracting token...', info.messageID);
    
    const token = await extract_token(cookie, ua);

    if (!token) {
      return api.editMessage(
        '❌ Error: Token extraction failed. Check your cookie validity.',
        info.messageID
      );
    }

    await api.editMessage(`✅ Token extracted!\n🚀 Starting shares (0/${limitNum}) - FAST MODE...`, info.messageID);

    activeShares.set(shareId, 'active');

    const shareResults = await performShare(post_link, token, cookie, ua, shareId, limitNum);

    activeShares.delete(shareId);

    const successRate = ((shareResults.success / shareResults.total) * 100).toFixed(1);
    const sharesPerSecond = (shareResults.total / shareResults.duration).toFixed(1);
    
    const resultMessage = `⚡ **FAST SHARE RESULTS** ⚡\n━━━━━━━━━━━━━━━━━━\n✅ Successful: ${shareResults.success}\n❌ Failed: ${shareResults.failed}\n📈 Success Rate: ${successRate}%\n⚡ Speed: ${sharesPerSecond} shares/sec\n⏱️ Total Time: ${shareResults.duration.toFixed(1)}s\n━━━━━━━━━━━━━━━━━━\n${shareResults.success > 0 ? '🎉 Fast sharing completed!' : '😞 No shares were successful.'}`;

    return api.editMessage(resultMessage, info.messageID);

  } catch (error) {
    console.error('Share command error:', error.message);
    activeShares.delete(shareId);
    return api.editMessage(
      `❌ Error: Failed to process share request.\n${error.message}`,
      info.messageID
    );
  }
};
