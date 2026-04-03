const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

module.exports.config = {
  name: "goodbye",
  version: "2.0.0",
  role: 0,
  credits: "selov",
  description: "Sends goodbye message when members leave",
  commandCategory: "events",
  cooldowns: 0,
  eventType: ["log:unsubscribe"]
};

module.exports.handleEvent = async function ({ api, event }) {
  const { threadID, logMessageData, logMessageType } = event;
  
  // Check if this is an unsubscribe event
  if (logMessageType !== "log:unsubscribe") return;
  
  const leftID = logMessageData.leftParticipantFbId;
  
  // Don't send goodbye for bot itself
  if (leftID === api.getCurrentUserID()) return;
  
  try {
    // Get user info
    const userInfo = await api.getUserInfo(leftID);
    let userName = userInfo[leftID]?.name || "Member";
    
    // Truncate long names
    const maxLength = 20;
    if (userName.length > maxLength) {
      userName = userName.substring(0, maxLength - 3) + '...';
    }
    
    // Get group info
    const groupInfo = await api.getThreadInfo(threadID);
    const groupName = groupInfo.threadName || "this group";
    const memberCount = groupInfo.participantIDs?.length || 0;
    
    // Create cache directory
    const cacheDir = path.join(__dirname, 'cache', 'goodbye');
    await fs.ensureDir(cacheDir);
    
    // Try to generate goodbye image
    let imagePath = null;
    
    try {
      // Goodbye image API URL
      const avatarUrl = `https://graph.facebook.com/${leftID}/picture?width=500&height=500`;
      const backgroundUrl = groupInfo.imageSrc || "https://i.imgur.com/9FEXNfN.jpeg";
      
      const url = `https://ace-rest-api.onrender.com/api/goodbye?pp=${encodeURIComponent(avatarUrl)}&nama=${encodeURIComponent(userName)}&bg=${encodeURIComponent(backgroundUrl)}&member=${memberCount}&uid=${leftID}`;
      
      const response = await axios.get(url, { 
        responseType: 'arraybuffer',
        timeout: 15000
      });
      
      imagePath = path.join(cacheDir, `goodbye_${leftID}_${Date.now()}.jpg`);
      fs.writeFileSync(imagePath, Buffer.from(response.data));
      
    } catch (imgErr) {
      console.error("Goodbye image error:", imgErr.message);
      // Continue without image
    }
    
    // Prepare goodbye message
    const goodbyeMessage = 
      `❀•°•═════ஓ๑♡๑ஓ═════•°•❀\n\n` +
      `                 R.I.P\n\n` +
      `               Fly High\n\n` +
      `     𝐂𝐀𝐔𝐒𝐄 𝐎𝐅 𝐃𝐄𝐀𝐓𝐇:\n\n` +
      `          NAG LEAVE SA GC\n\n` +
      `                 ${userName}\n\n` +
      `       🕊️ 𝑖𝑛 𝑙𝑜𝑣𝑖𝑛𝑔 𝑚𝑒𝑚𝑜𝑟𝑖𝑒𝑠 🕊️\n\n` +
      `❀•°•═════ஓ๑♡๑ஓ═════•°•❀\n\n` +
      ` ${userName} has left ${groupName}.\n` +
      `We'll miss you!`;
    
    // Send message with or without image
    if (imagePath && fs.existsSync(imagePath)) {
      await api.sendMessage({
        body: goodbyeMessage,
        attachment: fs.createReadStream(imagePath)
      }, threadID);
      
      // Clean up image file
      setTimeout(() => {
        try {
          if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
          }
        } catch (e) {}
      }, 10000);
      
    } else {
      // Fallback: send text only
      await api.sendMessage(goodbyeMessage, threadID);
    }
    
  } catch (err) {
    console.error("Goodbye event error:", err.message);
    
    // Fallback: Simple goodbye message
    try {
      const userInfo = await api.getUserInfo(leftID);
      const userName = userInfo[leftID]?.name || "A member";
      const groupInfo = await api.getThreadInfo(threadID);
      const groupName = groupInfo.threadName || "the group";
      
      await api.sendMessage(` ${userName} has left ${groupName}. We'll miss you!`, threadID);
    } catch (e) {
      console.error("Fallback message failed:", e);
    }
  }
};
