const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

module.exports.config = {
  name: "fbstalk",
  version: "2.0.0",
  role: 0,
  credits: "selov",
  description: "Get full information from public Facebook users",
  commandCategory: "social",
  usages: "/stalk <username or UID>",
  cooldowns: 5,
  aliases: ["fbstalk", "userinfo", "fbuser"]
};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, senderID } = event;
  let target = args.join(" ").trim();

  if (!target) {
    return api.sendMessage(
      `🔍 FBSTALK COMMAND\n━━━━━━━━━━━━━━━━\n` +
      `Get full information from public Facebook users.\n\n` +
      `Usage: /stalk <username or UID>\n` +
      `Examples:\n` +
      `• /stalk zuck\n` +
      `• /stalk 100025113282190\n` +
      `• /stalk https://facebook.com/username\n\n` +
      `⚠️ Works only for PUBLIC profiles!`,
      threadID,
      messageID
    );
  }

  // Extract UID from URL if provided
  if (target.includes("facebook.com")) {
    const urlMatch = target.match(/(?:facebook\.com\/)(?:profile\.php\?id=)?([^\/?&]+)/);
    if (urlMatch) {
      target = urlMatch[1];
    }
  }

  api.sendTypingIndicator(threadID, true);
  const waitingMsg = await api.sendMessage(`🔍 Fetching public info for ${target}...`, threadID);

  try {
    // Method 1: Try to get UID first if username was provided
    let uid = target;
    
    if (isNaN(target)) {
      try {
        // Try to resolve username to UID
        const resolveUrl = `https://graph.facebook.com/v19.0/${target}?fields=id&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`;
        const resolveRes = await axios.get(resolveUrl, { timeout: 10000 });
        if (resolveRes.data?.id) {
          uid = resolveRes.data.id;
        }
      } catch (e) {
        console.log("Username resolution failed, using as-is");
      }
    }
    
    // Get full user info using Facebook Graph API (public info only)
    const fields = [
      "id", "name", "first_name", "last_name", "middle_name", "name_format",
      "about", "birthday", "email", "gender", "hometown", "location",
      "website", "link", "username", "third_party_id", "relationship_status",
      "significant_other", "quotes", "favorite_athletes", "favorite_teams",
      "inspirational_people", "sports", "likes", "education", "work",
      "interested_in", "languages", "age_range", "cover", "picture.width(800).height(800)",
      "friends.limit(0)", "posts.limit(5)"
    ];
    
    const apiUrl = `https://graph.facebook.com/v19.0/${uid}?fields=${fields.join(',')}&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`;
    
    const response = await axios.get(apiUrl, { timeout: 20000 });
    const user = response.data;
    
    // Check if user exists and is public
    if (!user || !user.id) {
      throw new Error("User not found or profile is private");
    }
    
    // Check if limited info (private profile)
    if (user.name && Object.keys(user).length <= 3) {
      return api.editMessage(
        `❌ Cannot fetch full info**\n━━━━━━━━━━━━━━━━\n` +
        `👤 Name: ${user.name}\n` +
        `🆔 UID: ${user.id}\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `⚠️ This user has a PRIVATE profile.\n` +
        `Full information is not available.\n\n` +
        `💡 Only PUBLIC profiles can be fully stalked.`,
        waitingMsg.messageID
      );
    }
    
    // Download profile picture
    const cacheDir = path.join(__dirname, "cache", "stalk");
    await fs.ensureDir(cacheDir);
    
    const picUrl = user.picture?.data?.url || `https://graph.facebook.com/${uid}/picture?width=800&height=800`;
    const picResponse = await axios.get(picUrl, { responseType: 'arraybuffer', timeout: 10000 });
    const picPath = path.join(cacheDir, `profile_${uid}_${Date.now()}.jpg`);
    fs.writeFileSync(picPath, Buffer.from(picResponse.data));
    
    // Build full info message
    let infoMsg = `👤 PUBLIC PROFILE INFO\n━━━━━━━━━━━━━━━━\n`;
    infoMsg += `📛 Name: ${user.name || 'N/A'}\n`;
    if (user.first_name) infoMsg += `📝 First Name: ${user.first_name}\n`;
    if (user.last_name) infoMsg += `📝 Last Name: ${user.last_name}\n`;
    infoMsg += `🆔 User ID: ${user.id}\n`;
    if (user.username) infoMsg += `🔗 Username: @${user.username}\n`;
    infoMsg += `🌐 Profile Link: ${user.link || `https://facebook.com/${user.id}`}\n`;
    if (user.gender) infoMsg += `⚧ Gender: ${user.gender === "male" ? "Male" : user.gender === "female" ? "Female" : user.gender}\n`;
    if (user.about) infoMsg += `📖 Bio: ${user.about.substring(0, 200)}${user.about.length > 200 ? '...' : ''}\n`;
    if (user.birthday) infoMsg += `🎂 Birthday: ${user.birthday}\n`;
    if (user.location?.name) infoMsg += `📍 Location: ${user.location.name}\n`;
    if (user.hometown?.name) infoMsg += `🏠 Hometown: ${user.hometown.name}\n`;
    if (user.relationship_status) infoMsg += `💕 Relationship: ${user.relationship_status}\n`;
    if (user.website) infoMsg += `🌐 Website: ${user.website}\n`;
    if (user.email && user.email !== "null") infoMsg += `📧 Email: ${user.email}\n`;
    if (user.age_range) infoMsg += `📊 Age Range: ${user.age_range.min || '?'}-${user.age_range.max || '?'}\n`;
    
    // Education
    if (user.education && user.education.length > 0) {
      infoMsg += `\n🎓 Education:\n`;
      user.education.slice(0, 3).forEach(edu => {
        infoMsg += `   • ${edu.school?.name || 'Unknown'}`;
        if (edu.year?.name) infoMsg += ` (${edu.year.name})`;
        if (edu.degree) infoMsg += ` - ${edu.degree}`;
        infoMsg += `\n`;
      });
    }
    
    // Work
    if (user.work && user.work.length > 0) {
      infoMsg += `\n💼 Work:\n`;
      user.work.slice(0, 3).forEach(work => {
        infoMsg += `   • ${work.employer?.name || 'Unknown'}`;
        if (work.position?.name) infoMsg += ` - ${work.position.name}`;
        infoMsg += `\n`;
      });
    }
    
    infoMsg += `━━━━━━━━━━━━━━━━\n`;
    infoMsg += `🔓 Profile is PUBLIC - Full info available\n`;
    infoMsg += `⏱️ Fetched: ${new Date().toLocaleString()}`;
    
    await api.unsendMessage(waitingMsg.messageID);
    
    // Send full info with profile picture
    api.sendMessage({
      body: infoMsg,
      attachment: fs.createReadStream(picPath)
    }, threadID, () => {
      setTimeout(() => {
        try {
          if (fs.existsSync(picPath)) fs.unlinkSync(picPath);
        } catch (e) {}
      }, 10000);
    }, messageID);
    
  } catch (err) {
    console.error("Stalk Error:", err);
    await api.unsendMessage(waitingMsg.messageID);
    
    let errorMsg = `❌ STALK FAILED\n━━━━━━━━━━━━━━━━\n`;
    errorMsg += `🔍 Target: ${target}\n`;
    errorMsg += `🔴 Error: ${err.message}\n\n`;
    errorMsg += `💡 Possible reasons:\n`;
    errorMsg += `• User not found\n`;
    errorMsg += `• Profile is PRIVATE\n`;
    errorMsg += `• Invalid username/UID\n`;
    errorMsg += `• API rate limit exceeded\n\n`;
    errorMsg += `🔓 This command only works for PUBLIC profiles.`;
    
    api.sendMessage(errorMsg, threadID, messageID);
  }
};
