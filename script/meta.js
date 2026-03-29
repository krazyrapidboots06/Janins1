const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

module.exports.config = {
  name: "meta",
  version: "2.5pro",
  role: 0,
  credits: "Neoaz 🐊",
  description: "Chat with Meta AI and edit/generate images",
  commandCategory: "ai",
  usages: "/metaai <prompt> or reply to an image",
  cooldowns: 5,
  aliases: ["meta", "llama", "ai"]
};

// Global store for reply handlers
if (!global.metaReplyHandlers) global.metaReplyHandlers = {};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, senderID, type, messageReply } = event;
  let prompt = args.join(" ").trim();
  let imageUrl = null;

  // Check if replying to an image
  if (type === "message_reply" && messageReply?.attachments?.length > 0) {
    const photo = messageReply.attachments.find(a => a.type === "photo");
    if (photo) {
      imageUrl = photo.url;
    }
  }

  if (!prompt && !imageUrl) {
    return api.sendMessage(
      "🤖 Meta AI\n━━━━━━━━━━━━━━━━\n" +
      "Please provide a prompt or reply to an image.\n\n" +
      "Examples:\n" +
      "• /metaai What is artificial intelligence?\n" +
      "• Reply to an image with: /metaai Describe this image\n" +
      "• /metaai Create an image of a sunset\n\n" +
      "💡 Reply to continue the conversation!",
      threadID,
      messageID
    );
  }

  // Set reaction
  api.setMessageReaction("😔", messageID, () => {}, true);

  // Create cache directory
  const cacheDir = path.join(__dirname, "cache", "metaai");
  await fs.ensureDir(cacheDir);
  const tempPaths = [];

  try {
    // Prepare API parameters
    const params = {
      message: prompt || "Analyze this image",
      new_conversation: "true"
    };

    if (imageUrl) params.img_url = imageUrl;

    // Call Meta AI API
    const response = await axios.get("https://metakexbyneokex.vercel.app/chat", { 
      params,
      timeout: 60000
    });

    const { success, message: replyText, image_urls, conversation_id } = response.data;

    if (!success) {
      throw new Error("API process failed");
    }

    let sendData = { body: replyText };

    // Handle image generation/editing
    if (image_urls && image_urls.length > 0) {
      const attachments = [];
      for (let i = 0; i < image_urls.length; i++) {
        try {
          const imgPath = path.join(cacheDir, `meta_${Date.now()}_${i}.png`);
          const imgRes = await axios.get(image_urls[i], { 
            responseType: "arraybuffer",
            timeout: 30000
          });
          await fs.writeFile(imgPath, Buffer.from(imgRes.data));
          attachments.push(fs.createReadStream(imgPath));
          tempPaths.push(imgPath);
        } catch (imgErr) {
          console.error("Error downloading image:", imgErr.message);
        }
      }
      if (attachments.length > 0) {
        sendData.attachment = attachments;
      }
    }

    // Send the response
    api.sendMessage(sendData, threadID, (err, info) => {
      if (!err && info) {
        // Store for reply handling
        global.metaReplyHandlers[info.messageID] = {
          commandName: "metaai",
          messageID: info.messageID,
          author: senderID,
          conversation_id: conversation_id
        };
      }
      
      // Clean up temp files
      setTimeout(() => {
        tempPaths.forEach(p => fs.remove(p).catch(() => {}));
      }, 60000);
    }, messageID);

    api.setMessageReaction("✅", messageID, () => {}, true);

  } catch (err) {
    console.error("MetaAI Error:", err);
    api.setMessageReaction("❌", messageID, () => {}, true);
    
    let errorMsg = "❌ Error: " + err.message;
    if (err.code === 'ECONNABORTED') {
      errorMsg = "❌ Request timed out. Please try again.";
    }
    
    api.sendMessage(errorMsg, threadID, messageID);
    
    // Clean up temp files on error
    tempPaths.forEach(p => fs.remove(p).catch(() => {}));
  }
};

// Handle replies to continue conversation
module.exports.handleReply = async function ({ api, event }) {
  const { threadID, messageID, senderID, body, messageReply, attachments } = event;
  
  // Check if this is a reply to our message
  if (!messageReply) return;
  
  const repliedMessageID = messageReply.messageID;
  const handlerData = global.metaReplyHandlers[repliedMessageID];
  
  if (!handlerData || handlerData.author !== senderID) return;
  
  const prompt = body?.trim();
  if (!prompt) return;
  
  // Clear conversation
  if (prompt.toLowerCase() === "clear") {
    api.setMessageReaction("🧹", messageID, () => {}, true);
    delete global.metaReplyHandlers[repliedMessageID];
    return api.sendMessage("✅ Conversation context cleared.", threadID, messageID);
  }
  
  // Get image if attached
  let imageUrl = null;
  if (attachments?.length > 0) {
    const photo = attachments.find(a => a.type === "photo");
    if (photo) {
      imageUrl = photo.url;
    }
  }
  
  api.setMessageReaction("⏳", messageID, () => {}, true);
  
  const cacheDir = path.join(__dirname, "cache", "metaai");
  await fs.ensureDir(cacheDir);
  const tempPaths = [];
  
  try {
    // Prepare API parameters with conversation history
    const params = {
      message: prompt,
      new_conversation: "false",
      conversation_id: handlerData.conversation_id
    };
    
    if (imageUrl) params.img_url = imageUrl;
    
    const response = await axios.get("https://metakexbyneokex.vercel.app/chat", { 
      params,
      timeout: 60000
    });
    
    const { success, message: replyText, image_urls, conversation_id } = response.data;
    
    if (!success) {
      throw new Error("API process failed");
    }
    
    let sendData = { body: replyText };
    
    // Handle image generation
    if (image_urls && image_urls.length > 0) {
      const attachments = [];
      for (let i = 0; i < image_urls.length; i++) {
        try {
          const imgPath = path.join(cacheDir, `meta_${Date.now()}_${i}.png`);
          const imgRes = await axios.get(image_urls[i], { 
            responseType: "arraybuffer",
            timeout: 30000
          });
          await fs.writeFile(imgPath, Buffer.from(imgRes.data));
          attachments.push(fs.createReadStream(imgPath));
          tempPaths.push(imgPath);
        } catch (imgErr) {
          console.error("Error downloading image:", imgErr.message);
        }
      }
      if (attachments.length > 0) {
        sendData.attachment = attachments;
      }
    }
    
    // Send response and store new reply handler
    api.sendMessage(sendData, threadID, (err, info) => {
      if (!err && info) {
        // Update the handler with new conversation ID
        global.metaReplyHandlers[info.messageID] = {
          commandName: "metaai",
          messageID: info.messageID,
          author: senderID,
          conversation_id: conversation_id
        };
      }
      
      // Clean up old handler
      delete global.metaReplyHandlers[repliedMessageID];
      
      // Clean up temp files
      setTimeout(() => {
        tempPaths.forEach(p => fs.remove(p).catch(() => {}));
      }, 60000);
    }, messageID);
    
    api.setMessageReaction("✅", messageID, () => {}, true);
    
  } catch (err) {
    console.error("MetaAI Reply Error:", err);
    api.setMessageReaction("❌", messageID, () => {}, true);
    
    let errorMsg = "❌ Error: " + err.message;
    if (err.code === 'ECONNABORTED') {
      errorMsg = "❌ Request timed out. Please try again.";
    }
    
    api.sendMessage(errorMsg, threadID, messageID);
    tempPaths.forEach(p => fs.remove(p).catch(() => {}));
  }
};
