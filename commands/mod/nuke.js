const { createEmbed } = require('../../utils/embedBuilder');
const { PermissionFlagsBits } = require('discord.js');
const ModLog = require('../../database/models/modLog');

module.exports = {
    name: 'nuke',
    description: 'Nuke and recreate the current channel',
    usage: '!nuke [reason]',
    aliases: ['channelnuke'],
    category: 'mod',
    
    async executePrefix(message) {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return message.reply({
                embeds: [createEmbed('error', '<:Deny:1393752012054728784> No Permission', 'You need Manage Channels permission')]
            });
        }

        const args = message.content.slice(message.content.indexOf(' ') + 1).split(' ');
        const reason = (args[0] !== message.content ? args.join(' ') : '') || `Channel nuked by ${message.author.tag}`;

        const channel = message.channel;

        try {
            const channelData = {
                name: channel.name,
                type: channel.type,
                topic: channel.topic,
                nsfw: channel.nsfw,
                bitrate: channel.bitrate,
                userLimit: channel.userLimit,
                rateLimitPerUser: channel.rateLimitPerUser,
                position: channel.position,
                permissionOverwrites: channel.permissionOverwrites.cache.map(overwrite => ({
                    id: overwrite.id,
                    type: overwrite.type,
                    allow: overwrite.allow.bitfield.toString(),
                    deny: overwrite.deny.bitfield.toString()
                })),
                parent: channel.parent
            };

            await ModLog.create({
                guildId: message.guild.id,
                moderatorId: message.author.id,
                moderatorTag: message.author.tag,
                targetId: channel.id,
                targetTag: `#${channel.name}`,
                action: 'nuke',
                reason: reason
            });

            const newChannel = await message.guild.channels.create({
                name: channelData.name,
                type: channelData.type,
                topic: channelData.topic,
                nsfw: channelData.nsfw,
                bitrate: channelData.bitrate,
                userLimit: channelData.userLimit,
                rateLimitPerUser: channelData.rateLimitPerUser,
                parent: channelData.parent,
                permissionOverwrites: channelData.permissionOverwrites,
                reason: reason
            });

            await channel.delete(reason);

            await newChannel.setPosition(channelData.position);

            await newChannel.send('👍');

        } catch (error) {
            console.error(error);
            if (!channel.deleted) {
                message.reply({
                    embeds: [createEmbed('error', '<:Deny:1393752012054728784> Failed to nuke channel', '')]
                });
            }
        }
    },
};