const { createEmbed } = require('../../utils/embedBuilder');
const { PermissionFlagsBits } = require('discord.js');
const ModLog = require('../../database/models/modLog');

module.exports = {
    name: 'ban',
    description: 'Ban a member from the server',
    usage: '!ban <user/id> [reason]',
    aliases: [],
    category: 'mod',
    
    async executePrefix(message) {
        if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
            return message.reply({
                embeds: [createEmbed('error', '<:Deny:1393752012054728784> No Permission', 'You need Ban Members permission')]
            });
        }

        const args = message.content.slice(message.content.indexOf(' ') + 1).split(' ');
        
        if (!args[0] || args[0] === message.content) {
            return message.reply({
                embeds: [createEmbed('error', '<:Deny:1393752012054728784> Invalid Usage', 'Please mention a user or provide user ID')]
            });
        }

        let user;
        let userId;

        const userMention = args[0].match(/^<@!?(\d+)>$/);
        if (userMention) {
            userId = userMention[1];
        } else if (/^\d{17,19}$/.test(args[0])) {
            userId = args[0];
        } else {
            return message.reply({
                embeds: [createEmbed('error', '<:Deny:1389021084925431860> Invalid User', 'Please provide a valid user mention or ID')]
            });
        }

        try {
            user = await message.client.users.fetch(userId);
        } catch {
            return message.reply({
                embeds: [createEmbed('error', '<:Deny:1389021084925431860> User Not Found', 'Could not find user with that ID')]
            });
        }

        const reason = args.slice(1).join(' ') || 'No reason provided';
        const member = await message.guild.members.fetch(user.id).catch(() => null);
        
        if (member && member.roles.highest.position >= message.member.roles.highest.position) {
            return message.reply({
                embeds: [createEmbed('error', '<:Deny:1389021084925431860> Cannot Ban User', 'Target has higher or equal role')]
            });
        }

        try {
            await message.guild.members.ban(user, { 
                reason: `${reason} | Banned by ${message.author.tag}`,
                deleteMessageDays: 1
            });

            await ModLog.create({
                guildId: message.guild.id,
                moderatorId: message.author.id,
                moderatorTag: message.author.tag,
                targetId: user.id,
                targetTag: user.tag,
                action: 'ban',
                reason: reason
            });

            message.reply({
                embeds: [createEmbed('success', `<:Check:1393751996267368478> **${user.tag}** banned`, `**Reason:** ${reason}`)]
            });

        } catch (error) {
            console.error(error);
            message.reply('<:Deny:1393752012054728784> Failed to ban user');
        }
    },
};