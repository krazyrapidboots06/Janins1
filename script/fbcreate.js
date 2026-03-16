const axios = require("axios");

module.exports.config = {
  name: "fbcreate",
  version: "1.0.0",
  role: 0, // Changed from hasPermission: 0 to role: 0
  credits: "Vern",
  description: "Create a Facebook account via Haji-Mix API",
  commandCategory: "utilities",
  usages: "/fbcreate [email]",
  cooldowns: 10
};

module.exports.run = async function({ api, event, args }) {
  const { threadID, messageID } = event;
  
  try {
    const email = args[0] || "yourvern2@gmail.com";
    const amount = 1;
    const apiKey = "f810244328efffe65edb02e899789cdc1b5303156dd950a644a6f2637ce564f0";

    // Send loading message
    const waiting = await api.sendMessage(
      `🔄 Creating Facebook account for email: ${email}...`, 
      threadID
    );

    // Call API
    const url = `https://haji-mix.up.railway.app/api/fbcreate?amount=${amount}&email=${encodeURIComponent(email)}&api_key=${apiKey}`;
    const res = await axios.get(url, { timeout: 30000 });
    
    // Validate response
    if (!res.data?.success || !Array.isArray(res.data.data) || res.data.data.length === 0) {
      throw new Error(res.data?.message || "Unexpected API response");
    }

    const account = res.data.data[0]?.account;
    if (!account) throw new Error("No account data received");

    // Format gender
    const gender = account.gender === "M" ? "Male" : account.gender === "F" ? "Female" : "Other";
    
    // Prepare success message
    const successMsg = 
`✅ **Facebook Account Created!**
━━━━━━━━━━━━━━━━━━
📧 **Email:** ${account.email}
🔑 **Password:** ${account.password}
👤 **Name:** ${account.name}
🎂 **Birthday:** ${account.birthday}
⚧ **Gender:** ${gender}
✉️ **Verification:** ${account.verificationRequired ? "Required" : "Not Required"}
━━━━━━━━━━━━━━━━━━
ℹ️ ${account.message || "Account created successfully!"}`;

    // Update waiting message with results
    await api.editMessage(successMsg, waiting.messageID);

  } catch (error) {
    console.error("[fbcreate] Error:", error.message);
    
    // Error message
    const errorMsg = 
`❌ **Failed to Create Account**
━━━━━━━━━━━━━━━━━━
**Reason:** ${error.response?.data?.message || error.message}
━━━━━━━━━━━━━━━━━━
Please try again later or use a different email.`;

    api.sendMessage(errorMsg, threadID, messageID);
  }
};
