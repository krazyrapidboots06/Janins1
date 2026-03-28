const axios = require('axios');

module.exports.config = {
  name: "quiz",
  version: "3.0.0",
  role: 0,
  credits: "selov",
  description: "AI-generated quiz with multiple choice questions",
  commandCategory: "fun",
  usages: "/quiz [topic] or reply with A, B, C, D",
  cooldowns: 5
};

// Store active quiz sessions globally
if (!global.quizSessions) global.quizSessions = {};

// Ask AI via Pollinations
async function askAI(prompt) {
  const models = ["openai", "llama", "mistral"];
  for (let i = 0; i < models.length; i++) {
    try {
      const res = await axios.post(
        "https://text.pollinations.ai/",
        {
          messages: [{ role: "user", content: prompt }],
          model: models[i],
          seed: Math.floor(Math.random() * 9999),
        },
        { headers: { "Content-Type": "application/json" }, timeout: 30000 }
      );
      const text = typeof res.data === "string" ? res.data : JSON.stringify(res.data);
      if (text && text.length > 50) return text;
    } catch (e) {
      console.log("[Quiz] AI " + models[i] + " failed:", e.message);
    }
  }
  throw new Error("All AI models failed");
}

// Generate quiz question
async function generateQuestion(topic) {
  const prompt =
    "Generate a multiple choice quiz question about: " + topic + "\n\n" +
    "You MUST respond in EXACTLY this format with no extra text:\n" +
    "QUESTION: [the question here]\n" +
    "A: [option A]\n" +
    "B: [option B]\n" +
    "C: [option C]\n" +
    "D: [option D]\n" +
    "ANSWER: [just the letter A, B, C, or D]\n" +
    "EXPLANATION: [brief explanation why]\n\n" +
    "Do not add anything else. Follow the exact format above.";

  const raw = await askAI(prompt);

  // Parse the response
  const questionMatch = raw.match(/QUESTION:\s*(.+?)(?:\n|$)/i);
  const aMatch = raw.match(/^A[:.]\s*(.+?)(?:\n|$)/im);
  const bMatch = raw.match(/^B[:.]\s*(.+?)(?:\n|$)/im);
  const cMatch = raw.match(/^C[:.]\s*(.+?)(?:\n|$)/im);
  const dMatch = raw.match(/^D[:.]\s*(.+?)(?:\n|$)/im);
  const answerMatch = raw.match(/ANSWER:\s*([ABCD])/i);
  const explanationMatch = raw.match(/EXPLANATION:\s*(.+?)(?:\n|$)/i);

  if (!questionMatch || !aMatch || !bMatch || !cMatch || !dMatch || !answerMatch) {
    console.log("[Quiz] Parse failed. Raw response:", raw.substring(0, 200));
    throw new Error("Could not parse quiz format");
  }

  return {
    question: questionMatch[1].trim(),
    options: {
      A: aMatch[1].trim(),
      B: bMatch[1].trim(),
      C: cMatch[1].trim(),
      D: dMatch[1].trim(),
    },
    answer: answerMatch[1].toUpperCase(),
    explanation: explanationMatch ? explanationMatch[1].trim() : "Correct!",
    topic: topic,
  };
}

// Format quiz message
function formatQuestion(q) {
  return (
    `🧠 QUIZ — ${q.topic.toUpperCase()}\n` +
    `━━━━━━━━━━━━━━━━\n` +
    `❓ ${q.question}\n\n` +
    `A️⃣  ${q.options.A}\n` +
    `B️⃣  ${q.options.B}\n` +
    `C️⃣  ${q.options.C}\n` +
    `D️⃣  ${q.options.D}\n\n` +
    `💡 **Reply to this message with A, B, C, or D!**`
  );
}

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, senderID } = event;
  const input = args.join(" ").trim();
  
  // Generate new quiz
  const topic = input || "general knowledge";
  
  // Send loading message
  const loadingMsg = await api.sendMessage(`🧠 Generating quiz on: ${topic}...`, threadID);
  
  try {
    const question = await generateQuestion(topic);
    
    // Send the quiz message
    const quizMessage = await api.sendMessage(formatQuestion(question), threadID);
    
    // Store session with the message ID for reply tracking
    global.quizSessions[quizMessage.messageID] = {
      answer: question.answer,
      explanation: question.explanation,
      topic: topic,
      userID: senderID,
      time: Date.now()
    };
    
    // Also store by user ID for quick lookup
    global.quizSessions[`user_${senderID}`] = quizMessage.messageID;
    
    // Delete loading message
    await api.unsendMessage(loadingMsg.messageID);
    
    // Auto-expire session after 5 minutes
    setTimeout(() => {
      if (global.quizSessions[quizMessage.messageID]) {
        delete global.quizSessions[quizMessage.messageID];
        delete global.quizSessions[`user_${senderID}`];
      }
    }, 5 * 60 * 1000);
    
  } catch (err) {
    console.error("[Quiz] Error:", err.message);
    await api.editMessage(
      `❌ Could not generate quiz.\n\n` +
      `Try a more specific topic like:\n` +
      `• /quiz philippine history\n` +
      `• /quiz math\n` +
      `• /quiz animals\n` +
      `• /quiz science`,
      loadingMsg.messageID
    );
  }
};

// Handle replies to quiz
module.exports.handleReply = async function ({ api, event }) {
  const { threadID, messageID, senderID, body, messageReply } = event;
  
  // Check if this is a reply to a message
  if (!messageReply) return;
  
  const repliedMessageID = messageReply.messageID;
  
  // Check if there's an active quiz for this replied message
  const session = global.quizSessions[repliedMessageID];
  
  if (!session) {
    // No active quiz for this message
    return;
  }
  
  // Check if the user replying is the same who started the quiz
  if (session.userID !== senderID) {
    return api.sendMessage("❌ This quiz was created by another user. Please start your own quiz with /quiz [topic]", threadID, messageID);
  }
  
  const answer = body?.trim().toUpperCase();
  
  // Check if answer is valid
  if (!answer || !["A", "B", "C", "D"].includes(answer)) {
    return api.sendMessage("❌ Please reply with A, B, C, or D only!", threadID, messageID);
  }
  
  const correct = session.answer;
  const isRight = answer === correct;
  
  // Delete the session
  delete global.quizSessions[repliedMessageID];
  delete global.quizSessions[`user_${senderID}`];
  
  // Prepare result message
  let resultMsg = isRight
    ? `✅ CORRECT! Well done!\n\n`
    : `❌ Wrong! The correct answer is **${correct}**\n\n`;
  
  resultMsg += `💡 Explanation: ${session.explanation}\n\n`;
  resultMsg += isRight
    ? `🎉 Keep it up! Start another quiz with /quiz [topic]`
    : `💪 Try again! Start a new quiz with /quiz [topic]`;
  
  return api.sendMessage(resultMsg, threadID, messageID);
};
