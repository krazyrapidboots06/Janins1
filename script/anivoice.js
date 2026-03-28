const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

const allmodels = ["madara", "aizen", "ayanokoji", "jinwoo", "nami", "nami-ja"];
const Langdata = ["en", "ja", "ko"];

module.exports.config = {
  name: "anivoice",
  version: "2.0",
  role: 0,
  credits: "S1FU",
  description: "Generate AI voices with aesthetic style",
  commandCategory: "fun",
  usages: "/anivoice <text> --m <model> --l <lang>",
  cooldowns: 5,
  aliases: ["aivoice", "animevoice"]
};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, senderID } = event;

  if (!args || args.length === 0) {
    return api.sendMessage(
      `╭── Ი𐑼 𖹭 𝖺𝗂 𝗏𝗈𝗂𝖼𝖾 𖹭 Ი𐑼 ──╮\n\n` +
      `  ᯓ★ 𝗉𝗅𝖾𝖺𝗌𝖾 𝗉𝗋𝗈𝗏𝗂𝖽𝖾 𝗂𝗇𝗉𝗎𝗍𝗌 .ᐟ\n` +
      `  ᯓ★ 𝖾𝗑𝖺𝗆𝗉𝗅𝖾: /anivoice hello --𝗆 aizen\n\n` +
      `  ⋆ 𝗆𝗈𝖽𝖾𝗅𝗌: ${allmodels.join(", ")}\n` +
      `  ⋆ 𝗅𝖺𝗇𝗀𝗌: ${Langdata.join(", ")}\n\n` +
      `╰── ᯓ★˙𐃷˙݁ ˖Ი𐑼⋆𖹭.ᐟ ──╯`,
      threadID,
      messageID
    );
  }

  // Parse arguments
  let modelName = "aizen";
  const modelFlagIndex = args.findIndex(arg => arg === "--m" || arg === "--model");
  if (modelFlagIndex !== -1 && args.length > modelFlagIndex + 1) {
    modelName = args[modelFlagIndex + 1].toLowerCase();
    args.splice(modelFlagIndex, 2);
  }

  if (!allmodels.includes(modelName)) {
    return api.sendMessage(
      `╭── Ი𐑼 𖹭 𝖾𝗋𝗋𝗈𝗋 𖹭 Ი𐑼 ──╮\n\n` +
      `  ᯓ★ 𝗂𝗇𝗏𝖺𝗅𝗂𝖽 𝗆𝗈𝖽𝖾𝗅 𝗇𝖺𝗆𝖾 .ᐟ\n\n` +
      `╰── ᯓ★˙𐃷˙݁ ˖Ი𐑼⋆𖹭.ᐟ ──╯`,
      threadID,
      messageID
    );
  }

  let lang = "en";
  const langFlagIndex = args.findIndex(arg => arg === "--lang" || arg === "--l");
  if (langFlagIndex !== -1 && args.length > langFlagIndex + 1) {
    lang = args[langFlagIndex + 1].toLowerCase();
    args.splice(langFlagIndex, 2);
  }

  if (!Langdata.includes(lang)) {
    return api.sendMessage(
      `╭── Ი𐑼 𖹭 𝖾𝗋𝗋𝗈𝗋 𖹭 Ი𐑼 ──╮\n\n` +
      `  ᯓ★ 𝗎𝗇𝗌𝗎𝗉𝗉𝗈𝗋𝗍𝖾𝖽 𝗅𝖺𝗇𝗀𝗎𝖺𝗀𝖾 .ᐟ\n\n` +
      `╰── ᯓ★˙𐃷˙݁ ˖Ი𐑼⋆𖹭.ᐟ ──╯`,
      threadID,
      messageID
    );
  }

  let text = args.join(" ");
  if (!text) {
    return api.sendMessage("ᯓ★ 𝗉𝗅𝖾𝖺𝗌𝖾 𝖾𝗇𝗍𝖾𝗋 𝗌𝗈𝗆𝖾 𝗍𝖾𝗑𝗍 .ᐟ", threadID, messageID);
  }

  // Show typing indicator
  api.sendTypingIndicator(threadID, true);

  try {
    // Translate if language is not English
    if (lang !== "en") {
      const translateRes = await axios.get(
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${lang}&dt=t&q=${encodeURIComponent(text)}`,
        { timeout: 10000 }
      );
      text = translateRes.data[0].map(item => item[0]).join('');
    }

    // Call the voice API
    const apiURL = `https://voice-foxai.onrender.com/clonet?text=${encodeURIComponent(text)}&model=${modelName}&lang=${lang}`;
    const response = await axios.get(apiURL, { timeout: 20000 });

    const audioUrl = response.data.url;
    if (!audioUrl) {
      return api.sendMessage("ᯓ★ 𝗇𝗈 𝖺𝗎𝖽𝗂𝗈 𝖿𝗈𝗎𝗇𝖽 Ი𐑼", threadID, messageID);
    }

    // Create cache directory
    const cacheDir = path.join(__dirname, "cache", "anivoice");
    await fs.ensureDir(cacheDir);

    const filePath = path.join(cacheDir, `anivoice_${Date.now()}.mp3`);

    // Download the audio
    const audioResponse = await axios.get(audioUrl, {
      responseType: "arraybuffer",
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    fs.writeFileSync(filePath, audioResponse.data);

    // Send audio with info
    const resultMsg = 
      `╭── Ი𐑼 𖹭 𝗏𝗈𝗂𝖼𝖾 𝗋𝖾𝖺𝖽𝗒 𖹭 Ი𐑼 ──╮\n\n` +
      `  ⋆ 𝗆𝗈𝖽𝖾𝗅: ${modelName}\n` +
      `  ⋆ 𝗅𝖺𝗇𝗀: ${lang}\n\n` +
      `╰── ᯓ★˙𐃷˙݁ ˖Ი𐑼⋆𖹭.ᐟ ──╯`;

    api.sendMessage({
      body: resultMsg,
      attachment: fs.createReadStream(filePath)
    }, threadID, () => {
      // Clean up file after sending
      setTimeout(() => {
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch (e) {}
      }, 5000);
    }, messageID);

  } catch (err) {
    console.error("AniVoice Error:", err);
    api.sendMessage("ᯓ★ 𝗌𝗒𝗌𝗍𝖾𝗆 𝖾𝗋𝗋𝗈𝗋 𝗈𝖼𝖼𝗎𝗋𝖾𝖽 Ი𐑼", threadID, messageID);
  }
};
