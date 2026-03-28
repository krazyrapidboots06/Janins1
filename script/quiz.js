const axios = require('axios');

module.exports.config = {
  name: "quiz",
  version: "1.0.0",
  role: 0,
  credits: "selov",
  description: "AI-generated quiz with multiple choice questions",
  commandCategory: "fun",
  usages: "/quiz [topic] or reply with A, B, C, D",
  cooldowns: 5
};

// Active quiz sessions
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
    `💡 Reply with A, B, C, or D!`
  );
}

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, senderID } = event;
  const input = args.join(" ").trim().toUpperCase();

  // Check if answering an active quiz (when user replies with A/B/C/D)
  if (input === "A" || input === "B" || input === "C" || input === "D") {
    const session = global.quizSessions[senderID];
    
    if (!session) {
      return api.sendMessage(
        "❌ You don't have an active quiz. Start a new one with /quiz [topic]",
        threadID,
        messageID
      );
    }
    
    const correct = session.answer;
    const isRight = input === correct;
    
    delete global.quizSessions[senderID];
    
    let msg = isRight
      ? `✅ CORRECT! Well done!\n\n`
      : `❌ Wrong! The answer is ${correct}\n\n`;
    
    msg += `💡 **Explanation:** ${session.explanation}\n\n`;
    msg += isRight
      ? `🎉 Keep it up! Try another: /quiz [topic]`
      : `💪 Try again: /quiz [topic]`;
    
    return api.sendMessage(msg, threadID, messageID);
  }
  
  // Generate new quiz
  const topic = input || "general knowledge";
  
  // Send loading message
  const loadingMsg = await api.sendMessage(`🧠 Generating quiz on: ${topic}...`, threadID);
  
  try {
    const question = await generateQuestion(topic);
    
    // Save session with timestamp
    global.quizSessions[senderID] = {
      answer: question.answer,
      explanation: question.explanation,
      topic: topic,
      time: Date.now()
    };
    
    // Auto-expire session after 5 minutes
    setTimeout(() => {
      if (global.quizSessions[senderID] && 
          global.quizSessions[senderID].time === global.quizSessions[senderID].time) {
        delete global.quizSessions[senderID];
      }
    }, 5 * 60 * 1000);
    
    // Delete loading message and send quiz
    await api.unsendMessage(loadingMsg.messageID);
    api.sendMessage(formatQuestion(question), threadID, messageID);
    
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

// Handle replies to quiz (when user replies with A/B/C/D to the quiz message)
module.exports.handleReply = async function ({ api, event }) {
  const { threadID, messageID, senderID, body, messageReply } = event;
  
  // Check if this is a reply to a quiz message
  if (!messageReply) return;
  
  const answer = body?.trim().toUpperCase();
  if (!answer || !["A", "B", "C", "D"].includes(answer)) return;
  
  const session = global.quizSessions[senderID];
  
  if (!session) {
    return api.sendMessage(
      "❌ You don't have an active quiz. Start a new one with /quiz [topic]",
      threadID,
      messageID
    );
  }
  
  const correct = session.answer;
  const isRight = answer === correct;
  
  delete global.quizSessions[senderID];
  
  let msg = isRight
    ? `✅ CORRECT! Well done!\n\n`
    : `❌ Wrong! The answer is ${correct}\n\n`;
  
  msg += `💡 Explanation: ${session.explanation}\n\n`;
  msg += isRight
    ? `🎉 Keep it up! Try another: /quiz [topic]`
    : `💪 Try again: /quiz [topic]`;
  
  return api.sendMessage(msg, threadID, messageID);
};
