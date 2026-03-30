const os = require("os");
const { execSync } = require("child_process");

function formatBytes(bytes) {
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  if (bytes === 0) return "0 Bytes";
  const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
  return (bytes / Math.pow(1024, i)).toFixed(2) + " " + sizes[i];
}

module.exports.config = {
  name: "up",
  version: "1.2",
  role: 0,
  credits: "selov",
  description: "Show bot status & uptime",
  commandCategory: "system",
  usages: "/uptime",
  cooldowns: 5,
  aliases: ["up", "upt"]
};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID } = event;
  
  try {
    const uptimeSec = process.uptime();
    const hours = Math.floor(uptimeSec / 3600);
    const minutes = Math.floor((uptimeSec % 3600) / 60);
    const seconds = Math.floor(uptimeSec % 60);
    const uptime = `${hours}Hrs ${minutes}Min ${seconds}Sec`;

    // Get user and group counts (simplified - you can expand with your database)
    let users = 1;
    let groups = 1;
    
    // Try to get counts from global data if available
    if (global.db && global.db.all) {
      try {
        const allData = global.db.all();
        users = allData.filter(d => d.key === 'users').length || 1;
        groups = allData.filter(d => d.key === 'threads').length || 1;
      } catch (e) {}
    }

    const totalMem = os.totalmem();
    const usedMem = totalMem - os.freemem();
    const memUsage = (usedMem / totalMem) * 100;
    const memBar = "█".repeat(Math.round(memUsage / 10)) + "▒".repeat(10 - Math.round(memUsage / 10));
    const ramBar = "█".repeat(Math.round(usedMem / totalMem * 10)) + "▒".repeat(10 - Math.round(usedMem / totalMem * 10));

    let disk = {
      used: 0,
      total: 1,
      bar: "▒▒▒▒▒▒▒▒▒▒"
    };

    try {
      const df = execSync("df -k /").toString().split("\n")[1].split(/\s+/);
      const used = parseInt(df[2]) * 1024;
      const total = parseInt(df[1]) * 1024;
      const percent = Math.round((used / total) * 100);
      const bar = "█".repeat(Math.floor(percent / 10)) + "▒".repeat(10 - Math.floor(percent / 10));
      disk = {
        used,
        total,
        bar
      };
    } catch (e) {}

    const msg =
`🏃 **Bot Running:** ${uptime}
👪 **Users:** ${users}
📡 **OS:** ${os.type().toLowerCase()} ${os.release()}
📱 **Model:** ${os.cpus()[0]?.model || "Unknown Processor"}
🛡 **Cores:** ${os.cpus().length}
🗄 **Architecture:** ${os.arch()}
📀 **Disk Information:**
        [${disk.bar}]
        Usage: ${formatBytes(disk.used)}
        Total: ${formatBytes(disk.total)}
💾 **Memory Information:**
        [${memBar}]
        Usage: ${formatBytes(usedMem)}
        Total: ${formatBytes(totalMem)}
🗃 **RAM Information:**
        [${ramBar}]
        Usage: ${(usedMem / 1024 / 1024 / 1024).toFixed(2)} GB
        Total: ${(totalMem / 1024 / 1024 / 1024).toFixed(2)} GB`;

    return api.sendMessage(msg, threadID, messageID);
    
  } catch (err) {
    console.error("Uptime Error:", err);
    return api.sendMessage("❌ | Uptime command failed.", threadID, messageID);
  }
};
