const { createEmbed } = require('../../utils/embedBuilder');
const { PermissionFlagsBits } = require('discord.js');
const ModLog = require('../../database/models/modLog');

module.exports = {
    name: 'kick',
    description: 'Kick a member from the server',
    usage: '!kick <user/id> [reason]',
    aliases: [],
    category: 'mod',
    
    async executePrefix(message) {
        if (!message.member.permissions.has(PermissionFlagsBits.KickMembers)) {
            return message.reply('<:Deny:1393752012054728784> You need Kick Members permission');
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

            if (member.roles.highest.position >= message.member.roles.highest.position) {
                return message.reply('<:Deny:1393752012054728784> Target has higher or equal role');
            }

            const botMember = message.guild.members.me;
            if (member.roles.highest.position >= botMember.roles.highest.position) {
                return message.reply('<:Deny:1393752012054728784> Target has higher or equal role than bot');
            }

            await member.kick(`${reason} | Kicked by ${message.author.tag}`);

            await ModLog.create({
                guildId: message.guild.id,
                moderatorId: message.author.id,
                moderatorTag: message.author.tag,
                targetId: user.id,
                targetTag: user.tag,
                action: 'kick',
                reason: reason
            });

            message.reply({
                embeds: [createEmbed('success', `<:Check:1393751996267368478> **${user.tag}** kicked`, `**Reason:** ${reason}`)]
            });

        } catch (error) {
            console.error(error);
            message.reply('<:Deny:1393752012054728784> Failed to kick user');
        }
    },
};