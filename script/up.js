const os = require('os');
const pidusage = require('pidusage');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const fs = require('fs-extra');
const path = require('path');

module.exports.config = {
  name: "up",
  version: "1.2.0",
  role: 0,
  credits: "selov",
  description: "Show all information of uptime and system stats",
  commandCategory: "info",
  usages: "/uptime",
  cooldowns: 5,
  aliases: ["up", "upt"]
};

// Helper: Convert bytes to readable format
function byte2mb(bytes) {
  if (bytes === 0 || bytes === undefined) return '0 Bytes';
  const units = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  let l = 0, n = parseInt(bytes, 10) || 0;
  while (n >= 1024 && ++l) n /= 1024;
  return `${n.toFixed(n < 10 && l > 0 ? 1 : 0)} ${units[l]}`;
}

// Helper: Format uptime from seconds
function getUptime(seconds) {
  if (!seconds || seconds <= 0) return '0s';
  const months = Math.floor(seconds / 2592000);
  const days = Math.floor((seconds % 2592000) / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  const parts = [];
  if (months > 0) parts.push(`${months}M`);
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
  
  return parts.join(' ');
}

// Helper: Get disk space info
async function getDiskSpaceInfo() {
  try {
    if (os.platform() === 'win32') {
      const { stdout } = await execPromise('wmic logicaldisk get size,freespace,caption');
      const lines = stdout.trim().split('\n').slice(1);
      let total = 0, used = 0, free = 0;
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 3) {
          const freeSpace = parseInt(parts[1]) || 0;
          const totalSpace = parseInt(parts[2]) || 0;
          total += totalSpace;
          used += (totalSpace - freeSpace);
          free += freeSpace;
        }
      }
      return { 
        total: byte2mb(total), 
        used: byte2mb(used), 
        free: byte2mb(free), 
        percent: total > 0 ? ((used / total) * 100).toFixed(1) : '0' 
      };
    } else {
      const { stdout } = await execPromise('df -h /');
      const lines = stdout.trim().split('\n');
      const lastLine = lines[lines.length - 1];
      const parts = lastLine.trim().split(/\s+/);
      return { 
        total: parts[1], 
        used: parts[2], 
        free: parts[3], 
        percent: parts[4]?.replace('%', '') || '0' 
      };
    }
  } catch {
    return { total: 'N/A', used: 'N/A', free: 'N/A', percent: 'N/A' };
  }
}

// Helper: Get CPU usage
async function getCpuUsage() {
  try {
    if (os.platform() === 'win32') {
      const { stdout } = await execPromise('wmic cpu get loadpercentage');
      const lines = stdout.trim().split('\n');
      return lines.length > 1 ? (parseInt(lines[1].trim()) || 0) : 0;
    } else {
      const { stdout } = await execPromise("top -bn1 | grep 'Cpu(s)' | awk '{print $2}'");
      return parseFloat(stdout.trim()) || 0;
    }
  } catch { 
    return 0; 
  }
}

// Helper: Get installed packages count
function getInstalledPackages() {
  try {
    const packagePath = path.join(process.cwd(), 'package.json');
    if (fs.existsSync(packagePath)) {
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      return Object.keys(packageJson.dependencies || {}).length + 
             Object.keys(packageJson.devDependencies || {}).length;
    }
    return 0;
  } catch { 
    return 0; 
  }
}

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID } = event;
  const startTime = Date.now();

  try {
    // Get system information
    const usage = await pidusage(process.pid).catch(() => ({ memory: 0 }));
    const uptimeSeconds = Math.floor(process.uptime());
    const totalMemory = byte2mb(os.totalmem());
    const freeMemory = byte2mb(os.freemem());
    const usedMemory = byte2mb(usage.memory || 0);
    const memoryPercent = ((os.totalmem() - os.freemem()) / os.totalmem() * 100).toFixed(1);
    
    const diskSpaceInfo = await getDiskSpaceInfo();
    const cpuUsage = await getCpuUsage();
    const packagesCount = getInstalledPackages();

    // Get user and thread counts (simplified - you can expand this)
    let userCount = 1;
    let threadCount = 1;
    
    // Try to get counts from global data if available
    if (global.db && global.db.all) {
      try {
        userCount = global.db.all().filter(d => d.key === 'users').length || 1;
        threadCount = global.db.all().filter(d => d.key === 'threads').length || 1;
      } catch (e) {}
    }

    const uptimeString = getUptime(uptimeSeconds);
    const responseTime = Date.now() - startTime;

    const msg = 
      `╭─╼━━━━━━━━━━━━╾─╮\n` +
      `│  🖥️  ＳＹＳＴＥＭ  ＳＴＡＴＵＳ  │\n` +
      `├─╼━━━━━━━━━━━━╾─╯\n` +
      `│ 📅 Date: ${new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" })}\n` +
      `│ ⏱️ Uptime: ${uptimeString}\n` +
      `│ 💻 CPU: ${cpuUsage}%\n` +
      `│ 🎯 RAM: ${usedMemory} / ${totalMemory} (${memoryPercent}%)\n` +
      `│ 💾 Disk: ${diskSpaceInfo.used} / ${diskSpaceInfo.total} (${diskSpaceInfo.percent}%)\n` +
      `│ 📊 Users: ${userCount} | Groups: ${threadCount}\n` +
      `│ 📦 Packages: ${packagesCount}\n` +
      `│ ⚡ Speed: ${responseTime}ms\n` +
      `╰─╼━━━━━━━━━━━━╾─╯`;

    return api.sendMessage(msg, threadID, messageID);

  } catch (err) {
    console.error("Uptime Error:", err);
    
    // Fallback: Simple uptime message
    const fallbackMsg = 
      `🖥️ **SYSTEM STATUS**\n━━━━━━━━━━━━━━━━\n` +
      `⏱️ Uptime: ${getUptime(Math.floor(process.uptime()))}\n` +
      `💻 Platform: ${os.platform()}\n` +
      `📦 Node: ${process.version}\n` +
      `⚠️ Error: ${err.message}`;
    
    return api.sendMessage(fallbackMsg, threadID, messageID);
  }
};
