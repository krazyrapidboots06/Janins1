const axios = require('axios');
const moment = require('moment-timezone');

module.exports.config = {
  name: "biblesched",
  version: "3.0.0",
  role: 2, // Admin only
  credits: "selov",
  description: "Auto Bible verses for ALL groups (humility, lust, Mark 6:66)",
  commandCategory: "religion",
  usages: "/biblesched on/off/status",
  cooldowns: 5
};

// Store active schedules per thread
const schedules = {};

// Bible verses database
const bibleVerses = {
  humility: [
    {
      verse: "Philippians 2:3-4",
      text: "Do nothing out of selfish ambition or vain conceit. Rather, in humility value others above yourselves, not looking to your own interests but each of you to the interests of the others."
    },
    {
      verse: "Proverbs 22:4",
      text: "Humility is the fear of the Lord; its wages are riches and honor and life."
    },
    {
      verse: "James 4:6",
      text: "But he gives us more grace. That is why Scripture says: 'God opposes the proud but shows favor to the humble.'"
    },
    {
      verse: "Micah 6:8",
      text: "He has shown you, O mortal, what is good. And what does the Lord require of you? To act justly and to love mercy and to walk humbly with your God."
    },
    {
      verse: "Matthew 23:12",
      text: "For those who exalt themselves will be humbled, and those who humble themselves will be exalted."
    }
  ],
  lust: [
    {
      verse: "1 Corinthians 6:18-20",
      text: "Flee from sexual immorality. All other sins a person commits are outside the body, but whoever sins sexually, sins against their own body. Do you not know that your bodies are temples of the Holy Spirit, who is in you, whom you have received from God? You are not your own; you were bought at a price. Therefore honor God with your bodies."
    },
    {
      verse: "Galatians 5:16",
      text: "So I say, walk by the Spirit, and you will not gratify the desires of the flesh."
    },
    {
      verse: "1 John 2:16",
      text: "For everything in the world—the lust of the flesh, the lust of the eyes, and the pride of life—comes not from the Father but from the world."
    },
    {
      verse: "Matthew 5:28",
      text: "But I tell you that anyone who looks at a woman lustfully has already committed adultery with her in his heart."
    },
    {
      verse: "Colossians 3:5",
      text: "Put to death, therefore, whatever belongs to your earthly nature: sexual immorality, impurity, lust, evil desires and greed, which is idolatry."
    }
  ],
  mark: [
    {
      verse: "Mark 6:66",
      text: "When they had crossed over, they landed at Gennesaret and anchored there."
    }
  ]
};

// Helper: Get random verse from category
function getRandomVerse(category) {
  const verses = bibleVerses[category];
  const randomIndex = Math.floor(Math.random() * verses.length);
  return verses[randomIndex];
}

// Helper: Format message
function formatMessage(verseData, categoryName) {
  return `📖 ${categoryName.toUpperCase()}\n━━━━━━━━━━━━━━━━\n📌 **${verseData.verse}**\n\n"${verseData.text}"\n━━━━━━━━━━━━━━━━\n🙏 May this word bless your day!`;
}

// Schedule function for a thread
function scheduleMessages(api, threadID) {
  const tz = 'Asia/Manila';
  
  // Morning: 6:00 AM
  const morningTime = moment.tz(tz).set({ hour: 6, minute: 0, second: 0 });
  let morningDelay = morningTime.diff(moment.tz(tz));
  if (morningDelay < 0) morningDelay += 24 * 60 * 60 * 1000;
  
  // Afternoon: 12:30 PM
  const afternoonTime = moment.tz(tz).set({ hour: 12, minute: 15, second: 0 });
  let afternoonDelay = afternoonTime.diff(moment.tz(tz));
  if (afternoonDelay < 0) afternoonDelay += 24 * 60 * 60 * 1000;
  
  // Evening: 6:00 PM
  const eveningTime = moment.tz(tz).set({ hour: 18, minute: 0, second: 0 });
  let eveningDelay = eveningTime.diff(moment.tz(tz));
  if (eveningDelay < 0) eveningDelay += 24 * 60 * 60 * 1000;
  
  // Clear existing schedules
  if (schedules[threadID]) {
    if (schedules[threadID].morning) clearTimeout(schedules[threadID].morning);
    if (schedules[threadID].afternoon) clearTimeout(schedules[threadID].afternoon);
    if (schedules[threadID].evening) clearTimeout(schedules[threadID].evening);
  }
  
  // Morning schedule
  const morningSchedule = setTimeout(async () => {
    try {
      const verse = getRandomVerse('humility');
      const message = formatMessage(verse, 'Humility');
      await api.sendMessage(message, threadID);
      // Reschedule for next day
      scheduleMessages(api, threadID);
    } catch (err) {
      console.error("Morning message error for thread", threadID, err);
    }
  }, morningDelay);
  
  // Afternoon schedule
  const afternoonSchedule = setTimeout(async () => {
    try {
      const verse = getRandomVerse('lust');
      const message = formatMessage(verse, 'Lust');
      await api.sendMessage(message, threadID);
    } catch (err) {
      console.error("Afternoon message error for thread", threadID, err);
    }
  }, afternoonDelay);
  
  // Evening schedule (Mark 6:66)
  const eveningSchedule = setTimeout(async () => {
    try {
      const verse = bibleVerses.mark[0];
      const message = formatMessage(verse, 'Mark 6:66');
      await api.sendMessage(message, threadID);
    } catch (err) {
      console.error("Evening message error for thread", threadID, err);
    }
  }, eveningDelay);
  
  // Store schedules
  schedules[threadID] = {
    morning: morningSchedule,
    afternoon: afternoonSchedule,
    evening: eveningSchedule,
    active: true
  };
}

// Cancel all schedules for a thread
function cancelSchedules(threadID) {
  if (schedules[threadID]) {
    if (schedules[threadID].morning) clearTimeout(schedules[threadID].morning);
    if (schedules[threadID].afternoon) clearTimeout(schedules[threadID].afternoon);
    if (schedules[threadID].evening) clearTimeout(schedules[threadID].evening);
    delete schedules[threadID];
  }
}

// Auto-activate for ALL groups when bot joins
module.exports.handleEvent = async function ({ api, event }) {
  const { threadID, logMessageType } = event;
  
  // When bot joins a new group, auto-activate schedule
  if (logMessageType === "log:subscribe") {
    const addedParticipants = event.logMessageData?.addedParticipants || [];
    const botID = api.getCurrentUserID();
    
    const botAdded = addedParticipants.some(p => p.userFbId === botID);
    
    if (botAdded && !schedules[threadID]?.active) {
      console.log(`Bot added to group ${threadID}, activating Bible schedule...`);
      scheduleMessages(api, threadID);
      
      setTimeout(async () => {
        try {
          const tz = 'Asia/Manila';
          const morning = moment.tz(tz).set({ hour: 6, minute: 0 }).format('hh:mm A');
          const afternoon = moment.tz(tz).set({ hour: 12, minute: 15 }).format('hh:mm A');
          const evening = moment.tz(tz).set({ hour: 18, minute: 0 }).format('hh:mm A');
          
          await api.sendMessage(
            `📖 Bible Schedule Activated\n━━━━━━━━━━━━━━━━\n` +
            `🌅 Morning (${morning}): Humility\n` +
            `☀️ Afternoon (${afternoon}): Lust\n` +
            `🌙 Evening (${evening}): Mark 6:66\n` +
            `━━━━━━━━━━━━━━━━\n` +
            `Daily Bible verses will be sent at these times.`,
            threadID
          );
        } catch (err) {
          console.error("Welcome message error:", err);
        }
      }, 5000);
    }
  }
};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, senderID } = event;
  const command = args[0]?.toLowerCase();
  
  try {
    // Admin UIDs for manual control
    const adminUIDs = ["61556388598622", "61552057602849"];
    
    if (!adminUIDs.includes(senderID)) {
      return api.sendMessage("❌ This command is for admins only.", threadID, messageID);
    }
    
    if (command === "on") {
      if (schedules[threadID]?.active) {
        return api.sendMessage("✅ Bible schedule is already active in this group.", threadID, messageID);
      }
      
      scheduleMessages(api, threadID);
      
      const tz = 'Asia/Manila';
      const morning = moment.tz(tz).set({ hour: 6, minute: 0 }).format('hh:mm A');
      const afternoon = moment.tz(tz).set({ hour: 12, minute: 15 }).format('hh:mm A');
      const evening = moment.tz(tz).set({ hour: 18, minute: 0 }).format('hh:mm A');
      
      return api.sendMessage(
        `📖 Bible Schedule Activated\n━━━━━━━━━━━━━━━━\n` +
        `🌅 Morning (${morning}): Humility\n` +
        `☀️ Afternoon (${afternoon}): Lust\n` +
        `🌙 Evening (${evening}): Mark 6:66\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `Daily Bible verses will be sent at these times.`,
        threadID,
        messageID
      );
      
    } else if (command === "off") {
      if (!schedules[threadID]?.active) {
        return api.sendMessage("❌ Bible schedule is not active in this group.", threadID, messageID);
      }
      
      cancelSchedules(threadID);
      return api.sendMessage("✅ Bible schedule has been turned off for this group.", threadID, messageID);
      
    } else if (command === "status") {
      if (schedules[threadID]?.active) {
        const tz = 'Asia/Manila';
        const morning = moment.tz(tz).set({ hour: 6, minute: 0 }).format('hh:mm A');
        const afternoon = moment.tz(tz).set({ hour: 12, minute: 15 }).format('hh:mm A');
        const evening = moment.tz(tz).set({ hour: 18, minute: 0 }).format('hh:mm A');
        
        return api.sendMessage(
          `📖 Bible Schedule Status\n━━━━━━━━━━━━━━━━\n` +
          `✅ Active: Yes\n` +
          `🌅 Morning (${morning}): Humility\n` +
          `☀️ Afternoon (${afternoon}): Lust\n` +
          `🌙 Evening (${evening}): Mark 6:66\n` +
          `━━━━━━━━━━━━━━━━\n` +
          `Daily verses are being sent.`,
          threadID,
          messageID
        );
      } else {
        return api.sendMessage(
          `📖 Bible Schedule Status\n━━━━━━━━━━━━━━━━\n` +
          `❌ Active: No\n\n` +
          `Use /biblesched on to activate daily Bible verses.`,
          threadID,
          messageID
        );
      }
      
    } else {
      return api.sendMessage(
        `📖 Bible Schedule Command\n━━━━━━━━━━━━━━━━\n` +
        `• /biblesched on - Activate daily Bible verses\n` +
        `• /biblesched off - Deactivate daily Bible verses\n` +
        `• /biblesched status - Check current status\n\n` +
        `Schedule (Philippines Time):\n` +
        `🌅 6:00 AM - Humility\n` +
        `☀️ 12:30 PM - Lust\n` +
        `🌙 6:00 PM - Mark 6:66`,
        threadID,
        messageID
      );
    }
    
  } catch (err) {
    console.error("Bible Schedule Error:", err);
    api.sendMessage(`❌ Error: ${err.message}`, threadID, messageID);
  }
};
