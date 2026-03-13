const { PermissionFlagsBits } = require('discord.js');
const ModLog = require('../../database/models/modLog');

const LOCK_ROLE_ID = '1393920823735095306';

module.exports = {
    name: 'unlock',
    description: 'Unlock the current channel (allow @everyone to send messages)',
    usage: '!unlock',
    aliases: ['unlockdown'],
    category: 'mod',

    async executePrefix(message) {
        if (!message.member.roles.cache.has(LOCK_ROLE_ID)) {
            return message.reply('<:Deny:1393752012054728784> You need the required role to use this command');
        }

        if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return message.reply('<:Deny:1393752012054728784> Bot needs Manage Channels permission');
        }

        const channel = message.channel;
        const everyoneRole = message.guild.roles.everyone;

        try {
            await channel.permissionOverwrites.edit(everyoneRole, {
                SendMessages: true,
                ViewChannel: true,
            });

            await ModLog.create({
                guildId: message.guild.id,
                moderatorId: message.author.id,
                moderatorTag: message.author.tag,
                targetId: channel.id,
                targetTag: `#${channel.name}`,
                action: 'unlock',
                reason: `Channel unlocked by ${message.author.tag}`
            });

            message.reply('<:Check:1393751996267368478> Channel unlocked');
        } catch (error) {
            console.error(error);
            message.reply('<:Deny:1393752012054728784> Failed to unlock channel');
        }
    },
};