const { createEmbed } = require('../../utils/embedBuilder');
const { PermissionFlagsBits } = require('discord.js');
const ModLog = require('../../database/models/modLog');

module.exports = {
    name: 'unhardban',
    description: 'Remove hardban from a user (Server Owner only)',
    usage: '!unhardban <user_id> [reason]',
    aliases: ['uhban'],
    category: 'mod',
    
    async executePrefix(message) {
        if (message.guild.ownerId !== message.author.id) {
            return message.reply('<:Deny:1393752012054728784> Only Server Owner can unhardban users');
        }

        if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
            return message.reply('<:Deny:1393752012054728784> You need Ban Members permission');
        }

        const args = message.content.slice(message.content.indexOf(' ') + 1).split(' ');
        
        if (!args[0] || args[0] === message.content) {
            return message.reply('<:Deny:1393752012054728784> Please provide a user ID');
        }

        const userId = args[0];
        const reason = args.slice(1).join(' ') || 'No reason provided';

        if (!/^\d{17,19}$/.test(userId)) {
            return message.reply('<:Deny:1393752012054728784> Invalid user ID format');
        }

        try {
            const bans = await message.guild.bans.fetch();
            const bannedUser = bans.get(userId);
            
            if (!bannedUser) {
                return message.reply('<:Deny:1393752012054728784> User is not banned');
            }

            const hardbanLog = await ModLog.findOne({
                guildId: message.guild.id,
                targetId: userId,
                action: 'hardban',
                isHardban: true
            }).sort({ timestamp: -1 });

            if (!hardbanLog) {
                return message.reply('<:Deny:1393752012054728784> User was not hardbanned. Use !unban instead');
            }

            await message.guild.members.unban(userId, `[UNHARDBAN] ${reason} | Unbanned by ${message.author.tag}`);

            await ModLog.create({
                guildId: message.guild.id,
                moderatorId: message.author.id,
                moderatorTag: message.author.tag,
                targetId: userId,
                targetTag: bannedUser.user.tag,
                action: 'unhardban',
                reason: reason
            });

            message.reply({
                embeds: [createEmbed('success', `<:Check:1393751996267368478> **${bannedUser.user.tag}** unhardbanned`, `**Reason:** ${reason}`)]
            });

        } catch (error) {
            console.error(error);
            message.reply('<:Deny:1393752012054728784> Failed to unhardban user');
        }
    },
};