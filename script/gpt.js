const axios = require("axios");

// Configuration file URL
const CONFIG_URL = "https://raw.githubusercontent.com/Saim-x69x/sakura/main/ApiUrl.json";

// Main command module
module.exports = {
  config: {
    name: "gpt",
    version: "2.0",
    author: "System",
    countDown: 3,
    role: 0,
    shortDescription: "Chat with GPT AI",
    longDescription: "Interact with AI using multiple API endpoints",
    guide: "{p}gpt <your question>"
  },

  onStart: async function ({ api, event, args, message }) {
    const userQuestion = args.join(" ").trim();

    if (!userQuestion) {
      return message.reply(
        "❌ Please provide a question.\n\n**Example:**\n/gpt what is the meaning of life?"
      );
    }

    // Fetch API endpoints
    let endpoints;
    try {
      const response = await axios.get(CONFIG_URL);
      endpoints = response.data;
    } catch (error) {
      console.error("Failed to fetch API config:", error.message);
      return message.reply("❌ Failed to load API configuration. The config server might be down.");
    }

    // Send initial "thinking" message
    const processingMsg = await message.reply("🤔 GPT is thinking...");

    // Define APIs with their specific configurations
    const apis = [
      {
        name: "GPT-1",
        url: endpoints.apiv3, // This is already a full /generate endpoint
        method: "POST",
        headers: { "Content-Type": "application/json" },
        formatRequest: (prompt) => ({ prompt: prompt, max_tokens: 300 }),
        extractResponse: (data) => data.response || data.text || data.message || data.generated_text
      },
      {
        name: "Saim AI",
        url: `${endpoints.apiv1}/chat`,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        formatRequest: (prompt) => ({ question: prompt, temperature: 0.7 }),
        extractResponse: (data) => data.answer || data.response || data.message || data.text
      },
      {
        name: "Goat AI",
        url: `${endpoints.apiv4}/ask`,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        formatRequest: (prompt) => ({ query: prompt }),
        extractResponse: (data) => data.response || data.message || data.answer
      },
      {
        name: "ZetBot",
        url: `${endpoints.apiv5}/ai`,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        formatRequest: (prompt) => ({ text: prompt }),
        extractResponse: (data) => data.reply || data.text || data.message || data.response
      },
      {
        name: "Gist AI",
        url: `${endpoints.gist}/chat`,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        formatRequest: (prompt) => ({ message: prompt }),
        extractResponse: (data) => data.reply || data.message || data.text
      }
    ];

    let lastError = null;

    // Try each API in sequence until one works
    for (const api of apis) {
      try {
        console.log(`🔄 Trying ${api.name}...`);

        const requestData = api.formatRequest(userQuestion);
        
        const response = await axios({
          method: api.method,
          url: api.url,
          data: requestData,
          headers: api.headers,
          timeout: 25000 // 25 second timeout
        });

        // Extract the response text using the API's specific extractor
        let replyText = api.extractResponse(response.data);

        // If extraction failed, try to find any text in the response
        if (!replyText && typeof response.data === 'string') {
          replyText = response.data;
        } else if (!replyText && response.data) {
          // Last resort: stringify the whole response if it's an object
          replyText = JSON.stringify(response.data);
        }

        if (replyText && replyText.length > 0) {
          // Clean up the response (remove excessive whitespace)
          replyText = replyText.replace(/\s+/g, ' ').trim();

          // Delete the processing message
          await api.unsendMessage(processingMsg.messageID);

          // Send the successful response
          return message.reply(
            `🤖 **${api.name} Response**\n━━━━━━━━━━━━━━━━\n${replyText}\n━━━━━━━━━━━━━━━━`
          );
        }

      } catch (error) {
        console.log(`❌ ${api.name} failed:`, error.message);
        lastError = error;
        // Continue to next API
      }
    }

    // If all APIs failed
    await api.unsendMessage(processingMsg.messageID);

    let errorMessage = "❌ All AI services failed to respond.\n";
    if (lastError) {
      errorMessage += `\n**Last error:** ${lastError.message}`;
    }
    errorMessage += "\n\nPlease try again in a few moments.";

    return message.reply(errorMessage);
  }
};
