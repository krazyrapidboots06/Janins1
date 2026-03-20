const axios = require('axios');

module.exports.config = {
  name: "tl",
  version: "1.0.0",
  hasPermssion: 0,
  credits: "selov",
  description: "Translate text between languages",
  commandCategory: "utility",
  usages: "/translate [text] [source] to [target] OR reply to a message with /translate [source] to [target]",
  cooldowns: 2
};

// Language codes mapping
const languageCodes = {
  "english": "en", "en": "en",
  "tagalog": "tl", "tl": "tl", "filipino": "tl",
  "cebuano": "ceb", "ceb": "ceb", "bisaya": "ceb",
  "spanish": "es", "es": "es",
  "french": "fr", "fr": "fr",
  "german": "de", "de": "de",
  "italian": "it", "it": "it",
  "portuguese": "pt", "pt": "pt",
  "russian": "ru", "ru": "ru",
  "japanese": "ja", "ja": "ja",
  "korean": "ko", "ko": "ko",
  "chinese": "zh", "zh": "zh",
  "arabic": "ar", "ar": "ar",
  "hindi": "hi", "hi": "hi",
  "thai": "th", "th": "th",
  "vietnamese": "vi", "vi": "vi",
  "indonesian": "id", "id": "id",
  "malay": "ms", "ms": "ms",
  "dutch": "nl", "nl": "nl",
  "swedish": "sv", "sv": "sv",
  "greek": "el", "el": "el",
  "turkish": "tr", "tr": "tr",
  "hebrew": "he", "he": "he",
  "auto": "auto", "autodetect": "auto"
};

// Simple memory per thread
const memory = {};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, senderID, type, messageReply } = event;
  
  try {
    // Initialize memory
    if (!memory[threadID]) memory[threadID] = [];
    
    let textToTranslate = "";
    let sourceLang = "auto";
    let targetLang = "en";
    
    // CASE 1: User replied to a message
    if (type === "message_reply" && messageReply && messageReply.body) {
      textToTranslate = messageReply.body;
      
      const argsString = args.join(" ").toLowerCase();
      const toMatch = argsString.match(/(\w+)\s+to\s+(\w+)/);
      
      if (toMatch) {
        const sourceInput = toMatch[1];
        const targetInput = toMatch[2];
        
        sourceLang = languageCodes[sourceInput] || sourceInput;
        targetLang = languageCodes[targetInput] || targetInput;
      } else if (argsString) {
        targetLang = languageCodes[argsString] || argsString;
      }
    }
    // CASE 2: User typed text directly
    else {
      const fullText = args.join(" ");
      const toMatch = fullText.match(/(.+?)\s+(\w+)\s+to\s+(\w+)/i);
      
      if (toMatch) {
        textToTranslate = toMatch[1].trim();
        const sourceInput = toMatch[2].toLowerCase();
        const targetInput = toMatch[3].toLowerCase();
        
        sourceLang = languageCodes[sourceInput] || sourceInput;
        targetLang = languageCodes[targetInput] || targetInput;
      } else {
        textToTranslate = fullText;
      }
    }
    
    if (!textToTranslate) {
      return api.sendMessage(
        "📝 **TRANSLATE USAGE**\n━━━━━━━━━━━━━━━━\n" +
        "• Reply to message: /translate en to tl\n" +
        "• Direct text: /translate Hello en to tl\n" +
        "• Auto to English: /translate Bonjour\n\n" +
        "**Supported:** Tagalog (tl), Cebuano (ceb), English (en), Spanish (es), Japanese (ja), + more",
        threadID,
        messageID
      );
    }
    
    // Call translation API (no waiting message)
    const apiUrl = `https://api.mymemory.translated.net/get`;
    const response = await axios.get(apiUrl, {
      params: {
        q: textToTranslate,
        langpair: `${sourceLang}|${targetLang}`,
        de: "a@b.c"
      },
      timeout: 10000
    });
    
    const data = response.data;
    
    if (!data || !data.responseData || !data.responseData.translatedText) {
      throw new Error("Translation failed");
    }
    
    const translatedText = data.responseData.translatedText;
    const sourceDetected = data.responseData.detectedLanguage || sourceLang;
    
    // Get language names
    const sourceName = getLanguageName(sourceDetected);
    const targetName = getLanguageName(targetLang);
    
    memory[threadID].push(`Translated from ${sourceName} to ${targetName}`);
    
    // Clean response - no "Requested by"
    const replyMsg = 
      `🌐 **TRANSLATION**\n━━━━━━━━━━━━━━━━\n` +
      `**From:** ${sourceName}\n` +
      `**To:** ${targetName}\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `"${translatedText}"\n` +
      `━━━━━━━━━━━━━━━━`;
    
    api.sendMessage(replyMsg, threadID, messageID);
    
  } catch (err) {
    console.error("Translate Error:", err);
    
    let errorMsg = "❌ Translation failed. ";
    if (err.message.includes("timedout")) {
      errorMsg += "Request timed out.";
    } else {
      errorMsg += "Check language codes. Use: en, tl, ceb, es, fr, ja, ko, zh";
    }
    
    api.sendMessage(errorMsg, threadID, messageID);
  }
};

function getLanguageName(code) {
  const map = {
    "en": "English", "tl": "Tagalog", "ceb": "Cebuano",
    "es": "Spanish", "fr": "French", "de": "German",
    "ja": "Japanese", "ko": "Korean", "zh": "Chinese",
    "ar": "Arabic", "hi": "Hindi", "th": "Thai",
    "vi": "Vietnamese", "id": "Indonesian", "ms": "Malay",
    "ru": "Russian", "pt": "Portuguese", "it": "Italian",
    "nl": "Dutch", "sv": "Swedish", "el": "Greek",
    "tr": "Turkish", "he": "Hebrew", "auto": "Auto-detected"
  };
  return map[code] || code.toUpperCase();
}
