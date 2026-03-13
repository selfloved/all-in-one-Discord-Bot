const { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits, MessageFlags } = require('discord.js');
const Guild = require('../../database/models/Guild');
const User = require('../../database/models/User');
const { Voicemaster, TempChannel, VoicePermit, VoiceBan } = require('../../database/models/Voicemaster');
const { createEmbed } = require('../../utils/embedBuilder');

const OWNER_ID = '716042573772226580';

module.exports = {
    name: 'reset',
    description: 'Reset database settings (Bot owner only)',
    usage: 'reset',
    aliases: ['resetdb', 'cleardb'],
    category: 'owner',
    
    async executePrefix(message, args) {
        if (message.author.id !== OWNER_ID) {
            return message.reply({
                embeds: [createEmbed('default', 'Access Denied', 'This command is restricted to the bot owner.')]
            });
        }

        const { embed, components } = createMainResetEmbed(message.guild);
        
        const response = await message.reply({ 
            embeds: [embed], 
            components: components
        });

        const collector = response.createMessageComponentCollector({ 
            time: 300000
        });

        collector.on('collect', async (interaction) => {
            if (interaction.user.id !== message.author.id) {
                return interaction.reply({ 
                    content: 'Only the command user can use this menu!', 
                    flags: MessageFlags.Ephemeral
                });
            }

            await handleResetInteraction(interaction, response);
        });

        collector.on('end', () => {
            const disabledComponents = components.map(row => {
                const newRow = ActionRowBuilder.from(row);
                newRow.components.forEach(component => component.setDisabled(true));
                return newRow;
            });
            response.edit({ components: disabledComponents }).catch(() => {});
        });
    }
};

function createMainResetEmbed(guildData) {
    const embed = createEmbed('default', 'Database Reset Control Panel', '')
        .setDescription('WARNING: These actions cannot be undone!\n\nSelect what you want to reset from the dropdown below.')
        .setThumbnail(guildData.iconURL({ dynamic: true, size: 256 }) || null)
        .addFields(
            {
                name: 'Available Reset Options',
                value: [
                    'Guild Settings - Reset current server config',
                    'User Data - Reset specific user\'s data',
                    'Voicemaster - Reset voicemaster system',
                    'Deleted',
                    'All Guilds - Reset all server configurations',
                    'All Users - Reset all user data',
                    'Complete Wipe - Reset entire database'
                ].join('\n'),
                inline: false
            }
        );

    const resetMenu = new StringSelectMenuBuilder()
        .setCustomId('reset_main_menu')
        .setPlaceholder('Select what to reset')
        .addOptions([
            {
                label: 'Current Guild Settings',
                value: 'reset_guild',
                description: 'Reset this server\'s configuration only'
            },
            {
                label: 'User Data',
                value: 'reset_user',
                description: 'Reset specific user\'s data'
            },
            {
                label: 'Voicemaster System',
                value: 'reset_voicemaster',
                description: 'Reset voicemaster for this server'
            },
            {
                label: 'Anti-Nuke System',
                value: 'reset_antinuke',
                description: 'Reset anti-nuke for this server'
            },
            {
                label: 'All Guild Configurations',
                value: 'reset_all_guilds',
                description: 'Reset ALL server configurations'
            },
            {
                label: 'All User Data',
                value: 'reset_all_users',
                description: 'Reset ALL user data across servers'
            },
            {
                label: 'Complete Database Wipe',
                value: 'reset_everything',
                description: 'Delete EVERYTHING from database'
            }
        ]);

    const infoMenu = new StringSelectMenuBuilder()
        .setCustomId('reset_info_menu')
        .setPlaceholder('Get information about reset options')
        .addOptions([
            {
                label: 'What gets reset?',
                value: 'info_what_resets',
                description: 'See what data each option affects'
            },
            {
                label: 'Safety Information',
                value: 'info_safety',
                description: 'Important safety information'
            }
        ]);

    const row1 = new ActionRowBuilder().addComponents(resetMenu);
    const row2 = new ActionRowBuilder().addComponents(infoMenu);
    
    return { embed, components: [row1, row2] };
}

function createConfirmationEmbed(resetType, guildData, targetInfo = null) {
    let title = '';
    let description = '';

    switch (resetType) {
        case 'reset_guild':
            title = 'Confirm Guild Reset';
            description = `Server: ${guildData.name}\nID: ${guildData.id}\n\nThis will reset:\n• Prefix to default (!)\n• Welcome/greeting settings\n• All channel configurations\n• All feature toggles\n\nAnti-nuke and voicemaster will NOT be affected`;
            break;
        case 'reset_user':
            title = 'Confirm User Reset';
            description = `Target: <@${targetInfo}>\n\nThis will reset:\n• Level to 1\n• XP to 0\n• Coins to 100\n• Daily claim data\n• All user progress`;
            break;
        case 'reset_voicemaster':
            title = 'Confirm Voicemaster Reset';
            description = `Server: ${guildData.name}\n\nThis will delete:\n• All temp voice channels\n• Voice permits and bans\n• Voicemaster configuration\n• Interface and log channels\n\nChannels will be deleted immediately`;
            break;
        case 'reset_antinuke':
            title = 'Confirm Anti-Nuke Reset';
            description = `Server: ${guildData.name}\n\nThis will reset:\n• All protection settings\n• Whitelist and admin lists\n• Punishment configurations\n• Log channel settings\n• System will be disabled`;
            break;
        case 'reset_all_guilds':
            title = 'Confirm All Guilds Reset';
            description = `This will reset ALL servers:\n• All guild configurations\n• All welcome settings\n• All prefixes to default\n• All channel settings\n\nAffects multiple servers`;
            break;
        case 'reset_all_users':
            title = 'Confirm All Users Reset';
            description = `This will reset ALL users:\n• All levels to 1\n• All XP to 0\n• All coins to 100\n• All daily claims\n\nAffects ALL users across ALL servers`;
            break;
        case 'reset_everything':
            title = 'COMPLETE DATABASE WIPE';
            description = `DANGER: This will DELETE EVERYTHING\n\n• ALL guild configurations\n• ALL user data\n• ALL voicemaster systems\n• ALL anti-nuke systems\n• ALL settings for ALL servers\n\nTHIS CANNOT BE UNDONE!`;
            break;
    }

    const embed = createEmbed('default', title, description);

    const confirmRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`execute_reset_${resetType}${targetInfo ? `_${targetInfo}` : ''}`)
                .setLabel('CONFIRM RESET')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('cancel_reset')
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Secondary)
        );

    return { embed, components: [confirmRow] };
}

async function handleResetInteraction(interaction, originalResponse) {
    try {
        if (interaction.isStringSelectMenu()) {
            if (interaction.customId === 'reset_main_menu') {
                await handleResetMenu(interaction);
            } else if (interaction.customId === 'reset_info_menu') {
                await handleInfoMenu(interaction);
            }
        } else if (interaction.isButton()) {
            await handleResetButton(interaction, originalResponse);
        } else if (interaction.isModalSubmit()) {
            await handleResetModal(interaction);
        }
    } catch (error) {
        console.error('Error handling reset interaction:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ 
                content: 'An error occurred.', 
                flags: MessageFlags.Ephemeral
            });
        }
    }
}

async function handleResetMenu(interaction) {
    const value = interaction.values[0];

    if (value === 'reset_user') {
        const modal = new ModalBuilder()
            .setCustomId('user_reset_modal')
            .setTitle('Enter User ID to Reset');

        const userInput = new TextInputBuilder()
            .setCustomId('user_id')
            .setLabel('User ID')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('716042573772226580')
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(userInput));
        await interaction.showModal(modal);
        return;
    }

    const { embed, components } = createConfirmationEmbed(value, interaction.guild);
    await interaction.update({ embeds: [embed], components });
}

async function handleInfoMenu(interaction) {
    let infoEmbed;

    switch (interaction.values[0]) {
        case 'info_what_resets':
            infoEmbed = createEmbed('default', 'What Gets Reset?', '')
                .addFields(
                    {
                        name: 'Guild Settings',
                        value: 'Prefix, greeting settings, channel configs, feature toggles',
                        inline: true
                    },
                    {
                        name: 'User Data',
                        value: 'Level, XP, coins, daily claims, user progress',
                        inline: true
                    },
                    {
                        name: 'Voicemaster',
                        value: 'Temp channels, permits, bans, interface, logs',
                        inline: true
                    },
                    {
                        name: 'Anti-Nuke',
                        value: 'All protections, whitelist, admins, punishments, logs',
                        inline: true
                    },
                    {
                        name: 'All Guilds',
                        value: 'Every server\'s guild settings (not voicemaster/antinuke)',
                        inline: true
                    },
                    {
                        name: 'All Users',
                        value: 'Every user\'s data across all servers',
                        inline: true
                    },
                    {
                        name: 'Complete Wipe',
                        value: 'Everything - guilds, users, voicemaster, antinuke, all data',
                        inline: true
                    }
                );
            break;
        case 'info_safety':
            infoEmbed = createEmbed('default', 'Safety Information', '')
                .addFields(
                    {
                        name: 'Important Warnings',
                        value: [
                            '• No undo - All resets are permanent',
                            '• Immediate effect - Changes happen instantly',
                            '• Channel deletion - Voicemaster resets delete Discord channels',
                            '• User impact - User resets affect their progress permanently'
                        ].join('\n'),
                        inline: false
                    },
                    {
                        name: 'Safety Tips',
                        value: [
                            '• Test resets on development servers first',
                            '• Backup important data externally',
                            '• Inform users before mass resets',
                            '• Double-check the target before confirming'
                        ].join('\n'),
                        inline: false
                    }
                );
            break;
    }

    const backButton = new ButtonBuilder()
        .setCustomId('back_to_reset_main')
        .setLabel('Back')
        .setStyle(ButtonStyle.Secondary);

    const backRow = new ActionRowBuilder().addComponents(backButton);
    await interaction.update({ embeds: [infoEmbed], components: [backRow] });
}

async function handleResetButton(interaction, originalResponse) {
    if (interaction.customId === 'cancel_reset' || interaction.customId === 'back_to_reset_main') {
        const { embed, components } = createMainResetEmbed(interaction.guild);
        await interaction.update({ embeds: [embed], components });
        return;
    }

    if (interaction.customId.startsWith('execute_reset_')) {
        await executeReset(interaction);
    }
}

async function handleResetModal(interaction) {
    if (interaction.customId === 'user_reset_modal') {
        const userId = interaction.fields.getTextInputValue('user_id');
        const { embed, components } = createConfirmationEmbed('reset_user', interaction.guild, userId);
        await interaction.update({ embeds: [embed], components });
    }
}

async function executeReset(interaction) {
    const resetType = interaction.customId.replace('execute_reset_', '');
    const parts = resetType.split('_');
    const type = parts.slice(0, 2).join('_');
    const targetId = parts.slice(2).join('_');

    await interaction.reply({ content: 'Executing reset...', flags: MessageFlags.Ephemeral });

    try {
        let result = '';

        switch (type) {
            case 'reset_guild':
                await Guild.findOneAndUpdate(
                    { guildId: interaction.guild.id },
                    { 
                        prefix: '!',
                        welcomeChannel: null,
                        logChannel: null,
                        autoRole: null,
                        'settings.welcomeEnabled': false,
                        'settings.loggingEnabled': false,
                        'settings.autoRoleEnabled': false,
                        'greeting.enabled': false,
                        'greeting.channelId': null,
                        'greeting.totalGreetings': 0
                    },
                    { upsert: true }
                );
                result = `Reset guild settings for ${interaction.guild.name}`;
                break;

            case 'reset_user':
                await User.findOneAndUpdate(
                    { userId: targetId },
                    { level: 1, xp: 0, coins: 100, lastDaily: null },
                    { upsert: true }
                );
                result = `Reset user data for <@${targetId}>`;
                break;

            case 'reset_antinuke':
                await AntiNuke.findOneAndDelete({ guildId: interaction.guild.id });
                result = `Reset anti-nuke system for ${interaction.guild.name}`;
                break;

            case 'reset_voicemaster':
                const voicemaster = await Voicemaster.findOne({ guildId: interaction.guild.id });
                if (voicemaster) {
                    // Delete channels
                    const channels = [
                        voicemaster.categoryId,
                        voicemaster.voiceCategoryId,
                        voicemaster.channelId,
                        voicemaster.interfaceChannelId,
                        voicemaster.logChannelId
                    ].filter(Boolean);

                    for (const channelId of channels) {
                        try {
                            const channel = interaction.guild.channels.cache.get(channelId);
                            if (channel) await channel.delete();
                        } catch (error) {
                            console.error(`Failed to delete channel ${channelId}:`, error);
                        }
                    }

                    // Delete temp channels
                    const tempChannels = await TempChannel.find({ guildId: interaction.guild.id });
                    for (const temp of tempChannels) {
                        try {
                            const channel = interaction.guild.channels.cache.get(temp.channelId);
                            if (channel) await channel.delete();
                        } catch (error) {
                            console.error(`Failed to delete temp channel ${temp.channelId}:`, error);
                        }
                    }

                    // Clear database
                    await Voicemaster.deleteOne({ guildId: interaction.guild.id });
                    await TempChannel.deleteMany({ guildId: interaction.guild.id });
                    await VoicePermit.deleteMany({});
                    await VoiceBan.deleteMany({});

                    result = `Completely removed voicemaster system for ${interaction.guild.name}`;
                } else {
                    result = `No voicemaster system found for ${interaction.guild.name}`;
                }
                break;

            case 'reset_all':
                if (resetType === 'reset_all_guilds') {
                    await Guild.updateMany({}, {
                        prefix: '!',
                        welcomeChannel: null,
                        logChannel: null,
                        autoRole: null,
                        'settings.welcomeEnabled': false,
                        'settings.loggingEnabled': false,
                        'settings.autoRoleEnabled': false,
                        'greeting.enabled': false,
                        'greeting.channelId': null,
                        'greeting.totalGreetings': 0
                    });
                    result = 'Reset ALL guild configurations';
                } else if (resetType === 'reset_all_users') {
                    await User.updateMany({}, {
                        level: 1,
                        xp: 0,
                        coins: 100,
                        lastDaily: null
                    });
                    result = 'Reset ALL user data';
                }
                break;

            case 'reset_everything':
                await Guild.deleteMany({});
                await User.deleteMany({});
                await AntiNuke.deleteMany({});
                await Voicemaster.deleteMany({});
                await TempChannel.deleteMany({});
                await VoicePermit.deleteMany({});
                await VoiceBan.deleteMany({});
                result = 'COMPLETE DATABASE WIPE EXECUTED - All data has been permanently deleted.';
                break;

            default:
                result = 'Unknown reset type';
        }

        await interaction.editReply({ content: result, flags: MessageFlags.Ephemeral });

    } catch (error) {
        console.error('Error executing reset:', error);
        await interaction.editReply({ 
            content: 'Failed to execute reset. Check console for errors.',
            flags: MessageFlags.Ephemeral 
        });
    }
}