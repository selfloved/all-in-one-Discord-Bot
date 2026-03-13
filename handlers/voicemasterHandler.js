const { EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, PermissionFlagsBits, StringSelectMenuBuilder } = require('discord.js');
const { isChannelOwner, hasVanityInBio } = require('../utils/voicemasterUtils');
const { VoiceBan, TempChannel, VoicePermit } = require('../database/models/Voicemaster');
const { logChannelAction } = require('../events/voiceStateUpdate');

module.exports = {
    async handleVoicemasterButton(interaction) {
        const { customId, member, guild } = interaction;
        
        if (!member.voice.channelId) {
            return interaction.reply({ content: '<:Warning:1393752109119176755> Du musst in einem Voice-Kanal sein, um das zu verwenden.', ephemeral: true });
        }

        const isOwner = await isChannelOwner(member.voice.channelId, member.id);
        if (!isOwner) {
            return interaction.reply({ content: '<:Deny:1393752012054728784> Nur der Kanal-Besitzer kann das verwenden.', ephemeral: true });
        }

        const channel = member.voice.channel;

        switch (customId) {
            case 'vc_rename':
                await handleRename(interaction);
                break;
            case 'vc_lock':
                await handleLock(interaction, channel);
                break;
            case 'vc_unlock':
                await handleUnlock(interaction, channel);
                break;
            case 'vc_invisible':
                await handleInvisible(interaction, channel);
                break;
            case 'vc_visible':
                await handleVisible(interaction, channel);
                break;
            case 'vc_userlimit':
                await handleUserLimit(interaction);
                break;
            case 'vc_ban':
                await handleBan(interaction, channel);
                break;
            case 'vc_kick':
                await handleKick(interaction, channel);
                break;
            case 'vc_edit':
                await handleEdit(interaction);
                break;
        }
    },

    async handleVoicemasterModal(interaction) {
        const { customId, member, guild } = interaction;
        const channel = member.voice.channel;

        if (!channel) {
            return interaction.reply({ content: '<:Warning:1393752109119176755> Du musst in einem Voice-Kanal sein.', ephemeral: true });
        }

        const isOwner = await isChannelOwner(channel.id, member.id);
        if (!isOwner) {
            return interaction.reply({ content: '<:Deny:1393752012054728784> Nur der Kanal-Besitzer kann das verwenden.', ephemeral: true });
        }

        switch (customId) {
            case 'rename_modal':
                await handleRenameModal(interaction, channel);
                break;
            case 'userlimit_modal':
                await handleUserLimitModal(interaction, channel);
                break;
        }
    },

    async handleVoicemasterSelect(interaction) {
        const { customId, member, guild, values } = interaction;
        const channel = member.voice.channel;

        if (!channel) {
            return interaction.reply({ content: '<:Warning:1393752109119176755> Du musst in einem Voice-Kanal sein.', ephemeral: true });
        }

        const isOwner = await isChannelOwner(channel.id, member.id);
        if (!isOwner) {
            return interaction.reply({ content: '<:Deny:1393752012054728784> Nur der Kanal-Besitzer kann das verwenden.', ephemeral: true });
        }

        switch (customId) {
            case 'kick_user_select':
                await handleKickUserSelect(interaction, channel, values[0]);
                break;
            case 'ban_user_select':
                await handleBanUserSelect(interaction, channel, values[0]);
                break;
        }
    }
};

async function handleRename(interaction) {
    const modal = new ModalBuilder()
        .setCustomId('rename_modal')
        .setTitle('Kanal Umbenennen');

    const nameInput = new TextInputBuilder()
        .setCustomId('channel_name')
        .setLabel('Neuer Kanal Name')
        .setStyle(TextInputStyle.Short)
        .setMaxLength(100)
        .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(nameInput));
    await interaction.showModal(modal);
}

async function handleRenameModal(interaction, channel) {
    const newName = interaction.fields.getTextInputValue('channel_name');
    const oldName = channel.name;

    try {
        await channel.setName(newName);

        await logChannelAction(
            interaction.guild.id,
            interaction.member,
            channel,
            'RENAME_CHANNEL',
            `Kanal von **${oldName}** zu **${newName}** umbenannt (über Interface)`
        );

        await interaction.reply({ content: `<:Check:1393751996267368478> Kanal zu "${newName}" umbenannt`, ephemeral: true });
    } catch (error) {
        await interaction.reply({ content: '<:Warning:1393752109119176755> Kanal konnte nicht umbenannt werden', ephemeral: true });
    }
}

async function handleLock(interaction, channel) {
    try {
        await channel.permissionOverwrites.edit(interaction.guild.id, {
            Connect: false
        });

        await logChannelAction(
            interaction.guild.id,
            interaction.member,
            channel,
            'LOCK_CHANNEL',
            `Kanal gesperrt - Nur berechtigte Benutzer können beitreten (über Interface)`
        );

        await interaction.reply({ content: '<:Lock:1393752055700787221> Kanal gesperrt', ephemeral: true });
    } catch (error) {
        await interaction.reply({ content: '<:Warning:1393752109119176755> Kanal konnte nicht gesperrt werden', ephemeral: true });
    }
}

async function handleUnlock(interaction, channel) {
    try {
        await channel.permissionOverwrites.edit(interaction.guild.id, {
            Connect: true
        });

        await logChannelAction(
            interaction.guild.id,
            interaction.member,
            channel,
            'UNLOCK_CHANNEL',
            `Kanal entsperrt - Jeder kann beitreten (über Interface)`
        );

        await interaction.reply({ content: '<:Unlock:1393752095911579699> Kanal entsperrt', ephemeral: true });
    } catch (error) {
        await interaction.reply({ content: '<:Warning:1393752109119176755> Kanal konnte nicht entsperrt werden', ephemeral: true });
    }
}

async function handleInvisible(interaction, channel) {
    try {
        await channel.permissionOverwrites.edit(interaction.guild.id, {
            ViewChannel: false
        });

        await logChannelAction(
            interaction.guild.id,
            interaction.member,
            channel,
            'HIDE_CHANNEL',
            `Kanal aus der Kanalliste versteckt (über Interface)`
        );

        await interaction.reply({ content: '<:EyeClosed:1393752018346049639> Kanal versteckt', ephemeral: true });
    } catch (error) {
        await interaction.reply({ content: '<:Warning:1393752109119176755> Kanal konnte nicht versteckt werden', ephemeral: true });
    }
}

async function handleVisible(interaction, channel) {
    try {
        await channel.permissionOverwrites.edit(interaction.guild.id, {
            ViewChannel: true
        });

        await logChannelAction(
            interaction.guild.id,
            interaction.member,
            channel,
            'SHOW_CHANNEL',
            `Kanal in der Kanalliste sichtbar gemacht (über Interface)`
        );

        await interaction.reply({ content: '<:EyeOpen:1393752027107954748> Kanal sichtbar', ephemeral: true });
    } catch (error) {
        await interaction.reply({ content: '<:Warning:1393752109119176755> Kanal konnte nicht sichtbar gemacht werden', ephemeral: true });
    }
}

async function handleUserLimit(interaction) {
    const modal = new ModalBuilder()
        .setCustomId('userlimit_modal')
        .setTitle('Benutzer Limit Setzen');

    const limitInput = new TextInputBuilder()
        .setCustomId('user_limit')
        .setLabel('Benutzer Limit (1-99, 0 für unbegrenzt)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Gib eine Zahl zwischen 1-99 ein oder 0 für unbegrenzt')
        .setMinLength(1)
        .setMaxLength(2)
        .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(limitInput));
    await interaction.showModal(modal);
}

async function handleUserLimitModal(interaction, channel) {
    const limitInput = interaction.fields.getTextInputValue('user_limit');
    const limit = parseInt(limitInput);

    if (isNaN(limit) || limit < 0 || limit > 99) {
        return interaction.reply({ content: '<:Warning:1393752109119176755> Ungültiges Benutzer Limit. Bitte gib eine Zahl zwischen 0-99 ein.', ephemeral: true });
    }

    try {
        const oldLimit = channel.userLimit;
        await channel.setUserLimit(limit);

        await logChannelAction(
            interaction.guild.id,
            interaction.member,
            channel,
            'SET_USER_LIMIT',
            `Benutzer Limit von **${oldLimit === 0 ? 'unbegrenzt' : oldLimit}** zu **${limit === 0 ? 'unbegrenzt' : limit}** geändert (über Interface)`
        );

        await interaction.reply({ 
            content: `<:User:1393752101687136269> Benutzer Limit auf ${limit === 0 ? 'unbegrenzt' : limit} gesetzt`, 
            ephemeral: true 
        });
    } catch (error) {
        await interaction.reply({ content: '<:Warning:1393752109119176755> Benutzer Limit konnte nicht gesetzt werden', ephemeral: true });
    }
}

async function handleKick(interaction, channel) {
    try {
        const tempChannel = await TempChannel.findOne({ channelId: channel.id });
        
        const membersInChannel = Array.from(channel.members.values())
            .filter(member => 
                member.id !== interaction.member.id &&
                (!tempChannel || member.id !== tempChannel.ownerId)
            );

        if (membersInChannel.length === 0) {
            return interaction.reply({ content: '<:Warning:1393752109119176755> Keine anderen Benutzer im Kanal zum Kicken.', ephemeral: true });
        }

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('kick_user_select')
            .setPlaceholder('Wähle einen Benutzer zum Kicken')
            .addOptions(
                membersInChannel.map(member => ({
                    label: member.displayName,
                    description: `@${member.user.username}`,
                    value: member.id
                }))
            );

        const row = new ActionRowBuilder().addComponents(selectMenu);

        await interaction.reply({
            content: '<:Minus:1393752071450136697> Wähle einen Benutzer zum Kicken aus dem Voice-Kanal:',
            components: [row],
            ephemeral: true
        });

    } catch (error) {
        console.error('Error creating kick dropdown:', error);
        await interaction.reply({ content: '<:Warning:1393752109119176755> Kick-Menü konnte nicht erstellt werden', ephemeral: true });
    }
}

async function handleKickUserSelect(interaction, channel, userId) {
    try {
        const user = await interaction.guild.members.fetch(userId);
        
        if (user.voice.channelId === channel.id) {
            await user.voice.disconnect();

            await logChannelAction(
                interaction.guild.id,
                interaction.member,
                channel,
                'KICK_USER',
                `**${user.displayName}** (\`${user.id}\`) aus dem Kanal gekickt (über Interface)`
            );

            await interaction.update({ 
                content: `<:Check:1393751996267368478> ${user.displayName} wurde aus dem Kanal gekickt.`, 
                components: [] 
            });
        } else {
            await interaction.update({ 
                content: '<:Warning:1393752109119176755> Benutzer ist nicht mehr in diesem Kanal.', 
                components: [] 
            });
        }
    } catch (error) {
        await interaction.update({ 
            content: '<:Warning:1393752109119176755> Benutzer konnte nicht gekickt werden.', 
            components: [] 
        });
    }
}

async function handleBan(interaction, channel) {
    try {
        const tempChannel = await TempChannel.findOne({ channelId: channel.id });
        
        const membersInChannel = Array.from(channel.members.values())
            .filter(member => 
                member.id !== interaction.member.id &&
                (!tempChannel || member.id !== tempChannel.ownerId)
            );

        if (membersInChannel.length === 0) {
            return interaction.reply({ content: '<:Warning:1393752109119176755> Keine anderen Benutzer im Kanal zum Bannen.', ephemeral: true });
        }

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('ban_user_select')
            .setPlaceholder('Wähle einen Benutzer zum Bannen')
            .addOptions(
                membersInChannel.map(member => ({
                    label: member.displayName,
                    description: `@${member.user.username}`,
                    value: member.id
                }))
            );

        const row = new ActionRowBuilder().addComponents(selectMenu);

        await interaction.reply({
            content: '<:Deny:1393752012054728784> Wähle einen Benutzer zum Bannen aus dem Voice-Kanal:',
            components: [row],
            ephemeral: true
        });

    } catch (error) {
        console.error('Error creating ban dropdown:', error);
        await interaction.reply({ content: '<:Warning:1393752109119176755> Ban-Menü konnte nicht erstellt werden', ephemeral: true });
    }
}

async function handleBanUserSelect(interaction, channel, userId) {
    try {
        const user = await interaction.guild.members.fetch(userId);
        
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
            interaction.guild.id,
            interaction.member,
            channel,
            'BAN_USER',
            `**${user.displayName}** (\`${user.id}\`) vom Kanal gebannt${wasInChannel ? ' und getrennt' : ''} (über Interface)`
        );

        await interaction.update({ 
            content: `<:Check:1393751996267368478> ${user.displayName} wurde von diesem Kanal gebannt und kann nicht mehr beitreten.`, 
            components: [] 
        });
    } catch (error) {
        await interaction.update({ 
            content: '<:Warning:1393752109119176755> Benutzer konnte nicht gebannt werden.', 
            components: [] 
        });
    }
}

async function handleEdit(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '<:Deny:1393752012054728784> Nur Administratoren können Voicemaster Einstellungen bearbeiten.', ephemeral: true });
    }

    const modal = new ModalBuilder()
        .setCustomId('edit_voicemaster_modal')
        .setTitle('Voicemaster Einstellungen Bearbeiten');

    const categoryInput = new TextInputBuilder()
        .setCustomId('category_name')
        .setLabel('Kategorie Name')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Voice Master')
        .setRequired(false);

    const joinChannelInput = new TextInputBuilder()
        .setCustomId('join_channel_name')
        .setLabel('Beitritts-Kanal Name')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Beitreten zum Erstellen')
        .setRequired(false);

    modal.addComponents(
        new ActionRowBuilder().addComponents(categoryInput),
        new ActionRowBuilder().addComponents(joinChannelInput)
    );
    await interaction.showModal(modal);
}