const axios = require("axios");
const fs = require("fs");
const path = require("path");

module.exports.config = {
  name: "pinterest",
  version: "1.0.0",
  hasPermssion: 0,
  credits: "selov",
  description: "Search images from Pinterest",
  commandCategory: "search",
  usages: "pinterest <search query>",
  cooldowns: 2
};

// Simple memory per thread
const memory = {};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, senderID } = event;
  let query = args.join(" ").trim();

  try {
    // Get sender name
    const user = await api.getUserInfo(senderID);
    const senderName = user[senderID]?.name || "User";

    // Initialize memory
    if (!memory[threadID]) memory[threadID] = [];
    memory[threadID].push(`${senderName} searched Pinterest for: ${query || "nothing"}`);

    if (!query) {
      return api.sendMessage("📌 Please enter a search query.\n\nExample: pinterest cute cats", threadID, messageID);
    }

    api.sendMessage("🔍 Searching Pinterest...", threadID, messageID);

    // Your API with the working key
    const apiUrl = `https://rapido-api.vercel.app/api/pin?search=${encodeURIComponent(query)}&count=6&apikey=zk-f50c8cb6ab9a0932f90abe0ea147959f227845da812fbeb30c8e114950a3ddd4`;
    
    const res = await axios.get(apiUrl);
    
    if (!res.data || !res.data.data || res.data.data.length === 0) {
      return api.sendMessage("❌ No images found for your query.", threadID, messageID);
    }

    const imageUrls = res.data.data; // Array of image URLs
    const attachments = [];
    const imgPaths = [];

    // Create cache directory if it doesn't exist
    const cacheDir = path.join(__dirname, "cache");
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    // Download each image
    for (let i = 0; i < imageUrls.length; i++) {
      try {
        const imageUrl = imageUrls[i];
        const imgPath = path.join(cacheDir, `pinterest_${Date.now()}_${i}.jpg`);
        
        const img = await axios.get(imageUrl, { 
          responseType: "arraybuffer",
          timeout: 15000 
        });

        fs.writeFileSync(imgPath, img.data);
        attachments.push(fs.createReadStream(imgPath));
        imgPaths.push(imgPath);
      } catch (err) {
        console.error(`Error downloading image ${i + 1}:`, err.message);
      }
    }

    if (attachments.length === 0) {
      return api.sendMessage("❌ Failed to download images.", threadID, messageID);
    }

    // Store in memory
    memory[threadID].push(`Found ${attachments.length} images for "${query}"`);

    // Send the images
    api.sendMessage(
      {
        body: `📌 PINTEREST RESULTS\n━━━━━━━━━━━━━━\nQuery: "${query}"\n📸 Found ${attachments.length} image(s)`,
        attachment: attachments
      },
      threadID,
      (err) => {
        if (err) console.error("Error sending message:", err);
        // Clean up files after sending
        imgPaths.forEach(imgPath => {
          try {
            if (fs.existsSync(imgPath)) {
              fs.unlinkSync(imgPath);
            }
          } catch (e) {
            console.error("Error deleting file:", e);
          }
        });
      },
      messageID
    );

  } catch (err) {
    console.error("Pinterest Command Error:", err);
    
    api.sendMessage(
      `❌ Error: ${err.message}`,
      threadID,
      messageID
    );
  }
};
