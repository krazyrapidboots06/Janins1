const axios = require("axios");
const fs = require("fs");
const path = require("path");

module.exports.config = {
  name: "pinterest",
  version: "1.0.0",
  hasPermssion: 0,
  credits: "Yasis",
  description: "Search and download images from Pinterest",
  commandCategory: "search",
  usages: "pinterest <query>",
  cooldowns: 5
};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID } = event;
  const query = args.join(" ");

  if (!query) {
    return api.sendMessage(
      "📌 Please enter a search query.\n\nExample:\n pinterest cat",
      threadID,
      messageID
    );
  }

  try {
    api.sendMessage("🔍 Searching Pinterest... please wait.", threadID, messageID);

    const apiUrl = `https://deku-api.giize.com/search/pinterest?q=${encodeURIComponent(query)}`;
    const res = await axios.get(apiUrl);

    // Debug: Log the response structure to see what we're getting
    console.log("API Response:", JSON.stringify(res.data, null, 2));

    // Check different possible response structures
    let pins = [];
    
    if (res.data?.result?.result?.pins) {
      pins = res.data.result.result.pins;
    } else if (res.data?.result?.pins) {
      pins = res.data.result.pins;
    } else if (res.data?.pins) {
      pins = res.data.pins;
    } else if (res.data?.data) {
      pins = res.data.data;
    } else if (Array.isArray(res.data)) {
      pins = res.data;
    }

    if (!pins || pins.length === 0) {
      return api.sendMessage("❌ No images found for your query.", threadID, messageID);
    }

    // Limit to first 6 images (to avoid too many attachments)
    pins = pins.slice(0, 6);
    const attachments = [];
    const imgPaths = [];

    // Create cache directory if it doesn't exist
    const cacheDir = path.join(__dirname, "cache");
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    for (let i = 0; i < pins.length; i++) {
      try {
        // Try to extract image URL from different possible structures
        let imageUrl = null;
        
        if (pins[i].media?.images?.large?.url) {
          imageUrl = pins[i].media.images.large.url;
        } else if (pins[i].images?.large?.url) {
          imageUrl = pins[i].images.large.url;
        } else if (pins[i].image?.url) {
          imageUrl = pins[i].image.url;
        } else if (pins[i].url) {
          imageUrl = pins[i].url;
        } else if (typeof pins[i] === 'string' && pins[i].startsWith('http')) {
          imageUrl = pins[i];
        }

        if (!imageUrl) {
          console.log("No image URL found for pin:", pins[i]);
          continue;
        }

        const imgPath = path.join(cacheDir, `pinterest_${Date.now()}_${i}.jpg`);
        
        const img = await axios.get(imageUrl, { 
          responseType: "arraybuffer",
          timeout: 10000 
        });

        fs.writeFileSync(imgPath, img.data);
        attachments.push(fs.createReadStream(imgPath));
        imgPaths.push(imgPath);
      } catch (err) {
        console.error(`Error downloading image ${i}:`, err.message);
      }
    }

    if (attachments.length === 0) {
      return api.sendMessage("❌ Failed to download any images.", threadID, messageID);
    }

    api.sendMessage(
      {
        body: `📌 Pinterest Search Results\n━━━━━━━━━━━━━━\nQuery: "${query}"\n📸 Found ${attachments.length} images`,
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
      `❌ Error searching Pinterest: ${err.message}`,
      threadID,
      messageID
    );
  }
};
