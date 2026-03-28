const { createCanvas, loadImage } = require('canvas');
const fs = require('fs-extra');
const path = require('path');
const axios = require("axios");

const backgroundImages = [
    "https://i.imgur.com/XVRFwns.jpeg",
    "https://i.imgur.com/DXXvgjb.png",
    "https://i.imgur.com/LwoDuzZ.jpeg",
    "https://i.imgur.com/mtSrSYh.jpeg",
    "https://i.imgur.com/IVvEBc4.jpeg",
    "https://i.imgur.com/uJcd1bf.jpeg"
];

const backgroundCache = new Map();

async function loadBackgroundImage(url) {
    if (backgroundCache.has(url)) return backgroundCache.get(url);

    try {
        const response = await axios.get(url, {
            responseType: "arraybuffer",
            headers: { "User-Agent": "Mozilla/5.0" }
        });

        const img = await loadImage(Buffer.from(response.data));
        backgroundCache.set(url, img);
        return img;

    } catch (error) {
        console.error("[WELCOME] Failed to load background:", url, error.message);
        return null;
    }
}

async function drawProfileImage(ctx, imageUrl, x, y, size, borderColor) {
    const radius = size / 2;

    try {
        const response = await axios.get(imageUrl, {
            responseType: "arraybuffer",
            headers: { "User-Agent": "Mozilla/5.0" }
        });

        const img = await loadImage(Buffer.from(response.data));

        ctx.shadowColor = borderColor;
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(x, y, radius + 5, 0, Math.PI * 2);
        ctx.fillStyle = borderColor;
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.beginPath();
        ctx.arc(x, y, radius + 3, 0, Math.PI * 2);
        ctx.fillStyle = borderColor;
        ctx.fill();

        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.clip();

        ctx.drawImage(img, x - radius, y - radius, size, size);
        ctx.restore();

        return true;

    } catch (error) {
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = '#374151';
        ctx.fill();

        ctx.fillStyle = borderColor;
        ctx.font = `bold ${radius * 0.6}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('👤', x, y);
        return false;
    }
}

async function createWelcomeCard(gcImg, userImg, adderImg, userName, userNumber, threadName, adderName) {
    const width = 1200;
    const height = 700;

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    const selectedBackground = backgroundImages[Math.floor(Math.random() * backgroundImages.length)];
    console.log("[WELCOME] Using background:", selectedBackground);

    const background = await loadBackgroundImage(selectedBackground);

    if (background) {
        ctx.drawImage(background, 0, 0, width, height);
    } else {
        ctx.fillStyle = "#1a1a2e";
        ctx.fillRect(0, 0, width, height);
    }

    // Add overlay for better text readability
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(0, 0, width, height);
    
    // Draw profile images
    await Promise.all([
        drawProfileImage(ctx, gcImg, width / 2, 200, 200, "#ffffff"),
        drawProfileImage(ctx, userImg, 120, height - 100, 150, "#10b981"),
        drawProfileImage(ctx, adderImg, width - 120, 100, 150, "#3b82f6")
    ]);

    // Draw group name
    ctx.font = 'bold 36px "Segoe UI", Arial';
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.fillText(threadName, width / 2, 350);

    // Draw WELCOME text with gradient
    const welcomeGradient = ctx.createLinearGradient(width/2 - 180, 360, width/2 + 180, 360);
    welcomeGradient.addColorStop(0, "#3b82f6");
    welcomeGradient.addColorStop(0.5, "#10b981");
    welcomeGradient.addColorStop(1, "#ec4899");

    ctx.font = 'bold 72px "Segoe UI", Arial';
    ctx.fillStyle = welcomeGradient;
    ctx.fillText("WELCOME", width / 2, 450);

    // Draw underline
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(width / 2 - 150, 420);
    ctx.lineTo(width / 2 + 150, 420);
    ctx.stroke();

    // Draw user name
    ctx.font = 'bold 48px "Segoe UI", Arial';
    ctx.fillStyle = "#10b981";
    ctx.fillText(userName, width / 2, 500);

    // Draw member number
    ctx.font = 'bold 28px "Segoe UI", Arial';
    ctx.fillStyle = "#e2e8f0";
    ctx.fillText(`Member #${userNumber}`, width / 2, 585);
    
    // Draw user name near avatar
    ctx.textAlign = "left";
    ctx.fillStyle = "#10b981";
    ctx.font = 'bold 26px "Segoe UI", Arial';
    ctx.fillText(userName, 220, height - 95);

    // Draw adder info
    ctx.textAlign = "right";
    ctx.fillStyle = "#3b82f6";
    ctx.font = 'bold 22px "Segoe UI", Arial';
    ctx.fillText(`Added by: ${adderName}`, width - 220, 105);

    // Draw footer
    ctx.font = '18px "Segoe UI"';
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.fillText("© Welcome Bot", width - 10, height - 10);

    return canvas.toBuffer();
}

module.exports.config = {
    name: "welcome",
    version: "2.0.0",
    role: 0,
    credits: "selov",
    description: "Sends welcome image when new members join",
    commandCategory: "events",
    cooldowns: 0,
    eventType: ["log:subscribe"]
};

module.exports.handleEvent = async function ({ api, event }) {
    const { threadID, logMessageData, author } = event;
    
    // Check if this is a subscribe event
    if (event.logMessageType !== "log:subscribe") return;
    
    const addedParticipants = logMessageData.addedParticipants || [];
    
    for (const user of addedParticipants) {
        const addedUserId = user.userFbId;
        
        // Don't send welcome for bot itself
        if (addedUserId === api.getCurrentUserID()) continue;
        
        try {
            // Get thread info
            const threadInfo = await api.getThreadInfo(threadID);
            const groupName = threadInfo.threadName || "Group";
            const memberCount = threadInfo.participantIDs.length;
            
            // Get user info
            const userInfo = await api.getUserInfo(addedUserId);
            const userName = userInfo[addedUserId]?.name || user.fullName || "New Member";
            
            // Get adder info (who added the member)
            let adderName = "Someone";
            try {
                const adderInfo = await api.getUserInfo(author);
                adderName = adderInfo[author]?.name || "Someone";
            } catch (e) {
                adderName = "Someone";
            }
            
            // Get profile picture URLs
            const userAvatar = `https://graph.facebook.com/${addedUserId}/picture?width=500&height=500`;
            const adderAvatar = `https://graph.facebook.com/${author}/picture?width=500&height=500`;
            const groupImage = threadInfo.imageSrc || "https://i.imgur.com/7Qk8k6c.png";
            
            // Create welcome image
            const imageBuffer = await createWelcomeCard(
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
            
            const tempPath = path.join(cacheDir, `welcome_${addedUserId}_${Date.now()}.png`);
            fs.writeFileSync(tempPath, imageBuffer);
            
            // Send welcome message with image
            const welcomeMsg = `🌸 **WELCOME!** 🌸\n━━━━━━━━━━━━━━━━━━━━━━\n🌷 **Name:** ${userName}\n🏷️ **Group:** ${groupName}\n🔢 **Member #${memberCount}**\n👤 **Added by:** ${adderName}\n━━━━━━━━━━━━━━━━━━━━━━\n**Enjoy your stay!** 😊`;
            
            await api.sendMessage({
                body: welcomeMsg,
                attachment: fs.createReadStream(tempPath)
            }, threadID);
            
            // Clean up file after sending
            setTimeout(() => {
                try {
                    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
                } catch (e) {}
            }, 10000);
            
        } catch (error) {
            console.error("[Welcome error]:", error.message);
            
            // Fallback: Send text-only welcome if image fails
            try {
                const fallbackMsg = `🌸 **Welcome ${user.fullName || "New Member"}!** 🌸\n━━━━━━━━━━━━━━━━━━\n🌷 **To our group family!**\n🌟 **We're excited to have you!**\n━━━━━━━━━━━━━━━━━━\n**Have fun!** 😊`;
                await api.sendMessage(fallbackMsg, threadID);
            } catch (e) {
                console.error("Fallback message failed:", e);
            }
        }
    }
};
