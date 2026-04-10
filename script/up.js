const os = require('os');
const fs = require('fs-extra');
const path = require('path');
const pidusage = require('pidusage');

const START_TIME_FILE = path.join(__dirname, 'cache', 'start_time.txt');

function byte2mb(bytes) {
  if (bytes === 0 || bytes === undefined) return '0 Bytes';
  const units = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  let l = 0, n = parseInt(bytes, 10) || 0;
  while (n >= 1024 && ++l) n /= 1024;
  return `${n.toFixed(n < 10 && l > 0 ? 1 : 0)} ${units[l]}`;
}

function getUptime(seconds) {
  if (!seconds || seconds <= 0) return '0s';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
  
  return parts.join(' ');
}

module.exports.config = {
  name: "uptime",
  version: "2.0.0",
  role: 0,
  credits: "selov",
  description: "Show bot uptime and system information",
  commandCategory: "system",
  usages: "/uptime",
  cooldowns: 5,
  aliases: ["up", "status"]
};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID } = event;
  
  try {
    // Get persistent start time
    let startTime;
    await fs.ensureDir(path.dirname(START_TIME_FILE));
    
    if (await fs.pathExists(START_TIME_FILE)) {
      startTime = parseInt(await fs.readFile(START_TIME_FILE, 'utf8'));
    } else {
      startTime = Date.now();
      await fs.writeFile(START_TIME_FILE, startTime.toString());
    }
    
    // Calculate uptime
    const currentTime = Date.now();
    const uptimeSeconds = Math.floor((currentTime - startTime) / 1000);
    
    // Get system stats
    const usage = await pidusage(process.pid);
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memPercent = ((usedMem / totalMem) * 100).toFixed(1);
    
    // Memory bar
    const barLength = 10;
    const filledBars = Math.round((usedMem / totalMem) * barLength);
    const memBar = '█'.repeat(filledBars) + '▒'.repeat(barLength - filledBars);
    
    // Disk info (Linux/Mac)
    let diskInfo = { used: 'N/A', total: 'N/A', bar: '▒'.repeat(barLength) };
    try {
      const { execSync } = require('child_process');
      const df = execSync("df -k /").toString().split('\n')[1].split(/\s+/);
      const used = parseInt(df[2]) * 1024;
      const total = parseInt(df[1]) * 1024;
      const percent = (used / total) * 100;
      const diskFilled = Math.round(percent / 10);
      diskInfo = {
        used: byte2mb(used),
        total: byte2mb(total),
        bar: '█'.repeat(diskFilled) + '▒'.repeat(barLength - diskFilled)
      };
    } catch (e) {}
    
    // Get user and thread counts (simplified)
    let userCount = 1;
    let threadCount = 1;
    try {
      // You can integrate your actual database here
      if (global.db && global.db.all) {
        const allData = global.db.all();
        userCount = allData.filter(d => d.key === 'users').length || 1;
        threadCount = allData.filter(d => d.key === 'threads').length || 1;
      }
    } catch (e) {}
    
    const uptimeString = getUptime(uptimeSeconds);
    const cpuUsage = usage.cpu ? usage.cpu.toFixed(1) : '0';
    const ramUsage = byte2mb(usedMem);
    const totalRam = byte2mb(totalMem);
    
    // Time of day greeting
    const hour = new Date().getHours();
    let greeting = "🤖 Bot Status";
    if (hour < 12) greeting = "🌅 Morning Status";
    else if (hour < 18) greeting = "☀️ Afternoon Status";
    else greeting = "🌙 Evening Status";
    
    const msg = 
      `🖥️ ${greeting}\n━━━━━━━━━━━━━━━━━━━━━━\n` +
      `⏱️ Uptime: ${uptimeString}\n` +
      `📅 Started: ${new Date(startTime).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `💻 System Info\n` +
      `• CPU: ${cpuUsage}%\n` +
      `• RAM: ${ramUsage} / ${totalRam} (${memPercent}%)\n` +
      `• OS: ${os.type()} ${os.release()}\n` +
      `• Cores: ${os.cpus().length}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📀 Disk [${diskInfo.bar}]\n` +
      `• Used: ${diskInfo.used} / ${diskInfo.total}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📊 Bot Stats\n` +
      `• Users: ${userCount}\n` +
      `• Groups: ${threadCount}\n` +
      `• Ping: ${Date.now() - event.timestamp}ms\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `⚡ Bot is online and running smoothly!`;
    
    return api.sendMessage(msg, threadID, messageID);
    
  } catch (err) {
    console.error("Uptime Error:", err);
    return api.sendMessage(`❌ Error getting uptime: ${err.message}`, threadID, messageID);
  }
};
