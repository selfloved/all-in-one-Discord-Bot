const { createEmbed } = require('../../utils/embedBuilder');
const { PermissionFlagsBits } = require('discord.js');
const ModLog = require('../../database/models/modLog');

module.exports = {
    name: 'modlog',
    description: 'View moderation logs',
    usage: '!modlog [user_id] [page]',
    aliases: ['logs', 'modlogs'],
    category: 'mod',
    
    async executePrefix(message) {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return message.reply('<:Deny:1393752012054728784> You need Manage Messages permission');
        }

        const args = message.content.slice(message.content.indexOf(' ') + 1).split(' ');
        let userId = null;
        let page = 1;

        if (args[0] && args[0] !== message.content) {
            if (/^\d{17,19}$/.test(args[0])) {
                userId = args[0];
                if (args[1] && !isNaN(args[1])) {
                    page = parseInt(args[1]);
                }
            } else if (!isNaN(args[0])) {
                page = parseInt(args[0]);
            }
        }

        try {
            const limit = 10;
            const skip = (page - 1) * limit;

            const query = { guildId: message.guild.id };
            if (userId) {
                query.$or = [
                    { targetId: userId },
                    { moderatorId: userId }
                ];
            }

            const logs = await ModLog.find(query)
                .sort({ timestamp: -1 })
                .skip(skip)
                .limit(limit);

            const totalLogs = await ModLog.countDocuments(query);
            const totalPages = Math.ceil(totalLogs / limit);

            if (logs.length === 0) {
                return message.reply('No moderation logs found.');
            }

            const logText = logs.map((log, index) => {
                const timestamp = Math.floor(log.timestamp.getTime() / 1000);
                
                let logLine = `**${log.action.charAt(0).toUpperCase() + log.action.slice(1)}** - ${log.targetTag}`;
                if (log.duration) logLine += ` (${log.duration}m)`;
                logLine += `\nModerator: ${log.moderatorTag}`;
                logLine += `\nTime: <t:${timestamp}:R>`;
                if (log.reason && log.reason !== 'No reason provided') {
                    const maxLength = ['lock', 'unlock', 'roleall'].includes(log.action) ? 100 : 80;
                    logLine += `\nReason: ${log.reason.length > maxLength ? log.reason.substring(0, maxLength) + '...' : log.reason}`;
                }

                return logLine;
            }).join('\n\n');

            const title = userId ? 
                `Moderation Logs for <@${userId}>` : 
                'Recent Moderation Logs';

            const embed = createEmbed('default', title, logText);
            embed.setFooter({ text: `Page ${page}/${totalPages} • Total: ${totalLogs} logs` });

            message.reply({ embeds: [embed] });

        } catch (error) {
            console.error(error);
            message.reply('<:Deny:1393752012054728784> Failed to fetch logs');
        }
    },
};