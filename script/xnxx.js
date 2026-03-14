module.exports.config = {
	name: 'xnxx',
	version: '1.0.0', 
	role: 2,
	credits: 'syntaxt0x1c',
	description: 'Search for XXX videos using the Deku API.',
	usages: '[search term]',
	cooldown: 5, // seconds
	hasPrefix: true,
};

module.exports.run = async ({ api, event }) => {
    try {
        const { threadID } = event;
        
        if (!args[0]) return api.sendMessage('Usage: !xnxx [search term]', threadID);
        
        let searchQuery = encodeURIComponent(args.join(" "));
        const url = `https://deku-api.giize.com/xsearch?q=${searchQuery}`;

        // Quick reaction
        await api.setMessageReaction("⏳", event.messageID, (err) => {}, true);

        // Fetch from Deku API
        const response = await fetch(url);
        
        if (!response.ok) {
            return api.sendMessage('Error fetching search results.', threadID);
        }
        
        const data = await response.json();
        
        // Format and send the result to user
        let message = '';
        data.forEach((vid, idx) => {
            message += `Result ${idx+1}:\n`;
            message += vid.url + '\n';
            
            // Limit output - adjust per your needs
            if (idx === 4) return; 
        });
        
        api.sendMessage(message || 'No results found.', threadID);
    } catch (e) {
        console.error(e);
        await api.setMessageReaction("❌", event.messageID, true);
        return api.sendMessage('Error searching XXX material.', threadID);
    }
};
