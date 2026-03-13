// commands/owner/console.js
const { createEmbed } = require('../../utils/embedBuilder');
const { getRecentLogs, getLogStats } = require('../../utils/logSystem');

const OWNER_ID = '716042573772226580';

module.exports = {
    name: 'console',
    description: 'View the latest bot console logs',
    usage: '!console [count]',
    aliases: ['logs', 'activity'],
    category: 'owner',
    
    async executePrefix(message, args) {
        if (message.author.id !== OWNER_ID) {
            return message.reply({
                embeds: [createEmbed('default', 'Access Denied', 'This command is restricted to the bot owner.')]
            });
        }

        const count = parseInt(args[0]) || 15;
        const maxCount = Math.min(count, 25);
        
        const recentLogs = getRecentLogs(maxCount);
        const stats = getLogStats();
        
        if (recentLogs.length === 0) {
            return message.reply({
                embeds: [createEmbed('default', 'Console Logs', 'No logs available.')]
            });
        }

        const embed = createEmbed('default', 'Bot Console', '');
        
        embed.addFields({
            name: 'Stats',
            value: `**Total:** ${stats.total} | **Errors:** ${stats.error} | **Warnings:** ${stats.warn}`,
            inline: false
        });

        const logLines = recentLogs.map(log => {
            const time = log.timestamp.toLocaleTimeString();
            const typeIcon = getLogTypeIcon(log.type);
            return `${typeIcon} [${time}] ${log.message}`;
        });

        const chunks = [];
        let currentChunk = '';
        
        for (const line of logLines) {
            if ((currentChunk + line + '\n').length > 1000) {
                if (currentChunk) chunks.push(currentChunk);
                currentChunk = line + '\n';
            } else {
                currentChunk += line + '\n';
            }
        }
        
        if (currentChunk) chunks.push(currentChunk);

        chunks.forEach((chunk, index) => {
            const fieldName = chunks.length === 1 ? 'Logs' : `Logs ${index + 1}/${chunks.length}`;
            embed.addFields({
                name: fieldName,
                value: `\`\`\`\n${chunk}\`\`\``,
                inline: false
            });
        });

        await message.reply({ embeds: [embed] });
    }
};

function getLogTypeIcon(type) {
    switch (type) {
        case 'error': return '❌';
        case 'warn': return '⚠️';
        case 'info': return 'ℹ️';
        default: return '📝';
    }
}