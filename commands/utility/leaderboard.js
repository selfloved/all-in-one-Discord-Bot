const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ChannelSelectMenuBuilder, ChannelType, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits } = require('discord.js');
const Guild = require('../../database/models/Guild');
const MonthlyStats = require('../../database/models/MonthlyStats');
const LeaderboardHistory = require('../../database/models/LeaderboardHistory.js');
const monthlyTracker = require('../../utils/monthlyTracker');

const emojis = {
    check: '<:Check:1393751996267368478>',
    deny: '<:Deny:1393752012054728784>',
    settings: '<:Settings:1393752089884102677>',
    warning: '<:Warning:1393752109119176755>',
    user: '<:User:1393752101687136269>',
    mic: '<:Mic:1393752063707578460>',
    eyeOpen: '<:EyeOpen:1393752027107954748>',
    claim: '<:Claim:1393752141423706143>'
};

const trophyEmojis = {
    1: '🥇',
    2: '🥈', 
    3: '🥉',
    4: '4️⃣',
    5: '5️⃣',
    6: '6️⃣',
    7: '7️⃣',
    8: '8️⃣',
    9: '9️⃣',
    10: '🔟'
};

const activeRewardSetups = new Map();

module.exports = {
    name: 'leaderboard',
    description: 'Zeige und konfiguriere die monatliche Rangliste',
    usage: '!leaderboard [setup]',
    aliases: ['lb', 'ranking', 'rangliste'],
    category: 'utility',
    
    async executePrefix(message, args) {
        if (args[0] === 'setup') {
            if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return message.reply({
                    embeds: [createEmbed('error', `${emojis.deny} Keine Berechtigung`, 'Du benötigst die Berechtigung "Server Verwalten" um die Rangliste zu konfigurieren.')]
                });
            }
            
            await handleSetup(message);
        } else if (args[0] === 'reward-help') {
            await showRewardHelp(message);
        } else {
            await showLeaderboard(message);
        }
    }
};

async function showRewardHelp(message) {
    const embed = new EmbedBuilder()
        .setTitle(`${emojis.settings} Belohnungssystem Hilfe`)
        .setColor('#2f3136')
        .setDescription('So funktioniert das Belohnungssystem:')
        .addFields(
            {
                name: '🎯 Rollen Setzen',
                value: '• Aktiviere Belohnungen im Setup\n• Klicke "Rollen Konfigurieren"\n• Folge den Anweisungen im Chat\n• Sende Rollen-IDs oder erwähne Rollen',
                inline: false
            },
            {
                name: '🏆 Platz-System',
                value: '• **1** - Erste Position\n• **2** - Zweite Position\n• **3** - Dritte Position\n• **all** - Gleiche Rolle für alle Top 3',
                inline: false
            },
            {
                name: '📝 Rollen-ID Finden',
                value: '• Aktiviere Entwicklermodus\n• Rechtsklick auf Rolle → ID kopieren\n• Oder erwähne die Rolle mit @Rollenname',
                inline: false
            },
            {
                name: '⚙️ Beispiele',
                value: '`123456789012345678` - Rollen-ID\n`@VIP` - Rollen-Erwähnung\n`cancel` - Vorgang abbrechen',
                inline: false
            }
        )
        .setTimestamp();
    
    await message.reply({ embeds: [embed] });
}

async function handleSetup(message) {
    let guild = await Guild.findOne({ guildId: message.guild.id });
    if (!guild) {
        guild = new Guild({
            guildId: message.guild.id,
            guildName: message.guild.name
        });
        await guild.save();
    }
    
    if (!guild.leaderboard) {
        guild.leaderboard = {
            enabled: false,
            channelId: null,
            messageId: null,
            messageRewards: {
                enabled: false,
                roles: {
                    first: [],
                    second: [],
                    third: [],
                    allTop3: []
                }
            },
            vcRewards: {
                enabled: false,
                roles: {
                    first: [],
                    second: [],
                    third: [],
                    allTop3: []
                }
            },
            autoRefresh: true,
            refreshInterval: 3,
            embedColor: '#2f3136',
            showTop: 10,
            lastRefresh: new Date(),
            currentMonth: getCurrentMonth()
        };
        guild.markModified('leaderboard');
        await guild.save();
    }
    
    if (!guild.leaderboard.messageRewards.roles) {
        guild.leaderboard.messageRewards.roles = {
            first: [],
            second: [],
            third: [],
            allTop3: []
        };
        guild.markModified('leaderboard');
        await guild.save();
    }
    
    if (!guild.leaderboard.vcRewards.roles) {
        guild.leaderboard.vcRewards.roles = {
            first: [],
            second: [],
            third: [],
            allTop3: []
        };
        guild.markModified('leaderboard');
        await guild.save();
    }
    
    const { embed, components } = createSetupEmbed(guild.leaderboard, message.guild);
    
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
                content: `${emojis.deny} Nur der Befehlsbenutzer kann dieses Menü verwenden!`,
                flags: 64
            });
        }
        
        await handleSetupInteraction(interaction, guild, response, message);
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

function createSetupEmbed(leaderboardConfig, guildData) {
    const embed = new EmbedBuilder()
        .setTitle(`${emojis.settings} Rangliste Konfiguration`)
        .setColor(leaderboardConfig.embedColor || '#2f3136')
        .setThumbnail(guildData.iconURL({ dynamic: true, size: 256 }))
        .setTimestamp();
    
    const statusValue = leaderboardConfig.enabled ? 
        `${emojis.check} **Aktiviert**` : 
        `${emojis.deny} **Deaktiviert**`;
    
    const channelValue = leaderboardConfig.channelId ? 
        `<#${leaderboardConfig.channelId}>` : 
        '`Nicht gesetzt`';
    
    const messageRewardsStatus = leaderboardConfig.messageRewards.enabled ? 
        `${emojis.check} Aktiviert` : 
        `${emojis.deny} Deaktiviert`;
    
    const vcRewardsStatus = leaderboardConfig.vcRewards.enabled ? 
        `${emojis.check} Aktiviert` : 
        `${emojis.deny} Deaktiviert`;
    
    embed.addFields(
        {
            name: 'System Status',
            value: statusValue,
            inline: true
        },
        {
            name: 'Kanal',
            value: channelValue,
            inline: true
        },
        {
            name: 'Auto-Aktualisierung',
            value: leaderboardConfig.autoRefresh ? 
                `${emojis.check} Alle ${leaderboardConfig.refreshInterval} Min` : 
                `${emojis.deny} Deaktiviert`,
            inline: true
        },
        {
            name: 'Nachrichten Belohnungen',
            value: messageRewardsStatus,
            inline: true
        },
        {
            name: `${emojis.mic} Voice Belohnungen`,
            value: vcRewardsStatus,
            inline: true
        },
        {
            name: 'Aktueller Monat',
            value: `\`${leaderboardConfig.currentMonth}\``,
            inline: true
        }
    );
    
    const setupMenu = new StringSelectMenuBuilder()
        .setCustomId('lb_setup_menu')
        .setPlaceholder('Wähle eine Einstellung zum Konfigurieren')
        .addOptions([
            {
                label: 'System Umschalten',
                description: 'Rangliste aktivieren/deaktivieren',
                value: 'toggle_system',
                emoji: leaderboardConfig.enabled ? emojis.deny : emojis.check
            },
            {
                label: 'Kanal Setzen',
                description: 'Kanal für die Rangliste auswählen',
                value: 'set_channel'
            },
            {
                label: 'Nachrichten Belohnungen',
                description: 'Rollen für Top Nachrichten Schreiber',
                value: 'message_rewards'
            },
            {
                label: 'Voice Belohnungen',
                description: 'Rollen für Top Voice Benutzer',
                value: 'voice_rewards'
            },
            {
                label: 'Aktualisierung Einstellen',
                description: 'Auto-Aktualisierung und Intervall',
                value: 'refresh_settings'
            },
            {
                label: 'Rangliste Erstellen',
                description: 'Neue Rangliste im Kanal erstellen',
                value: 'create_leaderboard'
            }
        ]);
    
    const row1 = new ActionRowBuilder().addComponents(setupMenu);
    
    return { embed, components: [row1] };
}

async function handleSetupInteraction(interaction, guild, originalResponse, originalMessage) {
    if (interaction.isStringSelectMenu() && interaction.customId === 'lb_setup_menu') {
        const value = interaction.values[0];
        
        try {
            switch (value) {
                case 'toggle_system':
                    await toggleSystem(interaction, guild);
                    break;
                case 'set_channel':
                    await setChannel(interaction, guild);
                    break;
                case 'message_rewards':
                    await showRewardOptions(interaction, guild, 'message', originalMessage);
                    break;
                case 'voice_rewards':
                    await showRewardOptions(interaction, guild, 'voice', originalMessage);
                    break;
                case 'refresh_settings':
                    await configureRefreshSettings(interaction, guild);
                    break;
                case 'create_leaderboard':
                    await createLeaderboard(interaction, guild);
                    break;
            }
        } catch (error) {
            console.error('Setup interaction error:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: `${emojis.warning} Ein Fehler ist aufgetreten. Versuche es erneut.`,
                    flags: 64
                });
            }
        }
        
        setTimeout(async () => {
            try {
                const freshGuild = await Guild.findOne({ guildId: guild.guildId });
                const { embed, components } = createSetupEmbed(freshGuild.leaderboard, interaction.guild);
                await originalResponse.edit({ embeds: [embed], components });
            } catch (error) {
                console.error('Error updating setup embed:', error);
            }
        }, 1000);
    }
}

async function showRewardOptions(interaction, guild, type, originalMessage) {
    const rewardType = type === 'message' ? 'messageRewards' : 'vcRewards';
    const config = guild.leaderboard[rewardType];
    
    const embed = new EmbedBuilder()
        .setTitle(`${type === 'message' ? emojis.user : emojis.mic} ${type === 'message' ? 'Nachrichten' : 'Voice'} Belohnungen`)
        .setColor('#2f3136')
        .setDescription(`**Status:** ${config.enabled ? `${emojis.check} Aktiviert` : `${emojis.deny} Deaktiviert`}\n\nWähle eine Option:`)
        .addFields({
            name: 'Verfügbare Aktionen:',
            value: '• **Aktivieren/Deaktivieren** - System ein/ausschalten\n• **Rollen Konfigurieren** - Chat-basierte Rollenkonfiguration\n• **Alle Löschen** - Alle Rollen entfernen',
            inline: false
        })
        .setTimestamp();

    const toggleButton = new ButtonBuilder()
        .setCustomId(`simple_toggle_${type}`)
        .setLabel(config.enabled ? 'Deaktivieren' : 'Aktivieren')
        .setStyle(config.enabled ? ButtonStyle.Danger : ButtonStyle.Success);

    const configButton = new ButtonBuilder()
        .setCustomId(`simple_config_${type}`)
        .setLabel('Rollen Konfigurieren')
        .setStyle(ButtonStyle.Primary);

    const clearButton = new ButtonBuilder()
        .setCustomId(`simple_clear_${type}`)
        .setLabel('Alle Löschen')
        .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder().addComponents(toggleButton, configButton, clearButton);

    await interaction.reply({
        embeds: [embed],
        components: [row],
        flags: 64
    });

    const filter = (i) => i.user.id === interaction.user.id && i.customId.startsWith('simple_');
    
    try {
        const buttonInteraction = await interaction.followUp({
            content: 'Warte auf deine Auswahl...',
            flags: 64
        }).then(() => {
            return interaction.channel.awaitMessageComponent({ filter, time: 60000 });
        });

        if (buttonInteraction.customId === `simple_toggle_${type}`) {
            await handleToggleReward(buttonInteraction, guild, type);
        } else if (buttonInteraction.customId === `simple_config_${type}`) {
            await handleConfigureRoles(buttonInteraction, guild, type, originalMessage);
        } else if (buttonInteraction.customId === `simple_clear_${type}`) {
            await handleClearRoles(buttonInteraction, guild, type);
        }

    } catch (error) {
        console.log('Button interaction timeout or error:', error.message);
    }
}

async function handleToggleReward(interaction, guild, type) {
    try {
        const rewardType = type === 'message' ? 'messageRewards' : 'vcRewards';
        const currentState = guild.leaderboard[rewardType].enabled;
        const newState = !currentState;

        await Guild.findOneAndUpdate(
            { guildId: guild.guildId },
            { $set: { [`leaderboard.${rewardType}.enabled`]: newState } }
        );

        await interaction.update({
            content: `${emojis.check} ${type === 'message' ? 'Nachrichten' : 'Voice'} Belohnungen ${newState ? 'aktiviert' : 'deaktiviert'}!`,
            embeds: [],
            components: []
        });

    } catch (error) {
        console.error('Error toggling reward:', error);
        await interaction.update({
            content: `${emojis.warning} Fehler beim Aktualisieren der Einstellung.`,
            embeds: [],
            components: []
        });
    }
}

async function handleClearRoles(interaction, guild, type) {
    try {
        const rewardType = type === 'message' ? 'messageRewards' : 'vcRewards';
        
        await Guild.findOneAndUpdate(
            { guildId: guild.guildId },
            { 
                $set: { 
                    [`leaderboard.${rewardType}.roles.first`]: [],
                    [`leaderboard.${rewardType}.roles.second`]: [],
                    [`leaderboard.${rewardType}.roles.third`]: [],
                    [`leaderboard.${rewardType}.roles.allTop3`]: []
                }
            }
        );

        await interaction.update({
            content: `${emojis.check} Alle ${type === 'message' ? 'Nachrichten' : 'Voice'} Belohnungsrollen wurden gelöscht!`,
            embeds: [],
            components: []
        });

    } catch (error) {
        console.error('Error clearing roles:', error);
        await interaction.update({
            content: `${emojis.warning} Fehler beim Löschen der Rollen.`,
            embeds: [],
            components: []
        });
    }
}

async function handleConfigureRoles(interaction, guild, type, originalMessage) {
    const embed = new EmbedBuilder()
        .setTitle(`${emojis.settings} ${type === 'message' ? 'Nachrichten' : 'Voice'} Rollen Setup`)
        .setColor('#2f3136')
        .setDescription('**Schritt 1:** Wähle die Position für die Rollen:')
        .addFields({
            name: 'Sende eine dieser Optionen in den Chat:',
            value: '**1** - Rollen für 1. Platz\n**2** - Rollen für 2. Platz\n**3** - Rollen für 3. Platz\n**all** - Rollen für alle Top 3\n**cancel** - Abbrechen',
            inline: false
        })
        .setTimestamp();

    await interaction.update({
        embeds: [embed],
        components: []
    });

    const setupKey = `${guild.guildId}-${interaction.user.id}-${type}`;
    activeRewardSetups.set(setupKey, {
        guildId: guild.guildId,
        userId: interaction.user.id,
        type: type,
        step: 'position'
    });

    const messageFilter = (msg) => msg.author.id === interaction.user.id;
    const messageCollector = originalMessage.channel.createMessageCollector({
        filter: messageFilter,
        time: 300000,
        max: 10
    });

    messageCollector.on('collect', async (msg) => {
        const setup = activeRewardSetups.get(setupKey);
        if (!setup) return;

        const content = msg.content.toLowerCase().trim();

        if (content === 'cancel') {
            activeRewardSetups.delete(setupKey);
            await msg.reply(`${emojis.check} Setup abgebrochen.`);
            messageCollector.stop();
            return;
        }

        if (setup.step === 'position') {
            if (['1', '2', '3', 'all'].includes(content)) {
                setup.position = content;
                setup.step = 'roles';

                const positionName = content === '1' ? '1. Platz' : 
                                     content === '2' ? '2. Platz' : 
                                     content === '3' ? '3. Platz' : 'Alle Top 3';

                await msg.reply({
                    embeds: [new EmbedBuilder()
                        .setTitle(`${emojis.settings} Rollen für ${positionName}`)
                        .setColor('#2f3136')
                        .setDescription(`**Schritt 2:** Sende die Rollen für ${positionName}:`)
                        .addFields({
                            name: 'Beispiele:',
                            value: '`123456789012345678` - Rollen-ID\n`@VIP @Premium` - Rollen-Erwähnungen\n`123456 @Role1` - Gemischt\n`cancel` - Abbrechen',
                            inline: false
                        })]
                });
            } else {
                await msg.reply(`${emojis.warning} Ungültige Eingabe! Verwende: **1**, **2**, **3**, **all** oder **cancel**`);
            }
        } else if (setup.step === 'roles') {
            await processRoleInput(msg, setup, guild);
            messageCollector.stop();
        }
    });

    messageCollector.on('end', () => {
        activeRewardSetups.delete(setupKey);
    });
}

async function processRoleInput(message, setup, guild) {
    const roles = parseRoles(message.content);
    
    if (roles.length === 0) {
        await message.reply(`${emojis.warning} Keine gültigen Rollen gefunden!`);
        return;
    }

    const validRoles = [];
    for (const roleId of roles) {
        const role = message.guild.roles.cache.get(roleId);
        if (role) {
            validRoles.push({ id: roleId, name: role.name });
        }
    }

    if (validRoles.length === 0) {
        await message.reply(`${emojis.warning} Keine der Rollen wurden im Server gefunden!`);
        return;
    }

    try {
        const rewardType = setup.type === 'message' ? 'messageRewards' : 'vcRewards';
        const positionField = setup.position === '1' ? 'first' : 
                             setup.position === '2' ? 'second' : 
                             setup.position === '3' ? 'third' : 'allTop3';

        await Guild.findOneAndUpdate(
            { guildId: guild.guildId },
            { $set: { [`leaderboard.${rewardType}.roles.${positionField}`]: validRoles.map(r => r.id) } }
        );

        const positionName = setup.position === '1' ? '1. Platz' : 
                            setup.position === '2' ? '2. Platz' : 
                            setup.position === '3' ? '3. Platz' : 'Alle Top 3';

        const embed = new EmbedBuilder()
            .setTitle(`${emojis.check} Rollen gesetzt!`)
            .setColor('#57F287')
            .setDescription(`**${positionName}** (${setup.type === 'message' ? 'Nachrichten' : 'Voice'}):`)
            .addFields({
                name: 'Rollen:',
                value: validRoles.map(r => `<@&${r.id}> (${r.name})`).join('\n'),
                inline: false
            });

        await message.reply({ embeds: [embed] });

    } catch (error) {
        console.error('Error saving roles:', error);
        await message.reply(`${emojis.warning} Fehler beim Speichern!`);
    }

    activeRewardSetups.delete(`${setup.guildId}-${setup.userId}-${setup.type}`);
}

function parseRoles(content) {
    const roles = [];
    const roleIdRegex = /\b\d{17,19}\b/g;
    const roleMentionRegex = /<@&(\d{17,19})>/g;
    
    let match;
    while ((match = roleIdRegex.exec(content)) !== null) {
        roles.push(match[0]);
    }
    
    while ((match = roleMentionRegex.exec(content)) !== null) {
        roles.push(match[1]);
    }
    
    return [...new Set(roles)];
}

async function toggleSystem(interaction, guild) {
    try {
        const newState = !guild.leaderboard.enabled;
        
        await Guild.findOneAndUpdate(
            { guildId: guild.guildId },
            { $set: { 'leaderboard.enabled': newState } }
        );
        
        guild.leaderboard.enabled = newState;
        
        if (interaction.client.leaderboardManager) {
            await interaction.client.leaderboardManager.updateGuildConfig(guild.guildId);
        }
        
        await interaction.reply({
            embeds: [createEmbed('success', `${emojis.settings} System Aktualisiert`, `Rangliste ${newState ? `${emojis.check} aktiviert` : `${emojis.deny} deaktiviert`}.`)],
            flags: 64
        });
    } catch (error) {
        console.error('Error toggling system:', error);
        await interaction.reply({
            content: `${emojis.warning} Fehler beim Aktualisieren des Systems.`,
            flags: 64
        });
    }
}

async function setChannel(interaction, guild) {
    const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId('lb_channel_select')
        .setPlaceholder('Wähle einen Kanal für die Rangliste')
        .setChannelTypes(ChannelType.GuildText);
    
    const row = new ActionRowBuilder().addComponents(channelSelect);
    
    await interaction.reply({
        content: 'Wähle einen Kanal für die Rangliste:',
        components: [row],
        flags: 64
    });
    
    try {
        const channelInteraction = await interaction.channel.awaitMessageComponent({
            filter: (i) => i.user.id === interaction.user.id && i.customId === 'lb_channel_select',
            time: 60000
        });
        
        const selectedChannel = channelInteraction.values[0];
        
        await Guild.findOneAndUpdate(
            { guildId: guild.guildId },
            { $set: { 'leaderboard.channelId': selectedChannel } }
        );
        
        guild.leaderboard.channelId = selectedChannel;
        
        await channelInteraction.update({
            content: `${emojis.check} Rangliste Kanal auf <#${selectedChannel}> gesetzt.`,
            components: []
        });
    } catch (error) {
        await interaction.editReply({
            content: `${emojis.warning} Auswahl abgelaufen.`,
            components: []
        });
    }
}

async function configureRefreshSettings(interaction, guild) {
    const embed = new EmbedBuilder()
        .setTitle(`${emojis.settings} Auto-Aktualisierung Konfiguration`)
        .setColor('#2f3136')
        .setDescription('Konfiguriere die automatische Aktualisierung der Rangliste.')
        .addFields(
            {
                name: 'Aktueller Status',
                value: guild.leaderboard.autoRefresh ? 
                    `${emojis.check} Aktiviert` : 
                    `${emojis.deny} Deaktiviert`,
                inline: true
            },
            {
                name: 'Intervall',
                value: `${guild.leaderboard.refreshInterval} Minuten`,
                inline: true
            }
        );
    
    const toggleButton = new ButtonBuilder()
        .setCustomId('toggle_auto_refresh')
        .setLabel(guild.leaderboard.autoRefresh ? 'Deaktivieren' : 'Aktivieren')
        .setStyle(guild.leaderboard.autoRefresh ? ButtonStyle.Danger : ButtonStyle.Success);
    
    const intervalButton = new ButtonBuilder()
        .setCustomId('set_refresh_interval')
        .setLabel('Intervall Ändern')
        .setStyle(ButtonStyle.Primary);
    
    const row = new ActionRowBuilder().addComponents(toggleButton, intervalButton);
    
    await interaction.reply({
        embeds: [embed],
        components: [row],
        flags: 64
    });
}

async function createLeaderboard(interaction, guild) {
    if (!guild.leaderboard.channelId) {
        return interaction.reply({
            embeds: [createEmbed('error', `${emojis.warning} Kanal Erforderlich`, 'Setze zuerst einen Kanal für die Rangliste.')],
            flags: 64
        });
    }
    
    const channel = interaction.guild.channels.cache.get(guild.leaderboard.channelId);
    if (!channel) {
        return interaction.reply({
            embeds: [createEmbed('error', `${emojis.warning} Kanal Nicht Gefunden`, 'Der konfigurierte Kanal existiert nicht mehr.')],
            flags: 64
        });
    }
    
    try {
        const { embed, components } = await generateLeaderboardEmbed(guild.guildId, interaction.guild);
        
        const message = await channel.send({ embeds: [embed], components });
        
        await Guild.findOneAndUpdate(
            { guildId: guild.guildId },
            { 
                $set: { 
                    'leaderboard.messageId': message.id,
                    'leaderboard.lastRefresh': new Date()
                }
            }
        );
        
        guild.leaderboard.messageId = message.id;
        
        await interaction.reply({
            embeds: [createEmbed('success', `${emojis.check} Rangliste Erstellt`, `Rangliste erfolgreich in <#${channel.id}> erstellt.`)],
            flags: 64
        });
        
    } catch (error) {
        console.error('Error creating leaderboard:', error);
        await interaction.reply({
            embeds: [createEmbed('error', `${emojis.warning} Fehler`, 'Konnte die Rangliste nicht erstellen.')],
            flags: 64
        });
    }
}

async function showLeaderboard(message) {
    const guild = await Guild.findOne({ guildId: message.guild.id });
    
    if (!guild?.leaderboard?.enabled) {
        return message.reply({
            embeds: [createEmbed('error', `${emojis.warning} System Deaktiviert`, 'Die Rangliste ist nicht aktiviert. Verwende `!leaderboard setup` um sie zu konfigurieren.')]
        });
    }
    
    const { embed, components } = await generateLeaderboardEmbed(message.guild.id, message.guild);
    
    await message.reply({ embeds: [embed], components });
}

async function generateLeaderboardEmbed(guildId, guild) {
    const currentMonth = getCurrentMonth();
    const guildConfig = await Guild.findOne({ guildId });
    const showTop = guildConfig?.leaderboard?.showTop || 10;
    
    const topMessageSenders = await monthlyTracker.getTopUsers(guildId, 'messages', showTop, currentMonth);
    const topVoiceUsers = await monthlyTracker.getTopUsers(guildId, 'voice', showTop, currentMonth);
    
    const embed = new EmbedBuilder()
        .setTitle(`${emojis.claim} Monatliche Rangliste`)
        .setColor('#2f3136')
        .setDescription(`**Aktueller Monat:** ${formatMonthName(currentMonth)}\n**Letztes Update:** <t:${Math.floor(Date.now() / 1000)}:R>`)
        .setThumbnail(guild.iconURL({ dynamic: true }))
        .setTimestamp();
    
    let messageLeaderboard = '';
    if (topMessageSenders.length > 0) {
        topMessageSenders.forEach((user, index) => {
            const position = index + 1;
            const trophy = trophyEmojis[position] || `${position}.`;
            messageLeaderboard += `${trophy} <@${user.userId}> - **${user.messageCount.toLocaleString()}** Nachrichten\n`;
        });
    } else {
        messageLeaderboard = 'Keine Daten verfügbar';
    }
    
    embed.addFields({
        name: `${emojis.user} Top ${showTop} Nachrichten Schreiber`,
        value: messageLeaderboard,
        inline: false
    });
    
    let voiceLeaderboard = '';
    if (topVoiceUsers.length > 0) {
        topVoiceUsers.forEach((user, index) => {
            const position = index + 1;
            const trophy = trophyEmojis[position] || `${position}.`;
            const hours = Math.floor(user.vcTimeMinutes / 60);
            const minutes = user.vcTimeMinutes % 60;
            voiceLeaderboard += `${trophy} <@${user.userId}> - **${hours}h ${minutes}m**\n`;
        });
    } else {
        voiceLeaderboard = 'Keine Daten verfügbar';
    }
    
    embed.addFields({
        name: `${emojis.mic} Top ${showTop} Voice Chat Benutzer`,
        value: voiceLeaderboard,
        inline: false
    });

    const historyButton = new ButtonBuilder()
        .setCustomId('lb_show_history')
        .setLabel('Verlauf')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(emojis.eyeOpen);

    const components = [new ActionRowBuilder().addComponents(historyButton)];
    
    return { embed, components, topMessageSenders, topVoiceUsers };
}

async function showLeaderboardHistory(interaction) {
    try {
        const histories = await LeaderboardHistory.find({ guildId: interaction.guild.id })
            .sort({ month: -1 })
            .limit(12);

        if (histories.length === 0) {
            return interaction.reply({
                content: `${emojis.warning} Noch keine Verlaufs-Daten verfügbar.`,
                flags: 64
            });
        }

        const historyOptions = histories.map(history => ({
            label: formatMonthName(history.month),
            description: `Sieger von ${formatMonthName(history.month)}`,
            value: history.month,
            emoji: '📊'
        }));

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('lb_history_select')
            .setPlaceholder('Wähle einen Monat zum Anzeigen')
            .addOptions(historyOptions);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        await interaction.reply({
            content: `${emojis.eyeOpen} **Rangliste Verlauf** - Wähle einen Monat:`,
            components: [row],
            flags: 64
        });

    } catch (error) {
        console.error('Error showing leaderboard history:', error);
        await interaction.reply({
            content: `${emojis.warning} Fehler beim Laden des Verlaufs.`,
            flags: 64
        });
    }
}

async function displayMonthHistory(interaction, selectedMonth) {
    try {
        const history = await LeaderboardHistory.findOne({
            guildId: interaction.guild.id,
            month: selectedMonth
        });

        if (!history) {
            return interaction.update({
                content: `${emojis.warning} Keine Daten für ${formatMonthName(selectedMonth)} gefunden.`,
                components: []
            });
        }

        const embed = new EmbedBuilder()
            .setTitle(`📊 Rangliste ${formatMonthName(selectedMonth)}`)
            .setColor('#2f3136')
            .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
            .setTimestamp();

        if (history.topMessageSenders.length > 0) {
            let messageWinners = '';
            history.topMessageSenders.forEach((user, index) => {
                const trophy = trophyEmojis[index + 1] || `${index + 1}.`;
                messageWinners += `${trophy} <@${user.userId}> - **${user.messageCount.toLocaleString()}** Nachrichten\n`;
            });
            
            embed.addFields({
                name: `${emojis.user} Top Nachrichten Schreiber`,
                value: messageWinners,
                inline: false
            });
        }

        if (history.topVoiceUsers.length > 0) {
            let voiceWinners = '';
            history.topVoiceUsers.forEach((user, index) => {
                const trophy = trophyEmojis[index + 1] || `${index + 1}.`;
                const hours = Math.floor(user.vcTimeMinutes / 60);
                const minutes = user.vcTimeMinutes % 60;
                voiceWinners += `${trophy} <@${user.userId}> - **${hours}h ${minutes}m**\n`;
            });
            
            embed.addFields({
                name: `${emojis.mic} Top Voice Chat Benutzer`,
                value: voiceWinners,
                inline: false
            });
        }

        const backButton = new ButtonBuilder()
            .setCustomId('lb_back_to_history')
            .setLabel('Zurück zum Verlauf')
            .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder().addComponents(backButton);

        await interaction.update({
            embeds: [embed],
            components: [row]
        });

    } catch (error) {
        console.error('Error displaying month history:', error);
        await interaction.update({
            content: `${emojis.warning} Fehler beim Laden der Daten.`,
            components: []
        });
    }
}

function getCurrentMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthName(monthString) {
    const [year, month] = monthString.split('-');
    const monthNames = [
        'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
        'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
    ];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
}

function createEmbed(type, title, description) {
    const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor('#2f3136')
        .setTimestamp();
    
    return embed;
}

global.leaderboardInteractionHandler = async (interaction) => {
    if (interaction.customId === 'lb_show_history') {
        await showLeaderboardHistory(interaction);
    } else if (interaction.customId === 'lb_history_select') {
        await displayMonthHistory(interaction, interaction.values[0]);
    } else if (interaction.customId === 'lb_back_to_history') {
        await showLeaderboardHistory(interaction);
    }
};

module.exports.generateLeaderboardEmbed = generateLeaderboardEmbed;
module.exports.getCurrentMonth = getCurrentMonth;