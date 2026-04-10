const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

module.exports.config = {
  name: "goodbye",
  version: "5.0.0",
  role: 0,
  credits: "selov",
  description: "Sends goodbye message with Facebook profile image",
  commandCategory: "events",
  cooldowns: 0,
  eventType: ["log:unsubscribe"]
};

// Facebook access token (use your own or this public one)
// You can get token from: https://developers.facebook.com/tools/explorer/
const FB_ACCESS_TOKEN = "6628568379%7Cc1e620fa708a1d5696fb991c1bde5662";

// Get Facebook profile picture URL
function getProfilePictureUrl(uid) {
  return `https://graph.facebook.com/${uid}/picture?width=200&height=200&access_token=${FB_ACCESS_TOKEN}`;
}

// Create goodbye image with Facebook profile picture
async function createGoodbyeImage(profileImageUrl, userName, memberCount) {
  const width = 500;
  const height = 280;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  // Background (dark theme)
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, width, height);
  
  // Border
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, width - 20, height - 20);
  
  // Left side: Square frame for profile picture (120x120)
  const frameX = 45;
  const frameY = (height - 120) / 2;
  const frameSize = 120;
  
  // Draw white border frame
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.strokeRect(frameX, frameY, frameSize, frameSize);
  
  // Inner border (tech-like)
  ctx.strokeStyle = '#22c55e';
  ctx.lineWidth = 1;
  ctx.strokeRect(frameX + 5, frameY + 5, frameSize - 10, frameSize - 10);
  
  // Try to load and draw Facebook profile picture
  try {
    // Get the profile picture URL that redirects to actual image
    const response = await axios.get(profileImageUrl, { 
      responseType: 'arraybuffer',
      timeout: 10000,
      maxRedirects: 5
    });
    
    const profileImg = await loadImage(Buffer.from(response.data));
    
    // Draw image inside the frame
    ctx.drawImage(profileImg, frameX, frameY, frameSize, frameSize);
    
    // Overlay a slight gradient for tech feel
    const gradient = ctx.createLinearGradient(frameX, frameY, frameX + frameSize, frameY + frameSize);
    gradient.addColorStop(0, 'rgba(34, 197, 94, 0.1)');
    gradient.addColorStop(1, 'rgba(34, 197, 94, 0.05)');
    ctx.fillStyle = gradient;
    ctx.fillRect(frameX, frameY, frameSize, frameSize);
    
  } catch (err) {
    console.error("Profile image load error:", err.message);
    
    // Draw placeholder (grey silhouette) if image fails
    ctx.fillStyle = '#334155';
    ctx.fillRect(frameX, frameY, frameSize, frameSize);
    
    // Draw silhouette of a person
    ctx.fillStyle = '#64748b';
    // Head
    ctx.beginPath();
    ctx.arc(frameX + frameSize/2, frameY + frameSize * 0.35, 25, 0, Math.PI * 2);
    ctx.fill();
    // Body
    ctx.beginPath();
    ctx.ellipse(frameX + frameSize/2, frameY + frameSize * 0.65, 30, 35, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Question mark
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 40px "Arial"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', frameX + frameSize/2, frameY + frameSize/2);
  }
  
  // Right side: Text
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 32px "Arial"';
  ctx.textAlign = 'left';
  ctx.fillText('GOODBYE', 190, 85);
  
  // Line separator
  ctx.strokeStyle = '#22c55e';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(190, 110);
  ctx.lineTo(440, 110);
  ctx.stroke();
  
  // Username
  ctx.font = '22px "Arial"';
  ctx.fillStyle = '#e2e8f0';
  ctx.fillText(`${userName}...`, 190, 160);
  
  // Member count
  ctx.font = '18px "Arial"';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(`${memberCount}th member`, 190, 210);
  
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
    if (userName.length > 18) {
      userName = userName.substring(0, 15) + '...';
    }
    
    // Get group info
    const groupInfo = await api.getThreadInfo(threadID);
    const memberCount = groupInfo.participantIDs?.length || 0;
    
    // Get Facebook profile picture URL
    const profileImageUrl = getProfilePictureUrl(leftID);
    
    // Create goodbye image
    const imageBuffer = await createGoodbyeImage(profileImageUrl, userName, memberCount);
    
    // Create cache directory
    const cacheDir = path.join(__dirname, 'cache', 'goodbye');
    await fs.ensureDir(cacheDir);
    
    const imagePath = path.join(cacheDir, `goodbye_${leftID}_${Date.now()}.png`);
    fs.writeFileSync(imagePath, imageBuffer);
    
    // Send the image
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
    
    // Fallback: simple text
    try {
      const userInfo = await api.getUserInfo(leftID);
      const userName = userInfo[leftID]?.name || "A member";
      const groupInfo = await api.getThreadInfo(threadID);
      const memberCount = groupInfo.participantIDs?.length || 0;
      
      await api.sendMessage(`GOODBYE\n\n${userName}...\n\n${memberCount}th member`, threadID);
    } catch (e) {}
  }
};
