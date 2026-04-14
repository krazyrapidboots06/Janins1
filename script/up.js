const os = require("os");
const fs = require("fs-extra");
const path = require("path");

// File to store persistent start time
const START_TIME_FILE = path.join(__dirname, "cache", "bot_start_time.txt");

// Get or set persistent start time
async function getStartTime() {
  try {
    await fs.ensureDir(path.dirname(START_TIME_FILE));
    if (await fs.pathExists(START_TIME_FILE)) {
      const savedTime = parseInt(await fs.readFile(START_TIME_FILE, 'utf8'));
      if (!isNaN(savedTime) && savedTime > 0) {
        return savedTime;
      }
    }
  } catch (e) {}
  return Date.now();
}

async function saveStartTime(time) {
  try {
    await fs.writeFile(START_TIME_FILE, time.toString());
  } catch (e) {}
}

function formatDuration(seconds) {
  const days = Math.floor(seconds / (3600 * 24));
  const hours = Math.floor((seconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  const parts = [];
  if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`);
  if (hours > 0) parts.push(`${hours} hour${hours > 1 ? 's' : ''}`);
  if (minutes > 0) parts.push(`${minutes} minute${minutes > 1 ? 's' : ''}`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs} second${secs > 1 ? 's' : ''}`);
  
  return parts.join(' ');
}

module.exports.config = {
  name: "up",
  version: "4.0.0",
  role: 0,
  credits: "selov",
  description: "Check bot uptime with persistent tracking",
  commandCategory: "system",
  usages: "/up",
  cooldowns: 5,
  aliases: ["uptime", "status"]
};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID } = event;

  try {
    // Get persistent start time (saved across restarts)
    let startTime = await getStartTime();
    const currentTime = Date.now();
    const uptimeSeconds = Math.floor((currentTime - startTime) / 1000);
    
    // System stats
    const cpuUsage = os.loadavg()[0]?.toFixed(2) || "0.00";
    const totalMem = (os.totalmem() / 1024 / 1024).toFixed(2);
    const usedMem = (process.memoryUsage().rss / 1024 / 1024).toFixed(2);
    const platform = os.platform();
    const startDate = new Date(startTime).toLocaleString();
    const hostname = os.hostname();
    
    // Get IP address
    const netInterfaces = os.networkInterfaces();
    let ipAddr = "N/A";
    for (const name of Object.keys(netInterfaces)) {
      for (const net of netInterfaces[name]) {
        if (net.family === "IPv4" && !net.internal) {
          ipAddr = net.address;
          break;
        }
      }
    }

    const uptimeFormatted = formatDuration(uptimeSeconds);
    
    const finalMsg = 
`✨ BOT UPTIME ✨

⏳ Uptime: ${uptimeFormatted}
💻 CPU Load: ${cpuUsage}%
📦 Memory: ${usedMem} / ${totalMem} MB
🖥 Platform: ${platform}
🚀 Started: ${startDate}
━━━━━━━━━━━━━━━━
📡 Host: ${hostname}
🌐 IP Address: ${ipAddr}
━━━━━━━━━━━━━━━━`;

    // Save current time for next run (optional: update only if needed)
    // await saveStartTime(startTime);
    
    return api.sendMessage(finalMsg, threadID, messageID);
    
  } catch (err) {
    console.error("Uptime Error:", err);
    return api.sendMessage("⚠ Failed to check uptime!", threadID, messageID);
  }
};
