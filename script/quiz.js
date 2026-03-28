const axios = require("axios");

module.exports.config = {
  name: "quiz",
  version: "3.0.0",
  hasPermssion: 0,
  credits: "fixed by ChatGPT",
  description: "AI-generated quiz with reply system",
  commandCategory: "fun",
  usages: "quiz [topic]",
  cooldowns: 5
};

// Ask AI
async function askAI(prompt) {
  const url = `https://text.pollinations.ai/${encodeURIComponent(prompt)}`;
  const res = await axios.get(url);
  return res.data;
}

// Generate question
async function generateQuestion(topic) {
  const prompt =
    `Create a multiple choice quiz about ${topic}.\n\n` +
    `Format EXACTLY like this:\n` +
    `QUESTION: ...\n` +
    `A: ...\nB: ...\nC: ...\nD: ...\n` +
    `ANSWER: A/B/C/D\n` +
    `EXPLANATION: ...`;

  const raw = await askAI(prompt);

  const question = raw.match(/QUESTION:\s*(.*)/i)?.[1];
  const A = raw.match(/A:\s*(.*)/i)?.[1];
  const B = raw.match(/B:\s*(.*)/i)?.[1];
  const C = raw.match(/C:\s*(.*)/i)?.[1];
  const D = raw.match(/D:\s*(.*)/i)?.[1];
  const answer = raw.match(/ANSWER:\s*([ABCD])/i)?.[1];
  const explanation = raw.match(/EXPLANATION:\s*(.*)/i)?.[1];

  if (!question || !A || !B || !C || !D || !answer) {
    throw new Error("AI format failed");
  }

  return {
    question,
    A,
    B,
    C,
    D,
    answer: answer.toUpperCase(),
    explanation: explanation || "No explanation."
  };
}

// Run command
module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, senderID } = event;

  const topic = args.join(" ") || "general knowledge";

  const loading = await api.sendMessage(
    `🧠 Generating quiz about "${topic}"...`,
    threadID
  );

  try {
    const q = await generateQuestion(topic);

    const msg =
      `🧠 QUIZ — ${topic.toUpperCase()}\n` +
      `━━━━━━━━━━━━━━\n` +
      `❓ ${q.question}\n\n` +
      `A️⃣ ${q.A}\n` +
      `B️⃣ ${q.B}\n` +
      `C️⃣ ${q.C}\n` +
      `D️⃣ ${q.D}\n\n` +
      `👉 Reply with A, B, C, or D`;

    api.sendMessage(msg, threadID, (err, info) => {
      if (err) return;

      // ✅ MIRAI HANDLE REPLY SYSTEM
      global.client.handleReply.push({
        name: module.exports.config.name,
        messageID: info.messageID,
        author: senderID,
        answer: q.answer,
        explanation: q.explanation
      });
    });

    api.unsendMessage(loading.messageID);

  } catch (e) {
    console.error(e);

    api.editMessage(
      "❌ Failed to generate quiz. Try again.",
      loading.messageID
    );
  }
};

// Handle reply
module.exports.handleReply = async function ({ api, event, handleReply }) {
  const { threadID, messageID, senderID, body } = event;

  // Only original user
  if (senderID !== handleReply.author) {
    return api.sendMessage(
      "❌ This is not your quiz.",
      threadID,
      messageID
    );
  }

  const userAnswer = body.trim().toUpperCase();

  if (!["A", "B", "C", "D"].includes(userAnswer)) {
    return api.sendMessage(
      "❌ Please reply with A, B, C, or D only.",
      threadID,
      messageID
    );
  }

  const correct = handleReply.answer;

  const result =
    userAnswer === correct
      ? `✅ CORRECT!\n\n💡 ${handleReply.explanation}`
      : `❌ WRONG!\nCorrect Answer: ${correct}\n\n💡 ${handleReply.explanation}`;

  return api.sendMessage(result, threadID, messageID);
};
