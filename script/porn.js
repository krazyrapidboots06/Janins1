/* ========  Porn command  ======== */
module.exports.config = {
	name: "porn",
	version: "1.1",
	hasPrefix: true,          // required – we’re sending NSFW content
	credits: "syntaxt0x1c",
	role: 2,
	description: "Send a random porn video from the public API.",
};

module.exports.run = async ({ api, event }) => {
	const axios = require("axios");

	/* Tell the user we’re working on the request */
	await api.setMessageReaction("⏳", event.messageID, err => {}, true);
	api.sendTypingIndicator(event.threadID, true);

	try {
		/* Grab the JSON array from the raw GitHub file */
		const res = await axios.get(
			"https://raw.githubusercontent.com/jaydbohol-crypto/P/refs/heads/main/API/p.json"
		);

		/* Validate the payload */
		if (!Array.isArray(res.data) || res.data.length === 0) {
			return api.sendMessage("❌ No video data found.", event.threadID);
		}

		/* Pick a random entry */
		const vid = res.data[Math.floor(Math.random() * res.data.length)];

		/* Basic sanity check – we expect at least a `url` field */
		if (!vid.url || typeof vid.url !== "string") {
			return api.sendMessage("❌ Selected video has no valid URL.", event.threadID);
		}

		/* Optional metadata: title / tags / description */
		const title = vid.title ?? "Adult Video";
		const tags  = Array.isArray(vid.tags) ? vid.tags.join(", ") : "";
		const desc  = vid.description ?? "";

		/* Send the metadata first (so the attachment isn’t lost) */
		await api.sendMessage(
			`🎬 ${title}\n💬 ${tags}\n📄 ${desc}`,
			event.threadID
		);

		/* Finally send the video file as an attachment */
		await api.sendMessage(
			{
				body: "Enjoy the video 👀",
				attachment: vid.url,
				mentions: [],
			},
			event.threadID
		);

	} catch (e) {
		console.error(e);
		await api.setMessageReaction("❌", event.messageID, true);
		return api.sendMessage("❌ Failed to fetch porn video.", event.threadID);
	}
};
