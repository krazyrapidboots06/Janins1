const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

const apiUrl = "https://raw.githubusercontent.com/Saim-x69x/sakura/main/ApiUrl.json";

async function getApiUrl() {
  try {
    const res = await axios.get(apiUrl);
    return res.data.apiv3; // Returns the generate endpoint
  } catch (error) {
    console.error("Error fetching API URL:", error.message);
    throw new Error("Failed to fetch API configuration");
  }
}

async function urlToBase64(url) {
  try {
    const res = await axios.get(url, { 
      responseType: "arraybuffer",
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    return Buffer.from(res.data).toString("base64");
  } catch (error) {
    console.error("Error converting image to base64:", error.message);
    throw new Error("Failed to process the image");
  }
}

module.exports = {
  config: {
    name: "edit",
    version: "1.1",
    author: "NC-Saimx69x", //API by Kay
    countDown: 5,
    role: 0,
    shortDescription: "Edit an image using text prompt",
    longDescription: "Only edits an existing image. Must reply to an image.",
    guide: "{p}edit <prompt> (reply to an image)"
  },

  onStart: async function ({ api, event, args, message }) {
    const repliedImage = event.messageReply?.attachments?.[0];
    const prompt = args.join(" ").trim();

    // Validate input
    if (!repliedImage || repliedImage.type !== "photo") {
      return message.reply(
        "❌ Please reply to an image to edit it.\n\n**Example:**\n/edit make it anime style"
      );
    }

    if (!prompt) {
      return message.reply("❌ Please provide an edit prompt.");
    }

    // Send processing message
    const processingMsg = await message.reply("🖌️ Editing image... (This may take 30-60 seconds)");

    const imgPath = path.join(
      __dirname,
      "cache",
      `edit_${Date.now()}.jpg`
    );

    try {
      // Ensure cache directory exists
      await fs.ensureDir(path.join(__dirname, "cache"));

      // Get the API endpoint
      const API_URL = await getApiUrl();
      
      console.log("Using API:", API_URL); // Debug log

      // Prepare the payload - adjusted format based on typical image generation APIs
      const payload = {
        prompt: prompt,
        image_data: await urlToBase64(repliedImage.url),
        format: "jpg",
        negative_prompt: "blurry, bad quality, distorted",
        strength: 0.7, // How much to transform the image (0-1)
        guidance_scale: 7.5
      };

      // Make the API request with proper headers
      const res = await axios.post(API_URL, payload, {
        responseType: "arraybuffer",
        timeout: 180000, // 3 minutes timeout
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'image/jpeg',
          'User-Agent': 'Mozilla/5.0'
        }
      });

      // Check if response is valid
      if (!res.data || res.data.length < 1000) {
        throw new Error("Received invalid image data");
      }

      // Save the edited image
      await fs.writeFile(imgPath, Buffer.from(res.data));

      // Delete processing message
      await api.unsendMessage(processingMsg.messageID);

      // Send the edited image
      await message.reply({
        body: `✅ **Image edited successfully!**\n━━━━━━━━━━━━━━━━\n**Prompt:** ${prompt}\n**Status:** Complete`,
        attachment: fs.createReadStream(imgPath)
      });

    } catch (error) {
      console.error("Edit Command Error:", error);
      
      // Detailed error handling
      let errorMessage = "❌ Failed to edit image. ";
      
      if (error.response) {
        // The request was made and the server responded with a status code outside of 2xx
        errorMessage += `Server responded with status ${error.response.status}`;
        console.log("Error response data:", error.response.data?.toString());
      } else if (error.request) {
        // The request was made but no response was received
        errorMessage += "No response from server (timeout)";
      } else {
        // Something happened in setting up the request
        errorMessage += error.message;
      }

      // Delete processing message if it exists
      if (processingMsg?.messageID) {
        await api.unsendMessage(processingMsg.messageID);
      }
      
      await message.reply(errorMessage);
      
    } finally {
      // Clean up: delete the temporary image file
      if (await fs.pathExists(imgPath)) {
        await fs.remove(imgPath);
      }
    }
  }
};
