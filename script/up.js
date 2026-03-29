const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const pidusage = require('pidusage');

// Font mapping for aesthetic text
let fontEnabled = true;

function formatFont(text) {
  const fontMapping = {
    a: "𝖺", b: "𝖻", c: "𝖼", d: "𝖽", e: "𝖾", f: "𝖿", g: "𝗀", h: "𝗁", i: "𝗂", j: "𝗃", k: "𝗄", l: "𝗅", m: "𝗆",
    n: "𝗇", o: "𝗈", p: "𝗉", q: "𝗊", r: "𝗋", s: "𝗌", t: "𝗍", u: "𝗎", v: "𝗏", w: "𝗐", x: "𝗑", y: "𝗒", z: "𝗓",
    A: "𝖠", B: "𝖡", C: "𝖢", D: "𝖣", E: "𝖤", F: "𝖥", G: "𝖦", H: "𝖧", I: "𝖨", J: "𝖩", K: "𝖪", L: "𝖫", M: "𝖬",
    N: "𝖭", O: "𝖮", P: "𝖯", Q: "𝖰", R: "𝖱", S: "𝖲", T: "𝖳", U: "𝖴", V: "𝖵", W: "𝖶", X: "𝖷", Y: "𝖸", Z: "𝖹"
  };

  let formattedText = "";
  for (const char of text) {
    if (fontEnabled && char in fontMapping) {
      formattedText += fontMapping[char];
    } else {
      formattedText += char;
    }
  }
  return formattedText;
}

function byte2mb(bytes) {
  const units = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  let l = 0, n = parseInt(bytes, 10) || 0;
  while (n >= 1024 && ++l) n = n / 1024;
  return `${n.toFixed(n < 10 && l > 0 ? 1 : 0)} ${units[l]}`;
}

function getUptime(uptime) {
  const days = Math.floor(uptime / (3600 * 24));
  const hours = Math.floor((uptime % (3600 * 24)) / 3600);
  const mins = Math.floor((uptime % 3600) / 60);
  const seconds = Math.floor(uptime % 60);
  const months = Math.floor(days / 30);
  const remainingDays = days % 30;
  return `${months} Month(s), ${remainingDays} day(s), ${hours} hour(s), ${mins} minute(s), ${seconds} second(s)`;
}

module.exports.config = {
  name: "up",
  version: "1.0.2",
  role: 0,
  credits: "selov",
  description: "Get bot uptime and system information",
  commandCategory: "system",
  usages: "/uptime",
  cooldowns: 5,
  aliases: ["status", "runtime"]
};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, timestamp } = event;
  
  try {
    // Get start timestamp from file
    const timeFilePath = path.join(__dirname, 'cache', 'time.txt');
    let startTime;
    
    try {
      if (await fs.pathExists(timeFilePath)) {
        const startTimeStr = await fs.readFile(timeFilePath, 'utf8');
        startTime = parseInt(startTimeStr);
      } else {
        startTime = Date.now();
        await fs.ensureDir(path.dirname(timeFilePath));
        await fs.writeFile(timeFilePath, startTime.toString());
      }
    } catch (err) {
      startTime = Date.now();
    }
    
    const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
    const usage = await pidusage(process.pid);
    
    // Get thread and user counts (simplified version)
    let threadCount = 0;
    let userCount = 0;
    
    // You can replace this with actual database query if you have one
    try {
      const cacheDir = path.join(__dirname, 'cache');
      await fs.ensureDir(cacheDir);
      // Simple counter - replace with your actual database logic
      threadCount = 1; // Current thread
      userCount = 1; // Current user
    } catch (err) {
      console.error("Error getting counts:", err);
    }
    
    const osInfo = {
      platform: os.platform(),
      architecture: os.arch(),
      homedir: os.homedir(),
      hostname: os.hostname(),
      rel: os.release(),
      free: os.freemem()
    };
    
    const uptimeMessage = getUptime(uptimeSeconds);
    
    const resultMessage = formatFont(
      `🤖 BOT UPTIME\n━━━━━━━━━━━━━━━━\n` +
      `⏱️ Uptime: ${uptimeMessage}\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `💻 System Info\n` +
      `• CPU Usage: ${usage.cpu.toFixed(1)}%\n` +
      `• RAM Usage: ${byte2mb(usage.memory)}\n` +
      `• Cores: ${os.cpus().length}\n` +
      `• Platform: ${osInfo.platform}\n` +
      `• Architecture: ${osInfo.architecture}\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `📊 Bot Stats\n` +
      `• Total Users: ${userCount}\n` +
      `• Total Threads: ${threadCount}\n` +
      `• Ping: ${Date.now() - timestamp}ms\n` +
      `━━━━━━━━━━━━━━━━`
    );
    
    // Save current timestamp for next run
    await fs.writeFile(timeFilePath, Date.now().toString());
    
    return api.sendMessage(resultMessage, threadID, messageID);
    
  } catch (err) {
    console.error("Uptime Error:", err);
    return api.sendMessage(
      `❌ Error getting system information: ${err.message}`,
      threadID,
      messageID
    );
  }
};
