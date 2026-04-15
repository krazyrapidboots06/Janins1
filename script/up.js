const os = require('os');
const pidusage = require('pidusage');

module.exports.config = {
  name: "uptime",
  version: "1.0.2",
  hasPermssion: 0,
  credits: "selov",
  description: "check bot uptime and system stats",
  commandCategory: "utility",
  usages: "uptime",
  cooldowns: 5
};

function byte2mb(bytes) {
  const units = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  let l = 0, n = parseInt(bytes, 10) || 0;
  while (n >= 1024 && ++l) n = n / 1024;
  return `${n.toFixed(n < 10 && l > 0 ? 1 : 0)} ${units[l]}`;
}

module.exports.run = async function ({ api, event }) {
  const { threadID, messageID } = event;

  try {
    const time = process.uptime();
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const seconds = Math.floor(time % 60);

    const usage = await pidusage(process.pid);

    const osInfo = {
      platform: os.platform(),
      architecture: os.arch()
    };

    const timeStart = Date.now();
    const ping = Date.now() - timeStart;

    const returnResult = `⏱️ UPTIME\n━━━━━━━━━━━━━━\n` +
      `🕒 ${hours} hour(s) ${minutes} minute(s) ${seconds} second(s)\n\n` +
      `💻 SYSTEM STATS\n` +
      `❖ CPU usage: ${usage.cpu.toFixed(1)}%\n` +
      `❖ RAM usage: ${byte2mb(usage.memory)}\n` +
      `❖ CPU cores: ${os.cpus().length}\n` +
      `❖ Ping: ${ping}ms\n` +
      `❖ OS: ${osInfo.platform}\n` +
      `❖ Arch: ${osInfo.architecture}`;

    api.sendMessage(returnResult, threadID, messageID);

  } catch (err) {
    console.error(err);
    api.sendMessage(
      `❌ Error getting uptime:\n${err.message}`,
      threadID,
      messageID
    );
  }
};
