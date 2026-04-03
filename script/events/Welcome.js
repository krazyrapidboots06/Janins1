const {
  createCanvas,
  loadImage,
  registerFont
} = require('canvas');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');

module.exports.config = {
  name: "welcome",
  version: "4.0.0",
  role: 0,
  credits: "selov",
  description: "Sends welcome image when new members join",
  commandCategory: "events",
  cooldowns: 0,
  eventType: ["log:subscribe"]
};

// Helper: Load image with timeout and fallback
async function loadImageWithFallback(url, fallbackUrl = "https://i.imgur.com/7Qk8k6c.png") {
  try {
    const response = await axios.get(url, { 
      responseType: 'arraybuffer', 
      timeout: 10000 
    });
    const img = await loadImage(Buffer.from(response.data));
    return img;
  } catch (err) {
    console.error(`Failed to load image: ${url}`, err.message);
    try {
      const fallbackResponse = await axios.get(fallbackUrl, { responseType: 'arraybuffer', timeout: 5000 });
      return await loadImage(Buffer.from(fallbackResponse.data));
    } catch (e) {
      return null;
    }
  }
}

// Draw circular image
async function drawCircularImage(ctx, imageUrl, x, y, radius, borderColor, borderWidth = 5) {
  const img = await loadImageWithFallback(imageUrl);
  
  if (!img) {
    // Draw placeholder circle
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#374151';
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${radius}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', x, y);
    return;
  }
  
  // Draw border
  ctx.shadowColor = borderColor;
  ctx.shadowBlur = 15;
  ctx.beginPath();
  ctx.arc(x, y, radius + borderWidth, 0, Math.PI * 2);
  ctx.fillStyle = borderColor;
  ctx.fill();
  ctx.shadowBlur = 0;
  
  // Draw inner border
  ctx.beginPath();
  ctx.arc(x, y, radius + borderWidth - 2, 0, Math.PI * 2);
  ctx.fillStyle = borderColor;
  ctx.fill();
  
  // Clip and draw image
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(img, x - radius, y - radius, radius * 2, radius * 2);
  ctx.restore();
}

// Draw text with stroke
function drawTextWithStroke(ctx, text, x, y, fontSize, color, align = 'center') {
  ctx.font = `bold ${fontSize}px "NotoSans", "Arial", sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 3;
  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);
}

// Create welcome canvas
async function createWelcomeCanvas(gcImg, userImg, adderImg, userName, userNumber, threadName, adderName) {
  const width = 800;
  const height = 500;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  // Background gradient
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#0f172a');
  gradient.addColorStop(1, '#1e1b4b');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  
  // Decorative circles
  ctx.fillStyle = 'rgba(34, 197, 94, 0.1)';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(width - 50 + i * 30, height - 50, 80, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Draw group avatar (center top)
  await drawCircularImage(ctx, gcImg, width / 2, 130, 60, '#22c55e', 5);
  
  // Draw group name
  drawTextWithStroke(ctx, threadName, width / 2, 220, 24, '#ffffff');
  
  // Draw WELCOME text
  const welcomeGradient = ctx.createLinearGradient(width / 2 - 150, 0, width / 2 + 150, 0);
  welcomeGradient.addColorStop(0, '#4ade80');
  welcomeGradient.addColorStop(1, '#22c55e');
  drawTextWithStroke(ctx, 'WELCOME', width / 2, 270, 42, welcomeGradient);
  
  // Draw member number
  drawTextWithStroke(ctx, `#${userNumber} Member`, width / 2, 320, 20, '#94a3b8');
  
  // Draw user avatar (bottom left)
  await drawCircularImage(ctx, userImg, 120, height - 80, 45, '#16a34a', 4);
  
  // Draw user name
  ctx.font = `bold 18px "NotoSans", "Arial", sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.fillText(userName, 180, height - 70);
  
  // Draw adder avatar (top right)
  await drawCircularImage(ctx, adderImg, width - 120, 70, 35, '#3b82f6', 3);
  
  // Draw "Added by" text
  ctx.font = `12px "NotoSans", "Arial", sans-serif`;
  ctx.fillStyle = '#94a3b8';
  ctx.textAlign = 'right';
  ctx.fillText(`Added by: ${adderName}`, width - 80, 75);
  
  // Border
  ctx.strokeStyle = '#22c55e';
  ctx.lineWidth = 3;
  ctx.strokeRect(10, 10, width - 20, height - 20);
  
  return canvas.toBuffer();
}

module.exports.handleEvent = async function ({ api, event }) {
  const { threadID, logMessageType, logMessageData } = event;
  
  if (logMessageType !== "log:subscribe") return;
  
  const addedParticipants = logMessageData.addedParticipants || [];
  
  for (const user of addedParticipants) {
    const addedUserId = user.userFbId;
    
    if (addedUserId === api.getCurrentUserID()) continue;
    
    try {
      // Get thread info
      const threadInfo = await api.getThreadInfo(threadID);
      const groupName = threadInfo.threadName || "Group";
      const memberCount = threadInfo.participantIDs?.length || 1;
      const groupImage = threadInfo.imageSrc || "https://i.imgur.com/7Qk8k6c.png";
      
      // Get user info
      const userInfo = await api.getUserInfo(addedUserId);
      const userName = userInfo[addedUserId]?.name || user.fullName || "New Member";
      
      // Get adder info
      let adderName = "Someone";
      let adderId = event.author;
      try {
        const adderInfo = await api.getUserInfo(adderId);
        adderName = adderInfo[adderId]?.name || "Someone";
      } catch (e) {}
      
      // Profile picture URLs with access token
      const accessToken = "6628568379%7Cc1e620fa708a1d5696fb991c1bde5662";
      const userAvatar = `https://graph.facebook.com/${addedUserId}/picture?width=500&height=500&access_token=${accessToken}`;
      const adderAvatar = `https://graph.facebook.com/${adderId}/picture?width=500&height=500&access_token=${accessToken}`;
      
      // Send processing message
      const processingMsg = await api.sendMessage("🎨 Generating welcome image...", threadID);
      
      // Create welcome image
      const imageBuffer = await createWelcomeCanvas(
        groupImage,
        userAvatar,
        adderAvatar,
        userName,
        memberCount,
        groupName,
        adderName
      );
      
      // Create cache directory
      const cacheDir = path.join(__dirname, 'cache', 'welcome');
      await fs.ensureDir(cacheDir);
      
      const imagePath = path.join(cacheDir, `welcome_${addedUserId}_${Date.now()}.png`);
      fs.writeFileSync(imagePath, imageBuffer);
      
      // Delete processing message
      await api.unsendMessage(processingMsg.messageID);
      
      // Send welcome message with image
      const welcomeMessage = 
        `🎉 **WELCOME!** 🎉\n━━━━━━━━━━━━━━━━\n` +
        `👤 **${userName}**\n` +
        `🏷️ **${groupName}**\n` +
        `🔢 **Member #${memberCount}**\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `🎊 Enjoy your stay! 🎊`;
      
      await api.sendMessage({
        body: welcomeMessage,
        attachment: fs.createReadStream(imagePath)
      }, threadID);
      
      // Clean up
      setTimeout(() => {
        try {
          if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
        } catch (e) {}
      }, 10000);
      
    } catch (err) {
      console.error("Welcome error:", err.message);
      
      // Fallback: text only
      try {
        const fallbackMsg = `🎉 Welcome ${user.fullName || "New Member"} to the group! 🎉`;
        await api.sendMessage(fallbackMsg, threadID);
      } catch (e) {}
    }
  }
};
