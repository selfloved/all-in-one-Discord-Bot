const { createEmbed } = require('../../utils/embedBuilder');
const { PermissionFlagsBits } = require('discord.js');
const ModLog = require('../../database/models/modLog');

module.exports = {
    name: 'unban',
    description: 'Unban a user from the server',
    usage: '!unban <user_id> [reason]',
    aliases: [],
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

            await message.guild.members.unban(userId, `${reason} | Unbanned by ${message.author.tag}`);

            await ModLog.create({
                guildId: message.guild.id,
                moderatorId: message.author.id,
                moderatorTag: message.author.tag,
                targetId: userId,
                targetTag: bannedUser.user.tag,
                action: 'unban',
                reason: reason
            });

            message.reply({
                embeds: [createEmbed('success', `<:Check:1393751996267368478> **${bannedUser.user.tag}** unbanned`, `**Reason:** ${reason}`)]
            });

        } catch (error) {
            console.error(error);
            message.reply('<:Deny:1393752012054728784> Failed to unban user');
        }
    },
};