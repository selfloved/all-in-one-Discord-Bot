const { createEmbed } = require('../../utils/embedBuilder');
const { PermissionFlagsBits } = require('discord.js');
const ModLog = require('../../database/models/modLog');

const BOT_OWNER_ID = '';

module.exports = {
    name: 'hardban',
    description: 'Permanently ban a user (Server Owner/Bot Owner only)',
    usage: '!hardban <user_id> [reason]',
    aliases: ['hban'],
    category: 'mod',
    
    async executePrefix(message) {
        const isServerOwner = message.guild.ownerId === message.author.id;
        const isBotOwner = message.author.id === BOT_OWNER_ID;
        
        if (!isServerOwner && !isBotOwner) {
            return message.reply('<:Deny:1393752012054728784> Only Server Owner or Bot Owner can use hardban');
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
            let user;
            try {
                user = await message.client.users.fetch(userId);
            } catch {
                user = { id: userId, tag: `Unknown User (${userId})` };
            }

            const member = await message.guild.members.fetch(userId).catch(() => null);
            if (member && member.roles.highest.position >= message.member.roles.highest.position && !isServerOwner && !isBotOwner) {
                return message.reply('<:Deny:1393752012054728784> Target has higher or equal role');
            }

            const botMember = message.guild.members.me;
            if (member && member.roles.highest.position >= botMember.roles.highest.position && !isServerOwner && !isBotOwner) {
                return message.reply('<:Deny:1393752012054728784> Target has higher or equal role than bot');
            }

            await message.guild.members.ban(userId, { 
                reason: `[HARDBAN] ${reason} | Banned by ${message.author.tag}`,
                deleteMessageDays: 7
            });

            await ModLog.create({
                guildId: message.guild.id,
                moderatorId: message.author.id,
                moderatorTag: message.author.tag,
                targetId: user.id,
                targetTag: user.tag,
                action: 'hardban',
                reason: reason,
                isHardban: true
            });

            message.reply({
                embeds: [createEmbed('success', `<:Check:1393751996267368478> **${user.tag}** hardbanned`, `**Reason:** ${reason}\n**Note:** Can only be unbanned by Server Owner`)]
            });

        } catch (error) {
            console.error(error);
            message.reply('<:Deny:1393752012054728784> Failed to hardban user');
        }
    },
};