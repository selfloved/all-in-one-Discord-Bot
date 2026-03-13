const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { TempChannel, VoicePermit, VoiceBan } = require('../../database/models/Voicemaster');
const { isChannelOwner, getUserFromString } = require('../../utils/voicemasterUtils');
const { logChannelAction } = require('../../events/voiceStateUpdate');
const Guild = require('../../database/models/Guild');

module.exports = {
    name: 'vc',
    aliases: ['voice'],
    description: 'Voice channel management commands',
    usage: 'vc <permit/unban/banned/ban/kick/lock/unlock/hide/show/rename> [user/name]',
    category: 'voice',
    
    async executePrefix(message, args) {
        let guildDoc = await Guild.findOne({ guildId: message.guild.id });
        const prefix = guildDoc?.prefix || '!';

        if (!message.member.voice.channelId) {
            if (args[0]?.toLowerCase() === 'help') {
                return await handleHelpCommand(message, prefix);
            }
            const embed = new EmbedBuilder()
                .setDescription(`You must be in a voice channel to use this command.`)
                .setColor(0xED4245);
            return message.reply({ embeds: [embed] });
        }

        if (args[0]?.toLowerCase() === 'help') {
            return await handleHelpCommand(message, prefix);
        }

        const subcommand = args[0]?.toLowerCase();
        const channel = message.member.voice.channel;

        if (subcommand === 'claim') {
            return await handleClaimCommand(message, channel);
        }

        const isOwner = await isChannelOwner(message.member.voice.channelId, message.member.id);
        if (!isOwner) {
            const embed = new EmbedBuilder()
                .setDescription(`Only the channel owner can use this command.`)
                .setColor(0xED4245);
            return message.reply({ embeds: [embed] });
        }

        switch (subcommand) {
            case 'permit':
                await handlePermitCommand(message, args, channel);
                break;
            case 'unpermit':
                await handleUnpermitCommand(message, args, channel);
                break;
            case 'permitted':
                await handlePermittedCommand(message, channel);
                break;
            case 'unban':
                await handleUnbanCommand(message, args, channel);
                break;
            case 'banned':
                await handleBannedCommand(message, channel);
                break;
            case 'ban':
                await handleBanCommand(message, args, channel);
                break;
            case 'kick':
                await handleKickCommand(message, args, channel);
                break;
            case 'lock':
                await handleLockCommand(message, channel);
                break;
            case 'unlock':
                await handleUnlockCommand(message, channel);
                break;
            case 'hide':
                await handleHideCommand(message, channel);
                break;
            case 'show':
                await handleShowCommand(message, channel);
                break;
            case 'rename':
                await handleRenameCommand(message, args, channel);
                break;
            case 'help':
                await handleHelpCommand(message, prefix);
                break;
            default:
                const embed = new EmbedBuilder()
                    .setDescription(`**Invalid command!**\n\nUse \`${prefix}vc help\` to see all available commands.`)
                    .setColor(0xED4245);
                return message.reply({ embeds: [embed] });
        }
    }
}

async function handleUnpermitCommand(message, args, channel) {
    if (!args[1]) {
        const embed = new EmbedBuilder()
            .setDescription(`Please mention a user or provide their ID.`)
            .setColor(0xED4245);
        return message.reply({ embeds: [embed] });
    }

    try {
        const user = await getUserFromString(message.guild, args.slice(1).join(' '));
        if (!user) {
            const embed = new EmbedBuilder()
                .setDescription(`User not found.`)
                .setColor(0xED4245);
            return message.reply({ embeds: [embed] });
        }

        const tempChannel = await TempChannel.findOne({ channelId: channel.id });
        if (tempChannel && user.id === tempChannel.ownerId) {
            const embed = new EmbedBuilder()
                .setDescription(`The channel owner cannot be unpermitted.`)
                .setColor(0xED4245);
            return message.reply({ embeds: [embed] });
        }

        const permit = await VoicePermit.findOne({
            channelId: channel.id,
            userId: user.id
        });

        if (!permit) {
            const embed = new EmbedBuilder()
                .setDescription(`${user.displayName} is not permitted in this channel.`)
                .setColor(0xED4245);
            return message.reply({ embeds: [embed] });
        }

        await VoicePermit.deleteOne({
            channelId: channel.id,
            userId: user.id
        });

        await channel.permissionOverwrites.delete(user.id);

        await logChannelAction(
            message.guild.id,
            message.member,
            channel,
            'UNPERMIT_USER',
            `Removed permit from **${user.displayName}** (\`${user.id}\`)`
        );

        const embed = new EmbedBuilder()
            .setDescription(`${user} permit has been removed from your voice channel.`)
            .setColor(0x57F287);
        await message.reply({ embeds: [embed] });
    } catch (error) {
        const embed = new EmbedBuilder()
            .setDescription(`Failed to unpermit user.`)
            .setColor(0xED4245);
        await message.reply({ embeds: [embed] });
    }
}

async function handlePermittedCommand(message, channel) {
    try {
        const permits = await VoicePermit.find({ channelId: channel.id });

        if (permits.length === 0) {
            const embed = new EmbedBuilder()
                .setDescription(`No users are permitted in your voice channel.`)
                .setColor(0x57F287);
            return message.reply({ embeds: [embed] });
        }

        let permittedList = 'Permitted Users:\n\n';
        
        for (const permit of permits) {
            try {
                const user = await message.guild.members.fetch(permit.userId);
                const permitDate = permit.createdAt.toLocaleDateString();
                permittedList += `• ${user.displayName} (@${user.user.username}) - Permitted on ${permitDate}\n`;
            } catch (error) {
                permittedList += `• User ID: ${permit.userId} (User left server)\n`;
            }
        }

        permittedList += `\nPermitted users can join even when channel is locked.\nUse \`vc unpermit @user\` to remove permits.`;

        const embed = new EmbedBuilder()
            .setDescription(permittedList)
            .setColor(0x5865F2);
        await message.reply({ embeds: [embed] });

    } catch (error) {
        console.error('Error in permitted command:', error);
        const embed = new EmbedBuilder()
            .setDescription(`An error occurred while fetching permitted users.`)
            .setColor(0xED4245);
        await message.reply({ embeds: [embed] });
    }
};

async function handlePermitCommand(message, args, channel) {
    if (!args[1]) {
        const embed = new EmbedBuilder()
            .setDescription(`Please mention a user or provide their ID.`)
            .setColor(0xED4245);
        return message.reply({ embeds: [embed] });
    }

    try {
        const user = await getUserFromString(message.guild, args.slice(1).join(' '));
        if (!user) {
            const embed = new EmbedBuilder()
                .setDescription(`User not found.`)
                .setColor(0xED4245);
            return message.reply({ embeds: [embed] });
        }

        const tempChannel = await TempChannel.findOne({ channelId: channel.id });
        if (tempChannel && user.id === tempChannel.ownerId) {
            const embed = new EmbedBuilder()
                .setDescription(`The channel owner doesn't need to be permitted.`)
                .setColor(0xED4245);
            return message.reply({ embeds: [embed] });
        }

        const ban = await VoiceBan.findOne({
            channelId: channel.id,
            userId: user.id
        });

        if (ban) {
            await VoiceBan.deleteOne({
                channelId: channel.id,
                userId: user.id
            });
        }

        await VoicePermit.findOneAndUpdate(
            { channelId: channel.id, userId: user.id },
            { channelId: channel.id, userId: user.id },
            { upsert: true, new: true }
        );

        await channel.permissionOverwrites.edit(user.id, {
            Connect: true,
            ViewChannel: true,
            Speak: true
        });

        await logChannelAction(
            message.guild.id,
            message.member,
            channel,
            'PERMIT_USER',
            `Permitted **${user.displayName}** (\`${user.id}\`) to join the channel${ban ? ' (removed existing ban)' : ''}`
        );

        const embed = new EmbedBuilder()
            .setDescription(`${user} has been permitted`)
            .setColor(0x57F287);
        await message.reply({ embeds: [embed] });
    } catch (error) {
        const embed = new EmbedBuilder()
            .setDescription(`Failed to permit user.`)
            .setColor(0xED4245);
        await message.reply({ embeds: [embed] });
    }
}

async function handleUnbanCommand(message, args, channel) {
    if (!args[1]) {
        const embed = new EmbedBuilder()
            .setDescription(`Please mention a user or provide their ID.`)
            .setColor(0xED4245);
        return message.reply({ embeds: [embed] });
    }

    try {
        const user = await getUserFromString(message.guild, args.slice(1).join(' '));
        if (!user) {
            const embed = new EmbedBuilder()
                .setDescription(`User not found.`)
                .setColor(0xED4245);
            return message.reply({ embeds: [embed] });
        }

        const tempChannel = await TempChannel.findOne({ channelId: channel.id });
        if (tempChannel && user.id === tempChannel.ownerId) {
            const embed = new EmbedBuilder()
                .setDescription(`The channel owner cannot be banned or unbanned.`)
                .setColor(0xED4245);
            return message.reply({ embeds: [embed] });
        }

        const ban = await VoiceBan.findOne({
            channelId: channel.id,
            userId: user.id
        });

        if (!ban) {
            const embed = new EmbedBuilder()
                .setDescription(`${user.displayName} is not banned from this channel.`)
                .setColor(0xED4245);
            return message.reply({ embeds: [embed] });
        }

        await VoiceBan.deleteOne({
            channelId: channel.id,
            userId: user.id
        });

        const permit = await VoicePermit.findOne({
            channelId: channel.id,
            userId: user.id
        });

        if (permit) {
            await channel.permissionOverwrites.edit(user.id, {
                Connect: true,
                ViewChannel: true
            });
        } else {
            await channel.permissionOverwrites.delete(user.id);
        }

        await logChannelAction(
            message.guild.id,
            message.member,
            channel,
            'UNBAN_USER',
            `Unbanned **${user.displayName}** (\`${user.id}\`) from the channel`
        );

        const embed = new EmbedBuilder()
            .setDescription(`${user} has been unbanned from your voice channel.`)
            .setColor(0x57F287);
        await message.reply({ embeds: [embed] });
    } catch (error) {
        const embed = new EmbedBuilder()
            .setDescription(`Failed to unban user.`)
            .setColor(0xED4245);
        await message.reply({ embeds: [embed] });
    }
}

async function handleBannedCommand(message, channel) {
    try {
        const bans = await VoiceBan.find({ channelId: channel.id });

        if (bans.length === 0) {
            const embed = new EmbedBuilder()
                .setDescription(`No users are banned from your voice channel.`)
                .setColor(0x57F287);
            return message.reply({ embeds: [embed] });
        }

        let bannedList = 'Banned Users:\n\n';
        
        for (const ban of bans) {
            try {
                const user = await message.guild.members.fetch(ban.userId);
                const banDate = ban.createdAt.toLocaleDateString();
                bannedList += `• ${user.displayName} (@${user.user.username}) - Banned on ${banDate}\n`;
            } catch (error) {
                bannedList += `• User ID: ${ban.userId} (User left server)\n`;
            }
        }

        bannedList += `\nUse \`vc permit @user\` or \`vc unban @user\` to unban someone.`;

        const embed = new EmbedBuilder()
            .setDescription(bannedList)
            .setColor(0x5865F2);
        await message.reply({ embeds: [embed] });

    } catch (error) {
        console.error('Error in banned command:', error);
        const embed = new EmbedBuilder()
            .setDescription(`An error occurred while fetching banned users.`)
            .setColor(0xED4245);
        await message.reply({ embeds: [embed] });
    }
}

async function handleBanCommand(message, args, channel) {
    if (!args[1]) {
        const embed = new EmbedBuilder()
            .setDescription(`Please mention a user or provide their ID.`)
            .setColor(0xED4245);
        return message.reply({ embeds: [embed] });
    }

    try {
        const user = await getUserFromString(message.guild, args.slice(1).join(' '));
        if (!user) {
            const embed = new EmbedBuilder()
                .setDescription(`User not found.`)
                .setColor(0xED4245);
            return message.reply({ embeds: [embed] });
        }

        const tempChannel = await TempChannel.findOne({ channelId: channel.id });
        if (tempChannel && user.id === tempChannel.ownerId) {
            const embed = new EmbedBuilder()
                .setDescription(`You cannot ban the channel owner.`)
                .setColor(0xED4245);
            return message.reply({ embeds: [embed] });
        }

        await VoicePermit.deleteOne({
            channelId: channel.id,
            userId: user.id
        });

        await VoiceBan.findOneAndUpdate(
            { channelId: channel.id, userId: user.id },
            { channelId: channel.id, userId: user.id },
            { upsert: true, new: true }
        );
        
        await channel.permissionOverwrites.edit(user.id, {
            Connect: false
        });
        
        const wasInChannel = user.voice.channelId === channel.id;
        if (wasInChannel) {
            await user.voice.disconnect();
        }

        await logChannelAction(
            message.guild.id,
            message.member,
            channel,
            'BAN_USER',
            `Banned **${user.displayName}** (\`${user.id}\`) from the channel${wasInChannel ? ' and disconnected them' : ''}`
        );

        const embed = new EmbedBuilder()
            .setDescription(`${user} has been banned from this channel and cannot connect.`)
            .setColor(0x57F287);
        await message.reply({ embeds: [embed] });
    } catch (error) {
        const embed = new EmbedBuilder()
            .setDescription(`Failed to ban user.`)
            .setColor(0xED4245);
        await message.reply({ embeds: [embed] });
    }
}

async function handleKickCommand(message, args, channel) {
    if (!args[1]) {
        const embed = new EmbedBuilder()
            .setDescription(`Please mention a user or provide their ID.`)
            .setColor(0xED4245);
        return message.reply({ embeds: [embed] });
    }

    try {
        const user = await getUserFromString(message.guild, args.slice(1).join(' '));
        if (!user) {
            const embed = new EmbedBuilder()
                .setDescription(`User not found.`)
                .setColor(0xED4245);
            return message.reply({ embeds: [embed] });
        }

        const tempChannel = await TempChannel.findOne({ channelId: channel.id });
        if (tempChannel && user.id === tempChannel.ownerId) {
            const embed = new EmbedBuilder()
                .setDescription(`You cannot kick the channel owner.`)
                .setColor(0xED4245);
            return message.reply({ embeds: [embed] });
        }

        if (user.voice.channelId === channel.id) {
            await user.voice.disconnect();

            await logChannelAction(
                message.guild.id,
                message.member,
                channel,
                'KICK_USER',
                `Kicked **${user.displayName}** (\`${user.id}\`) from the channel`
            );

            const embed = new EmbedBuilder()
                .setDescription(`${user} has been kicked from the channel.`)
                .setColor(0x57F287);
            await message.reply({ embeds: [embed] });
        } else {
            const embed = new EmbedBuilder()
                .setDescription(`User is not in this channel.`)
                .setColor(0xED4245);
            await message.reply({ embeds: [embed] });
        }
    } catch (error) {
        const embed = new EmbedBuilder()
            .setDescription(`Failed to kick user.`)
            .setColor(0xED4245);
        await message.reply({ embeds: [embed] });
    }
}

async function handleLockCommand(message, channel) {
    try {
        await channel.permissionOverwrites.edit(message.guild.id, {
            Connect: false
        });

        await logChannelAction(
            message.guild.id,
            message.member,
            channel,
            'LOCK_CHANNEL',
            `Locked the channel - Only permitted users can join`
        );

        const embed = new EmbedBuilder()
            .setDescription(`Channel has been locked.`)
            .setColor(0x57F287);
        await message.reply({ embeds: [embed] });
    } catch (error) {
        const embed = new EmbedBuilder()
            .setDescription(`Failed to lock channel.`)
            .setColor(0xED4245);
        await message.reply({ embeds: [embed] });
    }
}

async function handleUnlockCommand(message, channel) {
    try {
        await channel.permissionOverwrites.edit(message.guild.id, {
            Connect: true
        });

        await logChannelAction(
            message.guild.id,
            message.member,
            channel,
            'UNLOCK_CHANNEL',
            `Unlocked the channel - Anyone can join`
        );

        const embed = new EmbedBuilder()
            .setDescription(`Channel has been unlocked.`)
            .setColor(0x57F287);
        await message.reply({ embeds: [embed] });
    } catch (error) {
        const embed = new EmbedBuilder()
            .setDescription(`Failed to unlock channel.`)
            .setColor(0xED4245);
        await message.reply({ embeds: [embed] });
    }
}

async function handleHideCommand(message, channel) {
    try {
        await channel.permissionOverwrites.edit(message.guild.id, {
            ViewChannel: false
        });

        await logChannelAction(
            message.guild.id,
            message.member,
            channel,
            'HIDE_CHANNEL',
            `Hidden the channel from the channel list`
        );

        const embed = new EmbedBuilder()
            .setDescription(`Channel has been hidden.`)
            .setColor(0x57F287);
        await message.reply({ embeds: [embed] });
    } catch (error) {
        const embed = new EmbedBuilder()
            .setDescription(`Failed to hide channel.`)
            .setColor(0xED4245);
        await message.reply({ embeds: [embed] });
    }
}

async function handleShowCommand(message, channel) {
    try {
        await channel.permissionOverwrites.edit(message.guild.id, {
            ViewChannel: true
        });

        await logChannelAction(
            message.guild.id,
            message.member,
            channel,
            'SHOW_CHANNEL',
            `Made the channel visible in the channel list`
        );

        const embed = new EmbedBuilder()
            .setDescription(`Channel is now visible.`)
            .setColor(0x57F287);
        await message.reply({ embeds: [embed] });
    } catch (error) {
        const embed = new EmbedBuilder()
            .setDescription(`Failed to show channel.`)
            .setColor(0xED4245);
        await message.reply({ embeds: [embed] });
    }
}

async function handleRenameCommand(message, args, channel) {
    if (!args[1]) {
        const embed = new EmbedBuilder()
            .setDescription(`Please provide a new name for the channel.`)
            .setColor(0xED4245);
        return message.reply({ embeds: [embed] });
    }

    const oldName = channel.name;
    const newName = args.slice(1).join(' ');
    
    try {
        await channel.setName(newName);

        await logChannelAction(
            message.guild.id,
            message.member,
            channel,
            'RENAME_CHANNEL',
            `Renamed channel from **${oldName}** to **${newName}**`
        );

        const embed = new EmbedBuilder()
            .setDescription(`Channel renamed to "${newName}".`)
            .setColor(0x57F287);
        await message.reply({ embeds: [embed] });
    } catch (error) {
        const embed = new EmbedBuilder()
            .setDescription(`Failed to rename channel.`)
            .setColor(0xED4245);
        await message.reply({ embeds: [embed] });
    }
}

async function handleClaimCommand(message, channel) {
    try {
        const tempChannel = await TempChannel.findOne({ channelId: channel.id });
        if (!tempChannel) {
            const embed = new EmbedBuilder()
                .setDescription(`This is not a temporary voice channel.`)
                .setColor(0xED4245);
            return message.reply({ embeds: [embed] });
        }

        const currentOwner = message.guild.members.cache.get(tempChannel.ownerId);
        if (currentOwner && channel.members.has(tempChannel.ownerId)) {
            const embed = new EmbedBuilder()
                .setDescription(`The current owner ${currentOwner} is still in the channel.`)
                .setColor(0xED4245);
            return message.reply({ embeds: [embed] });
        }

        const oldOwnerId = tempChannel.ownerId;

        await TempChannel.findOneAndUpdate(
            { channelId: channel.id },
            { ownerId: message.member.id }
        );

        const hasVanity = message.member.presence?.activities?.some(activity => 
            activity.type === 4 && activity.state?.includes('/')
        ) || false;

        if (currentOwner) {
            await channel.permissionOverwrites.delete(tempChannel.ownerId);
        }

        await channel.permissionOverwrites.edit(message.member.id, {
            ViewChannel: true,
            Connect: true,
            Speak: true,
            MoveMembers: true,
            ...(hasVanity ? { Stream: true, UseVAD: true } : {})
        });

        await logChannelAction(
            message.guild.id,
            message.member,
            channel,
            'CLAIM_CHANNEL',
            `Claimed ownership of the channel (previous owner: \`${oldOwnerId}\`)`
        );

        const embed = new EmbedBuilder()
            .setDescription(`${message.member} has claimed ownership of this voice channel.`)
            .setColor(0x57F287);
        await message.reply({ embeds: [embed] });

    } catch (error) {
        const embed = new EmbedBuilder()
            .setDescription(`Failed to claim channel.`)
            .setColor(0xED4245);
        await message.reply({ embeds: [embed] });
    }
}

async function handleHelpCommand(message, prefix) {
    const embed = new EmbedBuilder()
        .setDescription(`**Voice Channel Commands**

\`${prefix}vc permit @user\` - Allow user to join even when channel is locked
\`${prefix}vc unpermit @user\` - Remove permit from a user
\`${prefix}vc permitted\` - List all permitted users in your channel

\`${prefix}vc ban @user\` - Ban user from your channel and disconnect them
\`${prefix}vc unban @user\` - Unban user from your channel
\`${prefix}vc banned\` - List all banned users from your channel

\`${prefix}vc kick @user\` - Kick user from your channel (temporary)
\`${prefix}vc claim\` - Claim ownership of channel if owner left

\`${prefix}vc lock\` - Lock your channel (only permitted users can join)
\`${prefix}vc unlock\` - Unlock your channel (anyone can join)

\`${prefix}vc hide\` - Hide your channel from the channel list
\`${prefix}vc show\` - Make your channel visible in the channel list

\`${prefix}vc rename <name>\` - Rename your channel`);

    await message.reply({ embeds: [embed] });
}