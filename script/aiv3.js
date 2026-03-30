const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

// Gemini API configuration - USING YOUR API KEY
const GEMINI_API_KEY = "AIzaSyBQ_ozp3futjo4aM5oreIB_lsAbhCKzLOs";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent";

// Fixed voice - Puck only
const VOICE = "Puck";

module.exports.config = {
  name: "aiv3",
  version: "1.0.0",
  role: 0,
  credits: "selov",
  description: "AI with Puck voice TTS response",
  commandCategory: "ai",
  usages: "/aiv3 <question>",
  cooldowns: 5,
  aliases: ["puck", "selov"]
};

// Simple memory per thread
const memory = {};

// AI character persona
const AI_PERSONA = `You are a helpful AI assistant. Respond in a warm, friendly, and concise manner. Keep your answers short and helpful (under 200 characters).`;

// Helper: Create WAV file from PCM data
function createWaveFile(filePath, pcmData, channels = 1, rate = 24000, sampleWidth = 2) {
  const wavHeader = Buffer.alloc(44);
  
  // RIFF chunk
  wavHeader.write("RIFF", 0);
  wavHeader.writeUInt32LE(36 + pcmData.length, 4);
  wavHeader.write("WAVE", 8);
  
  // fmt subchunk
  wavHeader.write("fmt ", 12);
  wavHeader.writeUInt32LE(16, 16);
  wavHeader.writeUInt16LE(1, 20);
  wavHeader.writeUInt16LE(channels, 22);
  wavHeader.writeUInt32LE(rate, 24);
  wavHeader.writeUInt32LE(rate * channels * sampleWidth, 28);
  wavHeader.writeUInt16LE(channels * sampleWidth, 32);
  wavHeader.writeUInt16LE(sampleWidth * 8, 34);
  
  // data subchunk
  wavHeader.write("data", 36);
  wavHeader.writeUInt32LE(pcmData.length, 40);
  
  // Write header and data
  fs.writeFileSync(filePath, wavHeader);
  fs.appendFileSync(filePath, pcmData);
}

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, senderID } = event;
  let prompt = args.join(" ").trim();

  try {
    // Get user name
    const user = await api.getUserInfo(senderID);
    const senderName = user[senderID]?.name || "User";
    const firstName = senderName.split(' ')[0] || senderName;

    // Initialize memory
    if (!memory[threadID]) {
      memory[threadID] = {
        users: {},
        conversations: []
      };
    }
    
    // Store user info
    memory[threadID].users[senderID] = {
      name: senderName,
      firstName: firstName,
      lastSeen: Date.now(),
      interactions: (memory[threadID].users[senderID]?.interactions || 0) + 1
    };

    if (!prompt) {
      return api.sendMessage(
        `🎙️ AI TTS COMMAND\n━━━━━━━━━━━━━━━━\n` +
        `Hello ${firstName}! Ask me anything and I'll respond with voice.\n\n` +
        `Example: /aiv3 What is the meaning of life?\n` +
        `Example: /aiv3 Tell me a joke\n` +
        `Example: /aiv3 How are you today?\n\n` +
        `🎤 `,
        threadID,
        messageID
      );
    }
    
    // Show typing indicator
    api.sendTypingIndicator(threadID, true);
    
    // Get AI response
    const enhancedPrompt = `${AI_PERSONA}\n\nThe user's name is ${firstName}. Please address them by their name in your response. Question: ${prompt}`;
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
    
    // Limit length for TTS
    if (replyText.length > 200) {
      replyText = replyText.substring(0, 197) + "...";
    }
    
    // Store conversation
    memory[threadID].conversations.push({
      user: senderID,
      userName: firstName,
      prompt: prompt,
      response: replyText,
      timestamp: Date.now()
    });
    
    if (memory[threadID].conversations.length > 10) {
      memory[threadID].conversations.shift();
    }
    
    // Create cache directory
    const cacheDir = path.join(__dirname, "cache", "aiv3");
    await fs.ensureDir(cacheDir);
    
    // Send processing message
    const processingMsg = await api.sendMessage(`🎤 Generating Puck voice response...`, threadID);
    
    try {
      // Prepare API request with your key
      const url = `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`;
      
      const payload = {
        contents: [
          {
            parts: [
              {
                text: replyText
              }
            ]
          }
        ],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: VOICE
              }
            }
          }
        }
      };
      
      const response = await axios.post(url, payload, {
        timeout: 60000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      // Extract audio data from response
      const audioData = response.data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      
      if (!audioData) {
        throw new Error("No audio data received");
      }
      
      // Convert base64 to buffer
      const audioBuffer = Buffer.from(audioData, 'base64');
      
      const audioPath = path.join(cacheDir, `aiv3_${Date.now()}.wav`);
      
      // Create WAV file from PCM data
      createWaveFile(audioPath, audioBuffer);
      
      // Check file size
      const stats = fs.statSync(audioPath);
      if (stats.size === 0) {
        throw new Error("Generated audio file is empty");
      }
      
      // Delete processing message
      await api.unsendMessage(processingMsg.messageID);
      
      // Send ONLY audio
      api.sendMessage({
        attachment: fs.createReadStream(audioPath)
      }, threadID, () => {
        // Clean up file after sending
        setTimeout(() => {
          try {
            if (fs.existsSync(audioPath)) {
              fs.unlinkSync(audioPath);
            }
          } catch (e) {}
        }, 10000);
      }, messageID);
      
    } catch (ttsErr) {
      console.error("TTS Error:", ttsErr.response?.data || ttsErr.message);
      
      let errorMsg = "❌ Failed to generate voice response.";
      
      if (ttsErr.response?.status === 401) {
        errorMsg = "❌ Invalid Gemini API key. Please check your API key.";
      } else if (ttsErr.response?.status === 429) {
        errorMsg = "❌ Rate limit exceeded. Please try again later.";
      } else if (ttsErr.code === 'ECONNABORTED') {
        errorMsg = "❌ Request timed out. Please try again.";
      } else if (ttsErr.response?.data?.error?.message) {
        errorMsg = `❌ ${ttsErr.response.data.error.message}`;
      }
      
      await api.editMessage(errorMsg, processingMsg.messageID);
    }
    
  } catch (err) {
    console.error("AIv3 Error:", err);
    // Silent fail - no error message to user
  }
};
