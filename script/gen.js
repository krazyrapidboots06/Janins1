const axios = require("axios");
const fs = require("fs");
const path = require("path");

module.exports.config = {
  name: "gen",
  version: "3.0.0",
  hasPermssion: 0,
  credits: "selov",
  description: "Generate AI images using Pollinations",
  commandCategory: "ai",
  usages: "gen <prompt>",
  cooldowns: 10,
  aliases: ["generate", "imagine", "draw"]
};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID } = event;
  const prompt = args.join(" ");

  if (!prompt) {
    return api.sendMessage(
      "🖼 AI IMAGE GENERATOR\n━━━━━━━━━━━━━━━━\n" +
      "Generate images from text descriptions.\n\n" +
      "Usage: gen <prompt>\n" +
      "Example: gen a beautiful sunset over mountains",
      threadID,
      messageID
    );
  }

  const waitingMsg = await api.sendMessage("🎨 Generating your image... please wait.", threadID);

  try {
    // Pollinations AI API
    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true`;
    
    // Download the image
    const response = await axios.get(imageUrl, { 
      responseType: "arraybuffer",
      timeout: 60000
    });
    
    if (!response.data || response.data.length < 1000) {
      throw new Error("Invalid image data received");
    }
    
    // Create cache directory
    const cacheDir = path.join(__dirname, "cache");
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    
    const imgPath = path.join(cacheDir, `gen_${Date.now()}.jpg`);
    fs.writeFileSync(imgPath, Buffer.from(response.data));
    
    // Delete waiting message
    await api.unsendMessage(waitingMsg.messageID);
    
    // Send the image
    api.sendMessage({
      body: `🖼 AI GENERATED IMAGE\n━━━━━━━━━━━━━━━━\n📝 Prompt: ${prompt}\n`,
      attachment: fs.createReadStream(imgPath)
    }, threadID, () => {
      fs.unlinkSync(imgPath);
    }, messageID);
    
  } catch (err) {
    console.error("Gen Error:", err);
    await api.unsendMessage(waitingMsg.messageID);
    
    let errorMsg = "❌ Failed to generate image.\n\n";
    errorMsg += "💡Tips:\n";
    errorMsg += "• Try a different prompt\n";
    errorMsg += "• Wait a few seconds and try again\n";
    errorMsg += "• The AI service may be busy";
    
    api.sendMessage(errorMsg, threadID, messageID);
  }
};
