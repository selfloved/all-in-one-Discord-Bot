const { createEmbed } = require('../../utils/embedBuilder');
const { PermissionFlagsBits } = require('discord.js');
const ModLog = require('../../database/models/modLog');

module.exports = {
    name: 'timeout',
    description: 'Timeout a member',
    usage: '!timeout <user/id> [minutes] [reason]',
    aliases: ['mute'],
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

        let duration;
        let reason;

        if (args[1] && !isNaN(parseInt(args[1]))) {
            duration = parseInt(args[1]);
            reason = args.slice(2).join(' ') || 'No reason provided';
        } else {
            duration = 5;
            reason = args.slice(1).join(' ') || 'No reason provided';
        }

        if (duration < 1 || duration > 40320) {
            return message.reply('<:Deny:1393752012054728784> Duration must be between 1 and 40320 minutes');
        }

        try {
            const member = await message.guild.members.fetch(user.id);
            
            if (!member) {
                return message.reply('<:Deny:1393752012054728784> User not found in this server');
            }

            if (member.roles.highest.position >= message.member.roles.highest.position) {
                return message.reply('<:Deny:1393752012054728784> Target has higher or equal role');
            }

            const botMember = message.guild.members.me;
            if (member.roles.highest.position >= botMember.roles.highest.position) {
                return message.reply('<:Deny:1393752012054728784> Target has higher or equal role than bot');
            }

            const timeoutDuration = duration * 60 * 1000;
            
            await member.timeout(timeoutDuration, `${reason} | Timed out by ${message.author.tag}`);

            await ModLog.create({
                guildId: message.guild.id,
                moderatorId: message.author.id,
                moderatorTag: message.author.tag,
                targetId: user.id,
                targetTag: user.tag,
                action: 'timeout',
                reason: reason,
                duration: duration
            });

            message.reply({
                embeds: [createEmbed('success', `<:Check:1393751996267368478> **${user.tag}** timed out`, `**Duration:** ${duration} minutes\n**Reason:** ${reason}`)]
            });

        } catch (error) {
            console.error(error);
            message.reply('<:Deny:1393752012054728784> Failed to timeout user');
        }
    },
};