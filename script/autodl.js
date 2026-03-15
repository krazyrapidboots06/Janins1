const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

/* ===== API BASE ===== */
async function baseApiUrl() {
  const res = await axios.get(
    "https://raw.githubusercontent.com/noobcore404/NC-STORE/refs/heads/main/NCApiUrl.json",
    { timeout: 10000 }
  );
  if (!res.data?.apiv1) throw new Error("API base not found");
  return res.data.apiv1;
}

/* ===== SUPPORTED DOMAINS ===== */
const supportedDomains = [
  "facebook.com", "fb.watch",
  "youtube.com", "youtu.be",
  "tiktok.com",
  "instagram.com", "instagr.am",
  "likee.com", "likee.video",
  "capcut.com",
  "spotify.com",
  "terabox.com",
  "twitter.com", "x.com",
  "drive.google.com",
  "soundcloud.com",
  "ndown.app",
  "pinterest.com", "pin.it"
];

/* ===== EXTENSION HELPER ===== */
function getExt(url, type) {
  if (type === "audio") return "mp3";
  if (type === "image") return "jpg";

  const clean = url.split("?")[0];
  const ext = clean.split(".").pop();
  return ext.length <= 5 ? ext : "mp4";
}

/* ===== MODULE ===== */
module.exports.config = {
  name: "autodl",
  version: "3.1",
  role: 0,
  credits: "xnil6x",
  description: "Auto Media Downloader",
  commandCategory: "utility",
  usages: "Just send any supported media link",
  cooldowns: 3
};

module.exports.run = async function ({ api, event }) {
  api.sendMessage(
`╭──「 📥 AUTO DOWNLOADER 」──╮
│ 🔗 Send media link
│ ⚡ Auto download
│ 🌐 Multi-platform support
╰────────────────────╯`,
    event.threadID,
    event.messageID
  );
};

module.exports.handleEvent = async function ({ api, event }) {
  const text = event.body?.trim();
  if (!text?.startsWith("https://")) return;
  if (!supportedDomains.some(d => text.includes(d))) return;

  api.setMessageReaction("⏳", event.messageID, () => {}, true);

  try {
    const base = await baseApiUrl();
    const apiUrl = `${base}/api/auto?url=${encodeURIComponent(text)}`;
    const { data } = await axios.get(apiUrl, { timeout: 30000 });

    if (!data) throw new Error("No API data");

    const mediaUrl = data.high_quality || data.low_quality;
    if (!mediaUrl) throw new Error("No media URL");

    const ext = getExt(mediaUrl, data.type);
    const filePath = path.join(
      __dirname,
      "cache",
      `AUTODL_${Date.now()}.${ext}`
    );

    await fs.ensureDir(path.dirname(filePath));

    const buffer = await axios.get(mediaUrl, {
      responseType: "arraybuffer",
      timeout: 60000
    });

    await fs.writeFile(filePath, buffer.data);

    api.setMessageReaction("✅", event.messageID, () => {}, true);

    api.sendMessage(
      {
        body:
`╭─「 ✅ DOWNLOAD COMPLETE 」─╮
│ 🎬 Title    : ${data.title || "Unknown"}
│ 📁 Type     : ${data.type || "media"}
╰──────────────────────╯`,
        attachment: fs.createReadStream(filePath)
      },
      event.threadID,
      () => fs.unlinkSync(filePath),
      event.messageID
    );

  } catch (err) {
    console.error("[AUTODL ERROR]", err.message);
    api.setMessageReaction("❌", event.messageID, () => {}, true);

    api.sendMessage(
`╭─「 ❌ DOWNLOAD FAILED 」─╮
│ ⚠️ Cannot fetch media
│ 🔁 Try another link
╰──────────────────────╯`,
      event.threadID,
      event.messageID
    );
  }
};
