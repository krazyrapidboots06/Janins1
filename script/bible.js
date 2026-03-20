const axios = require("axios");

module.exports.config = {
  name: "bible",
  version: "1.0.0",
  hasPermssion: 0,
  credits: "selov",
  description: "Get random Bible verse or search by book/chapter/verse",
  commandCategory: "religion",
  usages: "bible (random) or bible <book> <chapter>:<verse> (e.g., bible John 3:16)",
  cooldowns: 2
};

// Simple memory per thread
const memory = {};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, senderID } = event;
  const input = args.join(" ").trim();

  try {
    // Get sender name
    const user = await api.getUserInfo(senderID);
    const senderName = user[senderID]?.name || "User";

    // Initialize memory
    if (!memory[threadID]) memory[threadID] = [];
    memory[threadID].push(`${senderName} requested: bible ${input || "random"}`);

    let apiUrl;
    let verseData;

    // If no input, get random verse
    if (!input || input.toLowerCase() === "random") {
      apiUrl = "https://labs.bible.org/api/?passage=random&type=json";
      const res = await axios.get(apiUrl);
      verseData = res.data[0];
    } else {
      // Parse book, chapter, verse from input
      // Format: "John 3:16" or "Genesis 1:1"
      const passageMatch = input.match(/^(.+?)\s+(\d+):(\d+)$/);
      
      if (!passageMatch) {
        return api.sendMessage(
          "📖 Invalid format! Use:\n• bible random\n• bible John 3:16\n• bible Genesis 1:1",
          threadID,
          messageID
        );
      }

      const [, book, chapter, verse] = passageMatch;
      
      apiUrl = `https://labs.bible.org/api/?passage=${encodeURIComponent(book)}%20${chapter}:${verse}&type=json`;
      const res = await axios.get(apiUrl);
      verseData = res.data[0];
    }

    if (!verseData) {
      return api.sendMessage("❌ Verse not found. Please check your input.", threadID, messageID);
    }

    // Format the verse text
    const bookName = verseData.bookname || "Unknown";
    const chapterNum = verseData.chapter || "?";
    const verseNum = verseData.verse || "?";
    const text = verseData.text || "Text not available";

    // Clean up the text (remove HTML entities if any)
    const cleanText = text.replace(/&quot;/g, '"')
                         .replace(/&amp;/g, '&')
                         .replace(/&lt;/g, '<')
                         .replace(/&gt;/g, '>')
                         .replace(/&#8217;/g, "'")
                         .replace(/&#8230;/g, "...");

    const reply = `📖 BIBLE VERSE\n━━━━━━━━━━━━━━\n${bookName} ${chapterNum}:${verseNum}\n\n"${cleanText}"\n\n━━━━━━━━━━━━━━\n💭 Requested by: ${senderName}`;

    // Store in memory
    memory[threadID].push(`Bible: ${bookName} ${chapterNum}:${verseNum}`);

    api.sendMessage(reply, threadID, messageID);

  } catch (err) {
    console.error("Bible Command Error:", err);
    
    api.sendMessage(
      `❌ Error: ${err.message}\nPlease check your input format.`,
      threadID,
      messageID
    );
  }
};
