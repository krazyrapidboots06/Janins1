/* =======================================================
   |  Porn command – robust, single‑file or array JSON  |
   ======================================================= */
module.exports.config = {
    name: "porn",
    version: "1.3",
    hasPrefix: true,          // command must start with ! or .
    credits: "syntaxt0x1c",
    role: 2,                  // only for users with role ≥ 2
    description: "Send a random porn video from the public API."
};

module.exports.run = async ({ api, event }) => {
    const axios = require("axios");

    // Tell the user we’re working on the request
    api.setMessageReaction("⏳", event.messageID, () => {}, true);
    api.sendTypingIndicator(event.threadID, true);

    try {
        /* ----------  1️⃣  Pull the JSON file  ---------- */
        const res = await axios.get(
            "https://raw.githubusercontent.com/jaydbohol-crypto/P/refs/heads/main/API/p.json",
            { timeout: 15000 }                     // fail fast if GitHub hangs
        );

        /* ----------  2️⃣  Detect payload shape  ---------- */
        let videoUrl;
        let meta = {
            title: "Adult Video",
            tags: "",
            description: ""
        };

        const data = res.data;

        // Array of objects (new format)
        if (Array.isArray(data) && data.length > 0) {
            const item = data[Math.floor(Math.random() * data.length)];
            if (!item.url) throw new Error("Array item missing 'url' field");
            videoUrl = item.url;
            meta.title = item.title ?? meta.title;
            meta.tags = Array.isArray(item.tags) ? item.tags.join(", ") : meta.tags;
            meta.description = item.description ?? meta.description;
        }
        // Legacy single‑object format with result.video
        else if (data.result && typeof data.result.video === "string") {
            videoUrl = data.result.video;
        }
        // Very old layout that might expose the video at the top level
        else if (typeof data.video === "string") {
            videoUrl = data.video;
        }
        // Anything else is unsupported
        else {
            throw new Error("Unexpected JSON structure – check p.json");
        }

        if (!videoUrl) throw new Error("No video URL found");

        /* ----------  3️⃣  Download the MP4  ---------- */
        const mp4 = await axios.get(videoUrl, { responseType: "arraybuffer", timeout: 20000 });

        /* ----------  4️⃣  Send the results  ---------- */
        // 4.1 – Optional metadata (helps users that open the thread)
        api.sendMessage(
            `🎬 ${meta.title}\n💬 ${meta.tags}\n📄 ${meta.description}`,
            event.threadID
        );

        // 4.2 – Attach the video (Buffer)
        api.sendMessage(
            {
                body: "Enjoy the video 👀",
                attachment: Buffer.from(mp4.data),     // <‑‑ this is what actually gets sent
                mentions: []
            },
            event.threadID
        );
    } catch (e) {
        console.error(e);
        api.setMessageReaction("❌", event.messageID, true);
        return api.sendMessage(
            `❌ Porn command failed: ${e.message}`,
            event.threadID
        );
    }
};
