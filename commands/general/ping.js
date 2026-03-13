const { createEmbed } = require('../../utils/embedBuilder');

module.exports = {
    name: 'ping',
    description: 'Check the bot\'s latency and response time',
    usage: '!ping',
    aliases: ['pong', 'latency'],
    category: 'general',
    
    async executePrefix(message) {
        const sent = await message.reply({
            embeds: [createEmbed('info', 'Pinging...', '')]
        });

        const latency = sent.createdTimestamp - message.createdTimestamp;
        const apiLatency = Math.round(message.client.ws.ping);

        const embed = createEmbed(
            'success',
            'Pong!',
            `**Bot Latency:** ${latency}ms\n**API Latency:** ${apiLatency}ms`
        );

        await sent.edit({ embeds: [embed] });
    }
};