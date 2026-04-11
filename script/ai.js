const axios = require("axios");
const fs = require("fs");
const path = require("path");

module.exports.config = {
  name: "ai",
  version: "5.0.0",
  hasPermssion: 0,
  credits: "selov",
  description: "AI with voice response (knows your name)",
  commandCategory: "search",
  usages: "ai <ask a questions>",
  cooldowns: 3
};

// Simple memory per thread
const memory = {};

// Language detection for better TTS
function detectLanguage(text) {
  const tagalogPattern = /[ngmga]|ako|ikaw|siya|tayo|kami|kayo|sila|maganda|pangit|mabuti|masama|kumain|inom|tulog|laro|araw|gabi|bahay|tao|aso|pusa|gimingaw|nimo|ako|ikaw|siya|kami|kamo|sila/gi;
  const tagalogWords = (text.match(tagalogPattern) || []).length;
  const totalWords = text.split(/\s+/).length;
  const tagalogRatio = tagalogWords / totalWords;
  
  if (tagalogRatio > 0.15) return "tl"; // Tagalog/Filipino/Cebuano
  if (/[ñáéíóúü¿¡]/i.test(text)) return "es"; // Spanish
  if (/[çãõáéíóúâêîôûà]/i.test(text)) return "pt"; // Portuguese
  if (/[àâäéèêëïîôöùûüÿç]/i.test(text)) return "fr"; // French
  if (/[äöüß]/i.test(text)) return "de"; // German
  return "en"; // Default English
}

// Get Google TTS URL with language support
function getTtsUrl(text, lang) {
  const encodedText = encodeURIComponent(text.substring(0, 200));
  return `https://translate.google.com/translate_tts?ie=UTF-8&tl=${lang}&client=tw-ob&q=${encodedText}`;
}

// Alternative TTS using StreamElements (better quality)
async function getAlternativeTts(text, voice = "Joey") {
  try {
    const encodedText = encodeURIComponent(text.substring(0, 200));
    const url = `https://api.streamelements.com/kappa/v2/speech?voice=${voice}&text=${encodedText}`;
    const response = await axios.get(url, { responseType: "arraybuffer", timeout: 15000 });
    return response.data;
  } catch (err) {
    return null;
  }
}

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, attachments, senderID } = event;

  let prompt = args.join(" ").trim();

  try {
    // Get user info with full name
    const user = await api.getUserInfo(senderID);
    const userData = user[senderID];
    const senderName = userData?.name || "User";
    const firstName = senderName.split(' ')[0] || senderName;
    const lastName = senderName.split(' ').slice(1).join(' ') || "";

    // Initialize memory for this thread
    if (!memory[threadID]) {
      memory[threadID] = {
        users: {},
        conversations: []
      };
    }
    
    // Store user info in memory
    memory[threadID].users[senderID] = {
      name: senderName,
      firstName: firstName,
      lastName: lastName,
      lastSeen: Date.now(),
      interactions: (memory[threadID].users[senderID]?.interactions || 0) + 1
    };

    // Check image attachment
    if (attachments && attachments.length > 0) {
      const photo = attachments.find(a => a.type === "photo");
      if (photo) {
        const imageUrl = photo.url;
        prompt = `Describe this photo in detail like a human. The user's name is ${firstName}:\n${imageUrl}`;
      }
    }

    if (!prompt) {
      return api.sendMessage(
        `📌 Hello ${firstName}! Ask me anything and I'll respond with voice.\n\nExample: ai what is your name?`,
        threadID,
        messageID
      );
    }

    // Show typing indicator
    api.sendTypingIndicator(threadID, true);

    // Enhance prompt with user's name for personalized response
    const enhancedPrompt = `The user's name is ${firstName} (full name: ${senderName}). 
Please address them by their name in your response naturally. 
Keep your response warm, friendly, and concise. 
If they say "gimingaw nako nimo" or similar, respond with warmth and care.
Respond in Taglish or English naturally. Question: ${prompt}`;

    // Get AI response
    const aiUrl = `https://vern-rest-api.vercel.app/api/chatgpt4?prompt=${encodeURIComponent(enhancedPrompt)}`;
    const aiResponse = await axios.get(aiUrl, { timeout: 20000 });

    let replyText = "I'm sorry, I couldn't process that request.";

    if (aiResponse.data) {
      if (aiResponse.data.result) replyText = aiResponse.data.result;
      else if (aiResponse.data.response) replyText = aiResponse.data.response;
      else if (aiResponse.data.message) replyText = aiResponse.data.message;
      else if (aiResponse.data.answer) replyText = aiResponse.data.answer;
      else if (typeof aiResponse.data === 'string') replyText = aiResponse.data;
    }

    // Ensure the response includes the user's name naturally
    if (!replyText.toLowerCase().includes(firstName.toLowerCase()) && replyText.length > 20) {
      // Add name naturally if not present
      const greetings = ["Hello", "Hi", "Hey", "Kumusta", "Musta", "Oi", "Hoy"];
      const hasGreeting = greetings.some(g => replyText.toLowerCase().startsWith(g.toLowerCase()));
      
      if (hasGreeting) {
        replyText = replyText.replace(/(Hello|Hi|Hey|Kumusta|Musta|Oi|Hoy)/i, `$1 ${firstName}`);
      } else if (replyText.length > 30) {
        replyText = `${firstName}, ${replyText}`;
      }
    }

    // Limit length for TTS
    if (replyText.length > 200) {
      replyText = replyText.substring(0, 197) + "...";
    }

    // Store conversation in memory
    memory[threadID].conversations.push({
      user: senderID,
      userName: firstName,
      prompt: prompt,
      response: replyText,
      timestamp: Date.now()
    });

    // Keep only last 10 conversations
    if (memory[threadID].conversations.length > 10) {
      memory[threadID].conversations.shift();
    }

    // Create cache directory
    const cacheDir = path.join(__dirname, "cache", "ai_tts");
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    const audioPath = path.join(cacheDir, `ai_tts_${Date.now()}.mp3`);
    let audioData = null;

    // Detect language for better TTS
    const detectedLang = detectLanguage(replyText);
    console.log(`[AI TTS] Language: ${detectedLang} | User: ${firstName} | Text: ${replyText.substring(0, 50)}`);

    // Try alternative TTS first (better quality)
    try {
      let voice = "Joey"; // Default male voice
      if (detectedLang === "tl") {
        voice = "Joey"; // Good for Taglish/Filipino
      } else if (detectedLang === "es") {
        voice = "Mia";
      } else if (detectedLang === "fr") {
        voice = "Chantal";
      } else if (detectedLang === "de") {
        voice = "Hans";
      }
      
      audioData = await getAlternativeTts(replyText, voice);
    } catch (altErr) {
      console.log("[AI TTS] Alternative TTS failed, using Google TTS");
    }

    // Fallback to Google TTS
    if (!audioData) {
      const ttsUrl = getTtsUrl(replyText, detectedLang);
      const audioResponse = await axios.get(ttsUrl, { 
        responseType: "arraybuffer",
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Referer': 'https://translate.google.com/'
        }
      });
      audioData = audioResponse.data;
    }

    if (!audioData || audioData.length < 1000) {
      throw new Error("Failed to generate audio");
    }

    fs.writeFileSync(audioPath, audioData);

    // Send ONLY audio (no text message)
    api.sendMessage(
      {
        attachment: fs.createReadStream(audioPath)
      },
      threadID,
      (err) => {
        if (err) console.error("Error sending audio:", err);
        // Clean up file after sending
        setTimeout(() => {
          try {
            if (fs.existsSync(audioPath)) {
              fs.unlinkSync(audioPath);
            }
          } catch (e) {}
        }, 10000);
      },
      messageID
    );

    // Update memory
    memory[threadID].push(`AI responded to ${firstName} with voice`);

  } catch (err) {
    console.error("AI TTS Error:", err);
    // Silent fail - no error message to user
  }
};
