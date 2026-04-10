const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

module.exports.config = {
  name: "goodbye",
  version: "4.0.0",
  role: 0,
  credits: "selov",
  description: "Sends goodbye message with profile image on left",
  commandCategory: "events",
  cooldowns: 0,
  eventType: ["log:unsubscribe"]
};

// Create goodbye image with profile picture on left
async function createGoodbyeImage(profileImageUrl, userName, memberCount) {
  const width = 500;
  const height = 300;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  // Background color (dark theme)
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, width, height);
  
  // Border
  ctx.strokeStyle = '#22c55e';
  ctx.lineWidth = 3;
  ctx.strokeRect(10, 10, width - 20, height - 20);
  
  // Load and draw profile picture (left side, square)
  try {
    const response = await axios.get(profileImageUrl, { responseType: 'arraybuffer' });
    const profileImg = await loadImage(Buffer.from(response.data));
    
    // Square profile image on left (50x50)
    const imgSize = 80;
    const imgX = 40;
    const imgY = (height - imgSize) / 2;
    
    // Draw image in square
    ctx.drawImage(profileImg, imgX, imgY, imgSize, imgSize);
    
    // Draw border around image
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(imgX, imgY, imgSize, imgSize);
    
  } catch (err) {
    console.error("Profile image error:", err.message);
    // Draw placeholder if image fails
    ctx.fillStyle = '#374151';
    ctx.fillRect(40, (height - 80) / 2, 80, 80);
    ctx.fillStyle = '#ffffff';
    ctx.font = '40px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('?', 80, (height / 2) + 10);
  }
  
  // Draw text (right side of profile image)
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px "Arial"';
  ctx.textAlign = 'left';
  ctx.fillText('GOODBYE', 150, 80);
  
  ctx.font = '20px "Arial"';
  ctx.fillStyle = '#e2e8f0';
  ctx.fillText(`${userName}...`, 150, 140);
  
  ctx.font = '18px "Arial"';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(`${memberCount}th member`, 150, 190);
  
  // Small decoration line
  ctx.strokeStyle = '#22c55e';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(150, 110);
  ctx.lineTo(450, 110);
  ctx.stroke();
  
  return canvas.toBuffer();
}

module.exports.handleEvent = async function ({ api, event }) {
  const { threadID, logMessageData, logMessageType } = event;
  
  if (logMessageType !== "log:unsubscribe") return;
  
  const leftID = logMessageData.leftParticipantFbId;
  
  if (leftID === api.getCurrentUserID()) return;
  
  try {
    // Get user info
    const userInfo = await api.getUserInfo(leftID);
    let userName = userInfo[leftID]?.name || "Facebook user";
    
    // Truncate long names
    if (userName.length > 20) {
      userName = userName.substring(0, 17) + '...';
    }
    
    // Get group info
    const groupInfo = await api.getThreadInfo(threadID);
    const memberCount = groupInfo.participantIDs?.length || 0;
    
    // Profile picture URL with access token
    const profileImageUrl = `https://graph.facebook.com/${leftID}/picture?width=200&height=200&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`;
    
    // Create goodbye image
    const imageBuffer = await createGoodbyeImage(profileImageUrl, userName, memberCount);
    
    // Create cache directory
    const cacheDir = path.join(__dirname, 'cache', 'goodbye');
    await fs.ensureDir(cacheDir);
    
    const imagePath = path.join(cacheDir, `goodbye_${leftID}_${Date.now()}.png`);
    fs.writeFileSync(imagePath, imageBuffer);
    
    // Send the image (no text, just the image)
    await api.sendMessage({
      attachment: fs.createReadStream(imagePath)
    }, threadID);
    
    // Clean up
    setTimeout(() => {
      try {
        if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
      } catch (e) {}
    }, 10000);
    
  } catch (err) {
    console.error("Goodbye error:", err.message);
    
    // Fallback: simple text message
    try {
      const userInfo = await api.getUserInfo(leftID);
      const userName = userInfo[leftID]?.name || "A member";
      const groupInfo = await api.getThreadInfo(threadID);
      const memberCount = groupInfo.participantIDs?.length || 0;
      
      await api.sendMessage(`GOODBYE\n\n${userName}...\n\n${memberCount}th member`, threadID);
    } catch (e) {}
  }
};
