const moment = require("moment-timezone");

module.exports.config = {
  name: "bible",
  version: "1.0.0",
  hasPermssion: 0,
  credits: "selov",
  description: "Get Bible verses in Tagalog, Cebuano, or English",
  commandCategory: "religion",
  usages: "/bible [tagalog|cebuano|english] [book chapter:verse]",
  cooldowns: 2
};

// Simple memory per thread
const memory = {};

// Bible verses database (you can expand this)
const bibleDB = {
  tagalog: {
    "Juan 3:16": "Sapagka't gayon na lamang ang pagsinta ng Dios sa sanglibutan, na ibinigay niya ang kaniyang bugtong na Anak, upang ang sinomang sa kaniya'y sumampalataya ay huwag mapahamak, kundi magkaroon ng buhay na walang hanggan.",
    "Awit 23:1": "Ang Panginoon ay aking pastor; hindi ako kukulangin.",
    "Roma 8:28": "At nalalaman natin na ang lahat ng mga bagay ay nagkakalakip na gumagawa sa ikabubuti ng mga nagsisiibig sa Dios, sa makatuwid baga'y niyaong mga tinawag alinsunod sa kaniyang pasiya.",
    "Jeremias 29:11": "Sapagka't nalalaman ko ang mga pagiisip na aking iniisip tungkol sa inyo, sabi ng Panginoon, mga pagiisip ng kapayapaan, at hindi ng kasamaan, upang bigyan ko kayo ng pagasa sa iyong huling wakas."
  },
  cebuano: {
    "Juan 3:16": "Kay gihigugma pag-ayo sa Dios ang kalibotan nga gihatag niya ang iyang bugtong nga Anak, aron ang tanan nga mosalig kaniya dili malaglag kondili makabaton sa kinabuhing dayon.",
    "Salmo 23:1": "Si Jehova mao ang akong magbalantay; dili ako magkulang.",
    "Roma 8:28": "Ug nasayud kita nga ang tanang mga butal nagatinguha sa paghimo sa maayo alang kanila nga nahigugma sa Dios, bisan kanila nga gitawag sumala sa iyang katuyoan.",
    "Jeremias 29:11": "Kay nasayud ako sa mga hunahuna nga akong gihunahuna alang kaninyo, nagaingon si Jehova, mga hunahuna sa kalinaw, ug dili sa dautan, aron sa paghatag kaninyo ug paglaum sa inyong katapusan."
  },
  english: {
    "John 3:16": "For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.",
    "Psalm 23:1": "The LORD is my shepherd; I shall not want.",
    "Romans 8:28": "And we know that all things work together for good to them that love God, to them who are the called according to his purpose.",
    "Jeremiah 29:11": "For I know the thoughts that I think toward you, saith the LORD, thoughts of peace, and not of evil, to give you an expected end."
  }
};

// Common books and their abbreviations
const books = {
  "Genesis": "Gen", "Exodus": "Exo", "Leviticus": "Lev", "Numbers": "Num",
  "Deuteronomy": "Deu", "Joshua": "Jos", "Judges": "Jdg", "Ruth": "Rut",
  "1 Samuel": "1Sa", "2 Samuel": "2Sa", "1 Kings": "1Ki", "2 Kings": "2Ki",
  "1 Chronicles": "1Ch", "2 Chronicles": "2Ch", "Ezra": "Ezr", "Nehemiah": "Neh",
  "Esther": "Est", "Job": "Job", "Psalm": "Psa", "Proverbs": "Pro",
  "Ecclesiastes": "Ecc", "Song of Solomon": "Sos", "Isaiah": "Isa",
  "Jeremiah": "Jer", "Lamentations": "Lam", "Ezekiel": "Eze", "Daniel": "Dan",
  "Hosea": "Hos", "Joel": "Joe", "Amos": "Amo", "Obadiah": "Oba",
  "Jonah": "Jon", "Micah": "Mic", "Nahum": "Nah", "Habakkuk": "Hab",
  "Zephaniah": "Zep", "Haggai": "Hag", "Zechariah": "Zec", "Malachi": "Mal",
  "Matthew": "Mat", "Mark": "Mrk", "Luke": "Luk", "John": "Jhn",
  "Acts": "Act", "Romans": "Rom", "1 Corinthians": "1Co", "2 Corinthians": "2Co",
  "Galatians": "Gal", "Ephesians": "Eph", "Philippians": "Phi", "Colossians": "Col",
  "1 Thessalonians": "1Th", "2 Thessalonians": "2Th", "1 Timothy": "1Ti",
  "2 Timothy": "2Ti", "Titus": "Tit", "Philemon": "Phm", "Hebrews": "Heb",
  "James": "Jas", "1 Peter": "1Pe", "2 Peter": "2Pe", "1 John": "1Jn",
  "2 John": "2Jn", "3 John": "3Jn", "Jude": "Jud", "Revelation": "Rev"
};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, senderID } = event;
  
  try {
    const user = await api.getUserInfo(senderID);
    const senderName = user[senderID]?.name || "User";
    
    if (!memory[threadID]) memory[threadID] = [];
    
    // Parse arguments
    let language = "english";
    let verseRef = "";
    
    if (args.length === 0) {
      return api.sendMessage(
        "📖 **BIBLE COMMAND USAGE**\n━━━━━━━━━━━━━━━━\n" +
        "🇵🇭 **Tagalog:** /bible tagalog Juan 3:16\n" +
        "🇵🇭 **Cebuano:** /bible cebuano Juan 3:16\n" +
        "🇬🇧 **English:** /bible english John 3:16\n" +
        "━━━━━━━━━━━━━━━━\n" +
        "📅 **Daily Verse:** /bible daily",
        threadID,
        messageID
      );
    }
    
    // Check for daily verse
    if (args[0].toLowerCase() === "daily") {
      language = args[1]?.toLowerCase() || "english";
      if (!bibleDB[language]) language = "english";
      
      // Get random verse from that language
      const verses = Object.keys(bibleDB[language]);
      const randomVerse = verses[Math.floor(Math.random() * verses.length)];
      verseRef = randomVerse;
    }
    // Check for language specified
    else if (args[0].toLowerCase() === "tagalog" || 
             args[0].toLowerCase() === "cebuano" || 
             args[0].toLowerCase() === "english") {
      language = args[0].toLowerCase();
      verseRef = args.slice(1).join(" ");
    } else {
      verseRef = args.join(" ");
    }
    
    if (!verseRef) {
      return api.sendMessage(
        `❌ Please provide a verse reference.\nExample: /bible ${language} ${language === 'english' ? 'John 3:16' : 'Juan 3:16'}`,
        threadID,
        messageID
      );
    }
    
    // Format verse reference for lookup
    let formattedRef = verseRef.trim();
    
    // Check if verse exists in database
    let verseText = bibleDB[language]?.[formattedRef];
    
    // Try to find with different formatting
    if (!verseText) {
      // Try to find by partial match
      const verses = Object.keys(bibleDB[language] || {});
      const match = verses.find(v => 
        v.toLowerCase().includes(formattedRef.toLowerCase()) ||
        formattedRef.toLowerCase().includes(v.toLowerCase().split(' ')[0].toLowerCase())
      );
      if (match) {
        verseText = bibleDB[language][match];
        formattedRef = match;
      }
    }
    
    if (!verseText) {
      return api.sendMessage(
        `❌ Verse not found in our database. We currently have limited verses.\n` +
        `Available verses: ${Object.keys(bibleDB[language]).slice(0, 5).join(', ')}...`,
        threadID,
        messageID
      );
    }
    
    memory[threadID].push(`${senderName} requested ${formattedRef} in ${language}`);
    
    // Language flags
    const flags = {
      tagalog: "🇵🇭",
      cebuano: "🇵🇭",
      english: "🇬🇧"
    };
    
    // Language names
    const langNames = {
      tagalog: "Tagalog",
      cebuano: "Cebuano",
      english: "English"
    };
    
    const reply = 
      `📖 **${flags[language]} BIBLE VERSE**\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `📌 ${formattedRef}\n\n` +
      `"${verseText}"\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `📚 ${langNames[language]}\n` +
      `💬 Requested by: ${senderName}`;
    
    api.sendMessage(reply, threadID, messageID);
    
  } catch (err) {
    console.error("Bible Command Error:", err);
    api.sendMessage(`❌ Error: ${err.message}`, threadID, messageID);
  }
};
