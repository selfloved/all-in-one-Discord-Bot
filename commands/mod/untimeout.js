const { createEmbed } = require('../../utils/embedBuilder');
const { PermissionFlagsBits } = require('discord.js');
const ModLog = require('../../database/models/modLog');

module.exports = {
    name: 'untimeout',
    description: 'Remove timeout from a member',
    usage: '!untimeout <user/id> [reason]',
    aliases: ['unmute'],
    category: 'mod',
    
    async executePrefix(message) {
        if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            return message.reply('<:Deny:1393752012054728784> You need Moderate Members permission');
        }

        const args = message.content.slice(message.content.indexOf(' ') + 1).split(' ');
        
        if (!args[0] || args[0] === message.content) {
            return message.reply('<:Deny:1393752012054728784> Please mention a user or provide user ID');
        }

        let user;
        let userId;

        const userMention = args[0].match(/^<@!?(\d+)>$/);
        if (userMention) {
            userId = userMention[1];
        } else if (/^\d{17,19}$/.test(args[0])) {
            userId = args[0];
        } else {
            return message.reply('<:Deny:1393752012054728784> Please provide a valid user mention or ID');
        }

        try {
            user = await message.client.users.fetch(userId);
        } catch {
            return message.reply('<:Deny:1393752012054728784> Could not find user with that ID');
        }

        const reason = args.slice(1).join(' ') || 'No reason provided';

        try {
            const member = await message.guild.members.fetch(user.id);
            
            if (!member) {
                return message.reply('<:Deny:1393752012054728784> User not found in this server');
            }

            if (!member.isCommunicationDisabled()) {
                return message.reply('<:Deny:1393752012054728784> User is not timed out');
            }

            const botMember = message.guild.members.me;
            if (member.roles.highest.position >= botMember.roles.highest.position) {
                return message.reply('<:Deny:1393752012054728784> Target has higher or equal role than bot');
            }

            await member.timeout(null, `${reason} | Timeout removed by ${message.author.tag}`);

            await ModLog.create({
                guildId: message.guild.id,
                moderatorId: message.author.id,
                moderatorTag: message.author.tag,
                targetId: user.id,
                targetTag: user.tag,
                action: 'untimeout',
                reason: reason
            });

            message.reply({
                embeds: [createEmbed('success', `<:Check:1393751996267368478> **${user.tag}** timeout removed`, `**Reason:** ${reason}`)]
            });

        } catch (error) {
            console.error(error);
            message.reply('<:Deny:1393752012054728784> Failed to remove timeout');
        }
    },
};