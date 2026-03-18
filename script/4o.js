const axios = require("axios");

module.exports.config = {
  name: "4o",
  version: "2.0.0",
  role: 0,
  credits: "selov",
  description: "Generate AI image with 4o model",
  commandCategory: "image",
  usages: "/4o <prompt>",
  cooldowns: 10,
  aliases: ["gpt4o", "dalle4o"]
};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, senderID } = event;
  
  const prompt = args.join(" ").trim();

  if (!prompt) {
    return api.sendMessage("❌ Please provide a prompt.\n\nExample: /4o a beautiful sunset", threadID, messageID);
  }

  // Show reaction that it's processing
  api.setMessageReaction("⏳", messageID, () => {}, true);

  try {
    const response = await axios.get("https://fluxcdibai-1.onrender.com/generate", {
      params: { 
        prompt: prompt, 
        model: "4o" 
      },
      timeout: 120000 // 2 minute timeout for image generation
    });

    const data = response.data;
    const imageUrl = data?.data?.imageResponseVo?.url;

    if (!imageUrl) {
      api.setMessageReaction("❌", messageID, () => {}, true);
      return api.sendMessage("❌ Failed to generate image. The API returned an unexpected response.", threadID, messageID);
    }

    api.setMessageReaction("✅", messageID, () => {}, true);

    // Download and send the image
    try {
      const imageStream = await axios({
        method: 'GET',
        url: imageUrl,
        responseType: 'stream'
      });

      api.sendMessage({
        body: `🎨 **Image Generated**\n━━━━━━━━━━━━━━━━\n📝 **Prompt:** ${prompt}\n━━━━━━━━━━━━━━━━`,
        attachment: imageStream.data
      }, threadID, messageID);
      
    } catch (downloadErr) {
      console.error("Download error:", downloadErr);
      // If direct stream fails, try sending the URL
      api.sendMessage(`✅ Image generated!\n\n📝 Prompt: ${prompt}\n🔗 URL: ${imageUrl}`, threadID, messageID);
    }

  } catch (err) {
    console.error("4o Command Error:", err);
    api.setMessageReaction("❌", messageID, () => {}, true);
    
    let errorMsg = "❌ Error while generating image.";
    if (err.code === 'ECONNABORTED') {
      errorMsg = "❌ Request timed out. The AI took too long to respond.";
    } else if (err.response) {
      errorMsg = `❌ API Error: Status ${err.response.status}`;
    }
    
    api.sendMessage(errorMsg, threadID, messageID);
  }
};
