const cron = require('node-cron');

// Admin UIDs - Only admins can start/stop the schedule
const ADMIN_UIDS = ["61556388598622", "61552057602849"];

// Bible verses categorized by topic
const bibleVerses = {
  lust: [
    "Matthew 5:28 - But I tell you that anyone who looks at a woman lustfully has already committed adultery with her in his heart.",
    "1 John 2:16 - For everything in the world—the lust of the flesh, the lust of the eyes, and the pride of life—comes not from the Father but from the world.",
    "Proverbs 6:25 - Do not lust in your heart after her beauty or let her captivate you with her eyes."
  ],
  '666': [
    "Revelation 13:16-18 - It also forced all people, great and small, rich and poor, free and slave, to receive a mark on their right hands or on their foreheads, so that they could not buy or sell unless they had the mark, which is the name of the beast or the number of its name. This calls for wisdom. Let anyone who has insight calculate the number of the beast, for it is the number of a man. That number is 666.",
    "Revelation 20:4 - Also I saw the souls of those who had been beheaded for the testimony of Jesus and for the word of God, and those who had not worshiped the beast or its image and had not received its mark."
  ],
  humble: [
    "Proverbs 22:4 - Humility is the fear of the Lord; its wages are riches and honor and life.",
    "James 4:10 - Humble yourselves before the Lord, and he will lift you up.",
    "1 Peter 5:6 - Humble yourselves, therefore, under God’s mighty hand, that he may lift you up in due time.",
    "Philippians 2:3 - Do nothing out of selfish ambition or vain conceit. Rather, in humility value others above yourselves.",
    "1 Peter 5:5 - Clothe yourselves, all of you, with humility toward one another, for God opposes the proud but gives grace to the humble.",
    "Micah 6:8 - Walk humbly with your God."
  ]
};

// Store scheduled tasks globally so they can be managed
if (!global.bibleSchedules) global.bibleSchedules = {};

// Function to send a random Bible verse to all group chats
async function sendBibleVerse(api, topic) {
  const verses = bibleVerses[topic];
  if (!verses || verses.length === 0) {
    console.error(`No verses found for topic: ${topic}`);
    return;
  }
  const randomVerse = verses[Math.floor(Math.random() * verses.length)];
  const message = `📖 **DAILY BIBLE VERSE**\n━━━━━━━━━━━━━━\nTopic: **${topic.toUpperCase()}**\n\n${randomVerse}\n━━━━━━━━━━━━━━\n_"The grass withers and the flowers fall, but the word of our God endures forever." - Isaiah 40:8_`;

  try {
    const allThreads = await api.getThreadList(100, null, ["INBOX"]);
    let sentCount = 0;
    for (const thread of allThreads) {
      if (thread.isGroup) {
        try {
          await api.sendMessage(message, thread.threadID);
          sentCount++;
        } catch (error) {
          console.error(`Failed to send Bible verse to thread ${thread.threadID}: ${error.message}`);
        }
      }
    }
    console.log(`Sent Bible verse (${topic}) to ${sentCount} group chats.`);
  } catch (err) {
    console.error("Error getting thread list for Bible verse broadcast:", err);
  }
}

module.exports.config = {
  name: "biblesched",
  version: "1.0.0",
  hasPermssion: 2, // Only admins can use this command
  credits: "selov",
  description: "Schedules daily Bible verses to all group chats (lust, 666, humble).",
  commandCategory: "admin",
  usages: "biblesched [start|stop]",
  cooldowns: 5
};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, senderID } = event;

  if (!ADMIN_UIDS.includes(senderID)) {
    return api.sendMessage("❌ You do not have permission to use this command.", threadID, messageID);
  }

  const action = args[0]?.toLowerCase();

  if (action === "start") {
    if (global.bibleSchedules.morning || global.bibleSchedules.afternoon || global.bibleSchedules.evening) {
      return api.sendMessage("⚠️ Bible verse schedule is already running.", threadID, messageID);
    }

    // Schedule for Morning (8:00 AM PHT - UTC+8)
    global.bibleSchedules.morning = cron.schedule('0 0 8 * * *', () => sendBibleVerse(api, 'lust'), {
      timezone: "Asia/Manila" // Philippines Timezone
    });
    // Schedule for Afternoon (1:00 PM PHT - UTC+8)
    global.bibleSchedules.afternoon = cron.schedule('0 0 13 * * *', () => sendBibleVerse(api, '666'), {
      timezone: "Asia/Manila" // Philippines Timezone
    });
    // Schedule for Evening (7:00 PM PHT - UTC+8)
    global.bibleSchedules.evening = cron.schedule('0 0 19 * * *', () => sendBibleVerse(api, 'humble'), {
      timezone: "Asia/Manila" // Philippines Timezone
    });

    api.sendMessage("✅ Bible verse schedule started: Morning (lust), Afternoon (666), Evening (humble).", threadID, messageID);
  } else if (action === "stop") {
    if (global.bibleSchedules.morning) global.bibleSchedules.morning.stop();
    if (global.bibleSchedules.afternoon) global.bibleSchedules.afternoon.stop();
    if (global.bibleSchedules.evening) global.bibleSchedules.evening.stop();

    global.bibleSchedules = {}; // Clear schedules
    api.sendMessage("🛑 Bible verse schedule stopped.", threadID, messageID);
  } else {
    api.sendMessage("📌 Usage: biblesched [start|stop]", threadID, messageID);
  }
};
