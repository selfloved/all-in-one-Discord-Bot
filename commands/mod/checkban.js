const { createEmbed } = require('../../utils/embedBuilder');
const { PermissionFlagsBits } = require('discord.js');
const ModLog = require('../../database/models/modLog');

module.exports = {
    name: 'checkban',
    description: 'Check ban status of a user',
    usage: '!checkban <user_id>',
    aliases: ['baninfo'],
    category: 'mod',
    
    async executePrefix(message) {
        if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
            return message.reply('<:Deny:1393752012054728784> You need Ban Members permission');
        }

        const args = message.content.slice(message.content.indexOf(' ') + 1).split(' ');
        
        if (!args[0] || args[0] === message.content) {
            return message.reply('<:Deny:1393752012054728784> Please provide a user ID');
        }

        const userId = args[0];

        if (!/^\d{17,19}$/.test(userId)) {
            return message.reply('<:Deny:1393752012054728784> Invalid user ID format');
        }

        try {
            const bans = await message.guild.bans.fetch();
            const bannedUser = bans.get(userId);
            
            if (!bannedUser) {
                return message.reply({
                    embeds: [createEmbed('info', '<:Check:1393751996267368478> User Not Banned', 'This user is not currently banned')]
                });
            }

            const banLogs = await ModLog.find({
                guildId: message.guild.id,
                targetId: userId,
                action: { $in: ['ban', 'hardban'] }
            }).sort({ timestamp: -1 }).limit(1);

            const latestBan = banLogs[0];

            if (!latestBan) {
                return message.reply({
                    embeds: [createEmbed('warning', '<:Warning:1393752109119176755> User Banned', 'User is banned but no log found in database')]
                });
            }

            const isHardban = latestBan.action === 'hardban' || latestBan.isHardban;
            const banTime = Math.floor(latestBan.timestamp.getTime() / 1000);

            const description = [
                `**User:** ${bannedUser.user.tag}`,
                `**Ban Type:** ${isHardban ? 'HARDBAN 🔴' : 'Regular Ban 🔨'}`,
                `**Banned By:** ${latestBan.moderatorTag}`,
                `**Banned:** <t:${banTime}:R>`,
                `**Reason:** ${latestBan.reason}`,
                isHardban ? '\n⚠️ **This is a hardban - only Server Owner can unban**' : ''
            ].filter(Boolean).join('\n');

            message.reply({
                embeds: [createEmbed('info', '<:User:1393752101687136269> Ban Information', description)]
            });

        } catch (error) {
            console.error(error);
            message.reply('<:Deny:1393752012054728784> Failed to check ban status');
        }
    },
};