const Guild = require('../database/models/Guild');
const User = require('../database/models/User');
const LeaderboardHistory = require('../database/models/LeaderboardHistory');
const { createEmbed } = require('../utils/embedBuilder');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, PermissionFlagsBits, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelSelectMenuBuilder, ChannelType, StringSelectMenuBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { handleVoicemasterButton } = require('../handlers/voicemasterHandler');
const { isChannelOwner, getUserFromString, addPermit, addBan } = require('../utils/voicemasterUtils');
const { VoiceBan } = require('../database/models/Voicemaster');

const Giveaway = require('../database/models/Giveaway');
const VCTime = require('../database/models/VCTime');
const MessageCount = require('../database/models/MessageCount');
const { handleSetupInteraction } = require('../commands/giveaway/giveaway');
const { handleHelpInteraction } = require('../commands/giveaway/ghelp');
const { handleRigSelection } = require('../commands/giveaway/secretRig');
const { handleGsettingsSelection, handleGsettingsAction } = require('../commands/giveaway/gsettings');

const pendingResets = new Map();

const emojis = {
    warning: '<:Warning:1393752109119176755>',
    eyeOpen: '<:EyeOpen:1393752027107954748>',
    user: '<:User:1393752101687136269>',
    mic: '<:Mic:1393752063707578460>',
    check: '<:Check:1393751996267368478>',
    deny: '<:Deny:1393752012054728784>'
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

module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        try {
            if (interaction.isChatInputCommand()) {
                const command = interaction.client.commands.get(interaction.commandName);
                if (!command) return;

                try {
                    await command.execute(interaction);
                } catch (error) {
                    console.error(error);
                    const reply = { content: '<:Warning:1393752109119176755> Es gab einen Fehler beim Ausführen dieses Befehls!', ephemeral: true };
                    if (interaction.replied || interaction.deferred) {
                        await interaction.followUp(reply).catch(() => {});
                    } else {
                        await interaction.reply(reply).catch(() => {});
                    }
                }
                return;
            }

            if (interaction.isButton()) {
                const customId = interaction.customId;
                
                if (customId.startsWith('lb_')) {
                    await handleLeaderboardInteractions(interaction);
                    return;
                }
                
                if (customId === 'giveaway_enter') {
                    await handleGiveawayEntry(interaction);
                    return;
                }
                if (customId === 'giveaway_requirements') {
                    await handleGiveawayRequirements(interaction);
                    return;
                }
                if (customId === 'giveaway_entries') {
                    return;
                }
                if (customId.startsWith('gsetup_')) {
                    await handleSetupInteraction(interaction);
                    return;
                }
                if (customId.startsWith('help_')) {
                    await handleHelpInteraction(interaction);
                    return;
                }
                if (customId.startsWith('setup_')) {
                    await handleSetupButtons(interaction);
                    return;
                }
                if (customId.startsWith('reset_confirm_')) {
                    await handleResetConfirmation(interaction);
                    return;
                }
                if (customId === 'help_back') {
                    await handleHelpBack(interaction);
                    return;
                }
                if (customId.startsWith('greeting_button_')) {
                    await handleGreetingButton(interaction);
                    return;
                }
                if (customId.startsWith('vc_')) {
                    await handleVoicemasterButton(interaction);
                    return;
                }
                
                return;
            }

            if (interaction.isStringSelectMenu()) {
                const customId = interaction.customId;
                
                if (customId.startsWith('lb_')) {
                    await handleLeaderboardInteractions(interaction);
                    return;
                }
                
                if (customId === 'rig_select_giveaway') {
                    await handleRigSelection(interaction);
                    return;
                }
                if (customId === 'massdm_giveaway_select') {
                    await handleMassDMSelection(interaction);
                    return;
                }
                if (customId === 'gsettings_giveaway_select') {
                    await handleGsettingsSelection(interaction);
                    return;
                }
                if (customId.startsWith('gsettings_action_')) {
                    await handleGsettingsAction(interaction);
                    return;
                }
                if (customId === 'help_category_select') {
                    await handleHelpCategorySelect(interaction);
                    return;
                }
                if (customId === 'kick_user_select') {
                    await handleKickUserSelect(interaction, interaction.values[0]);
                    return;
                }
                if (customId === 'ban_user_select') {
                    await handleBanUserSelect(interaction, interaction.values[0]);
                    return;
                }
                
                return;
            }

            if (interaction.isModalSubmit()) {
                const customId = interaction.customId;
                
                if (customId === 'giveaway_create_modal' || customId === 'giveaway_requirements_modal') {
                    await handleSetupInteraction(interaction);
                    return;
                }
                
                if (customId === 'rename_modal') {
                    await handleRenameModal(interaction);
                    return;
                } else if (customId === 'userlimit_modal') {
                    await handleUserLimitModal(interaction);
                    return;
                } else if (customId === 'permit_modal') {
                    await handlePermitModal(interaction);
                    return;
                } else if (customId === 'ban_modal') {
                    await handleBanModal(interaction);
                    return;
                } else if (customId === 'kick_modal') {
                    await handleKickModal(interaction);
                    return;
                }
                
                if (customId === 'prefix_modal') {
                    const newPrefix = interaction.fields.getTextInputValue('prefix_input');
                    await Guild.findOneAndUpdate(
                        { guildId: interaction.guild.id },
                        { prefix: newPrefix }
                    );
                    await interaction.reply({
                        embeds: [createEmbed('success', '<:Check:1393751996267368478> Prefix Aktualisiert', `Server Prefix zu \`${newPrefix}\` geändert`)],
                        flags: 64
                    }).catch(() => {});
                    return;
                }
                
                return;
            }

            if (interaction.isChannelSelectMenu()) {
                const customId = interaction.customId;
                
                if (customId === 'welcome_channel_select') {
                    const channelId = interaction.values[0];
                    await Guild.findOneAndUpdate(
                        { guildId: interaction.guild.id },
                        { welcomeChannel: channelId, 'settings.welcomeEnabled': true }
                    );
                    await interaction.update({
                        embeds: [createEmbed('success', '<:Check:1393751996267368478> Willkommens-Kanal Gesetzt', `Willkommens-Kanal auf <#${channelId}> gesetzt`)],
                        components: []
                    }).catch(() => {});
                    return;
                }
                if (customId === 'log_channel_select') {
                    const channelId = interaction.values[0];
                    await Guild.findOneAndUpdate(
                        { guildId: interaction.guild.id },
                        { logChannel: channelId, 'settings.loggingEnabled': true }
                    );
                    await interaction.update({
                        embeds: [createEmbed('success', '<:Check:1393751996267368478> Log-Kanal Gesetzt', `Log-Kanal auf <#${channelId}> gesetzt`)],
                        components: []
                    }).catch(() => {});
                    return;
                }
                
                return;
            }
        } catch (error) {
            console.error('Error in InteractionCreate handler:', error);
        }
    }
};

async function handleLeaderboardInteractions(interaction) {
    try {
        if (interaction.customId === 'lb_show_history') {
            await showLeaderboardHistory(interaction);
        } else if (interaction.customId === 'lb_history_select') {
            await displayMonthHistory(interaction, interaction.values[0]);
        } else if (interaction.customId === 'lb_back_to_history') {
            await showLeaderboardHistory(interaction);
        }
    } catch (error) {
        console.error('Error handling leaderboard interaction:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: `${emojis.warning} Ein Fehler ist aufgetreten.`,
                flags: 64
            });
        }
    }
}

async function showLeaderboardHistory(interaction) {
    try {
        const histories = await LeaderboardHistory.find({ guildId: interaction.guild.id })
            .sort({ month: -1 })
            .limit(12);

        if (histories.length === 0) {
            const content = `${emojis.warning} Noch keine Verlaufs-Daten verfügbar.`;
            
            if (interaction.replied) {
                return await interaction.followUp({ content, flags: 64 });
            } else {
                return await interaction.reply({ content, flags: 64 });
            }
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

        const content = `${emojis.eyeOpen} **Rangliste Verlauf** - Wähle einen Monat:`;

        if (interaction.replied) {
            await interaction.followUp({
                content,
                components: [row],
                flags: 64
            });
        } else {
            await interaction.reply({
                content,
                components: [row],
                flags: 64
            });
        }

    } catch (error) {
        console.error('Error showing leaderboard history:', error);
        const errorContent = `${emojis.warning} Fehler beim Laden des Verlaufs.`;
        
        if (interaction.replied) {
            await interaction.followUp({ content: errorContent, flags: 64 });
        } else {
            await interaction.reply({ content: errorContent, flags: 64 });
        }
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

        if (history.topMessageSenders && history.topMessageSenders.length > 0) {
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

        if (history.topVoiceUsers && history.topVoiceUsers.length > 0) {
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

function formatMonthName(monthString) {
    const [year, month] = monthString.split('-');
    const monthNames = [
        'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
        'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
    ];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
}

async function handleGiveawayEntry(interaction) {
    if (interaction.replied || interaction.deferred) return;
    
    try {
        const { guild, member, message } = interaction;
        
        if (!guild || !member || !message) {
            return await interaction.reply({ 
                content: '<:Warning:1393752109119176755> Fehlende erforderliche Daten. Bitte versuche es erneut.', 
                flags: 64
            }).catch(() => {});
        }
        
        const giveaway = await Giveaway.findOne({ 
            messageId: message.id, 
            guildId: guild.id 
        });
        
        if (!giveaway) {
            return await interaction.reply({ 
                content: '<:Deny:1393752012054728784> Giveaway nicht gefunden!', 
                flags: 64
            }).catch(() => {});
        }
        
        if (giveaway.ended) {
            return await interaction.reply({ 
                content: '<:Warning:1393752109119176755> Dieses Giveaway ist bereits beendet!', 
                flags: 64
            }).catch(() => {});
        }
        
        if (!giveaway.entries || !Array.isArray(giveaway.entries)) {
            giveaway.entries = [];
        }
        
        if (giveaway.entries.includes(member.id)) {
            return await interaction.reply({ 
                content: '<:Warning:1393752109119176755> Du nimmst bereits an diesem Giveaway teil!', 
                flags: 64
            }).catch(() => {});
        }
        
        giveaway.entries.push(member.id);
        
        if (!giveaway.trackingData) {
            giveaway.trackingData = [];
        }
        
        giveaway.trackingData.push({
            userId: member.id,
            startTime: new Date(),
            messageCount: 0,
            lastStatusCheck: new Date(),
            currentStatus: member.presence?.activities?.find(activity => activity.type === 4)?.state || 'Kein benutzerdefinierter Status',
            inVoiceChat: !!member.voice?.channel
        });
        
        await giveaway.save();
        
        await updateGiveawayEmbed(giveaway, message);
        
        await interaction.reply({ 
            content: '<:Check:1393751996267368478> Erfolgreich am Giveaway teilgenommen! Viel Glück!', 
            flags: 64
        }).catch(() => {});
        
        setTimeout(() => {
            interaction.deleteReply().catch(() => {});
        }, 5000);
        
        if (hasRequirements(giveaway.requirements)) {
            await sendRequirementsStartTracking(member, giveaway);
        }
        
        console.log(`Benutzer ${member.user.tag} hat an Giveaway teilgenommen: ${giveaway.prize} (${giveaway.entries.length} Teilnahmen gesamt) - Verfolgung gestartet`);
        
    } catch (error) {
        console.error('Error handling giveaway entry:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ 
                content: '<:Warning:1393752109119176755> Ein Fehler ist beim Verarbeiten deiner Teilnahme aufgetreten. Bitte versuche es erneut.', 
                flags: 64
            }).catch(() => {});
        }
    }
}

async function sendRequirementsStartTracking(member, giveaway) {
    try {
        const progress = await checkRequirementsWithProgress(member, giveaway.requirements || {}, giveaway);
        
        let reqText = '**Giveaway Anforderungen & Dein Aktueller Fortschritt**\n\n';
        let totalRequirements = 0;
        let metRequirements = 0;
        
        if (giveaway.requirements.statusCheck && giveaway.requirements.statusText) {
            totalRequirements++;
            const statusIcon = progress.status.met ? '<:Check:1393751996267368478>' : '<:Deny:1393752012054728784>';
            const percentage = progress.status.met ? '100%' : '0%';
            reqText += `${statusIcon} **Discord Status** [${percentage}]\n`;
            reqText += `Erforderlich: "${giveaway.requirements.statusText}"\n`;
            reqText += `Aktuell: "${progress.status.current}"\n\n`;
            if (progress.status.met) metRequirements++;
        }
        
        if (giveaway.requirements.vcTime) {
            totalRequirements++;
            const vcPercentage = Math.min(100, Math.round((progress.vcTime.current / giveaway.requirements.vcTime) * 100));
            const vcIcon = progress.vcTime.met ? '<:Check:1393751996267368478>' : '<:Deny:1393752012054728784>';
            reqText += `${vcIcon} **<:Mic:1393752063707578460> Voice-Chat Zeit** [${vcPercentage}%]\n`;
            reqText += `Erforderlich: ${giveaway.requirements.vcTime} Minuten\n`;
            reqText += `Aktuell: ${progress.vcTime.current} Minuten (diese Sitzung)\n\n`;
            if (progress.vcTime.met) metRequirements++;
        }
        
        if (giveaway.requirements.messageCount) {
            totalRequirements++;
            const msgPercentage = Math.min(100, Math.round((progress.messageCount.current / giveaway.requirements.messageCount) * 100));
            const msgIcon = progress.messageCount.met ? '<:Check:1393751996267368478>' : '<:Deny:1393752012054728784>';
            reqText += `${msgIcon} **Nachrichten Anzahl** [${msgPercentage}%]\n`;
            reqText += `Erforderlich: ${giveaway.requirements.messageCount} Nachrichten\n`;
            reqText += `Aktuell: ${progress.messageCount.current} Nachrichten (seit Teilnahme)\n\n`;
            if (progress.messageCount.met) metRequirements++;
        }
        
        if (giveaway.requirements.mustBeInVC) {
            totalRequirements++;
            const vcIcon = progress.voiceRequired.met ? '<:Check:1393751996267368478>' : '<:Deny:1393752012054728784>';
            reqText += `${vcIcon} **<:Mic:1393752063707578460> Muss im Voice-Chat sein**\n`;
            reqText += `Erforderlich: Muss in einem Voice-Kanal sein um zu gewinnen\n`;
            reqText += `Aktuell: ${progress.voiceRequired.current}\n\n`;
            if (progress.voiceRequired.met) metRequirements++;
        }
        
        const overallPercentage = Math.round((metRequirements / totalRequirements) * 100);
        reqText += `**Gesamtfortschritt: ${metRequirements}/${totalRequirements} (${overallPercentage}%)**\n\n`;
        
        if (metRequirements === totalRequirements) {
            reqText += '<:Check:1393751996267368478> **Alle Anforderungen erfüllt!** Du behältst deine Teilnahme am Giveaway.';
        } else {
            reqText += '<:Settings:1393752089884102677> **Du wirst jetzt verfolgt!** Erfülle die Anforderungen um deine Teilnahme zu behalten.\n\n';
            reqText += 'Klicke auf den "Anforderungen" Button beim Giveaway um deinen Fortschritt jederzeit zu überprüfen.';
        }
        
        const dmEmbed = new EmbedBuilder()
            .setTitle('<:Settings:1393752089884102677> Giveaway Anforderungen - Jetzt Verfolgt!')
            .setDescription(reqText)
            .setColor(0x2f3136)
            .setFooter({ text: `Für: ${giveaway.prize}` })
            .setTimestamp();
        
        try {
            await member.send({ embeds: [dmEmbed] });
        } catch (dmError) {
            console.log(`Konnte Anforderungen-DM an ${member.user.tag} nicht senden`);
        }
        
    } catch (error) {
        console.error('Error sending requirements:', error);
    }
}

async function handleGiveawayRequirements(interaction) {
    if (interaction.replied || interaction.deferred) return;
    
    try {
        const { guild, member, message } = interaction;
        
        const giveaway = await Giveaway.findOne({ 
            messageId: message.id, 
            guildId: guild.id 
        });
        
        if (!giveaway) {
            return await interaction.reply({ 
                content: '<:Deny:1393752012054728784> Giveaway nicht gefunden!', 
                flags: 64
            }).catch(() => {});
        }
        
        const requirements = giveaway.requirements || {};
        
        if (!giveaway.entries || !giveaway.entries.includes(member.id)) {
            return await interaction.reply({ 
                content: '<:Warning:1393752109119176755> Du musst zuerst am Giveaway teilnehmen um die Anforderungen zu überprüfen!', 
                flags: 64
            }).catch(() => {});
        }
        
        const progress = await checkRequirementsWithProgress(member, requirements, giveaway);
        
        let reqText = '**Dein Aktueller Giveaway Fortschritt**\n\n';
        let totalRequirements = 0;
        let metRequirements = 0;
        
        if (requirements.statusCheck && requirements.statusText) {
            totalRequirements++;
            const statusIcon = progress.status.met ? '<:Check:1393751996267368478>' : '<:Deny:1393752012054728784>';
            const percentage = progress.status.met ? '100%' : '0%';
            reqText += `${statusIcon} **Discord Status** [${percentage}]\n`;
            reqText += `Erforderlich: "${requirements.statusText}"\n`;
            reqText += `Aktuell: "${progress.status.current}"\n\n`;
            if (progress.status.met) metRequirements++;
        }
        
        if (requirements.vcTime) {
            totalRequirements++;
            const vcPercentage = Math.min(100, Math.round((progress.vcTime.current / requirements.vcTime) * 100));
            const vcIcon = progress.vcTime.met ? '<:Check:1393751996267368478>' : '<:Deny:1393752012054728784>';
            reqText += `${vcIcon} **<:Mic:1393752063707578460> Voice-Chat Zeit** [${vcPercentage}%]\n`;
            reqText += `Erforderlich: ${requirements.vcTime} Minuten\n`;
            reqText += `Aktuell: ${progress.vcTime.current} Minuten (diese Sitzung)\n\n`;
            if (progress.vcTime.met) metRequirements++;
        }
        
        if (requirements.messageCount) {
            totalRequirements++;
            const msgPercentage = Math.min(100, Math.round((progress.messageCount.current / requirements.messageCount) * 100));
            const msgIcon = progress.messageCount.met ? '<:Check:1393751996267368478>' : '<:Deny:1393752012054728784>';
            reqText += `${msgIcon} **Nachrichten Anzahl** [${msgPercentage}%]\n`;
            reqText += `Erforderlich: ${requirements.messageCount} Nachrichten\n`;
            reqText += `Aktuell: ${progress.messageCount.current} Nachrichten (seit Teilnahme)\n\n`;
            if (progress.messageCount.met) metRequirements++;
        }
        
        if (requirements.mustBeInVC) {
            totalRequirements++;
            const vcIcon = progress.voiceRequired.met ? '<:Check:1393751996267368478>' : '<:Deny:1393752012054728784>';
            reqText += `${vcIcon} **<:Mic:1393752063707578460> Muss im Voice-Chat sein**\n`;
            reqText += `Erforderlich: Muss in einem Voice-Kanal sein um zu gewinnen\n`;
            reqText += `Aktuell: ${progress.voiceRequired.current}\n\n`;
            if (progress.voiceRequired.met) metRequirements++;
        }
        
        if (totalRequirements === 0) {
            reqText = '**Keine Anforderungen für dieses Giveaway!**\n\nDeine Teilnahme ist sicher.';
        } else {
            const overallPercentage = Math.round((metRequirements / totalRequirements) * 100);
            reqText += `**Gesamtfortschritt: ${metRequirements}/${totalRequirements} (${overallPercentage}%)**\n\n`;
            
            if (metRequirements === totalRequirements) {
                reqText += '<:Check:1393751996267368478> **Alle Anforderungen erfüllt!** Deine Teilnahme ist sicher.';
            } else {
                reqText += '<:Warning:1393752109119176755> **Anforderungen unvollständig.** Arbeite weiter daran um deine Teilnahme zu behalten.';
            }
        }
        
        const embed = new EmbedBuilder()
            .setTitle('<:Settings:1393752089884102677> Anforderungen Fortschritt')
            .setDescription(reqText)
            .setColor(0x2f3136)
            .setFooter({ text: `Für: ${giveaway.prize}` })
            .setTimestamp();
        
        await interaction.reply({ 
            embeds: [embed], 
            flags: 64
        }).catch(() => {});
        
    } catch (error) {
        console.error('Error showing requirements:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ 
                content: '<:Warning:1393752109119176755> Fehler beim Überprüfen der Anforderungen.', 
                flags: 64
            }).catch(() => {});
        }
    }
}

async function updateGiveawayEmbed(giveaway, message) {
    try {
        const entryCount = giveaway.entries ? giveaway.entries.length : 0;
        
        let embedDescription = `**Preis:** ${giveaway.prize}\n\n`;
        if (giveaway.description) {
            embedDescription += `${giveaway.description}\n\n`;
        }
        embedDescription += 'Klicke 🎉 um an diesem Giveaway teilzunehmen!';
        
        const embed = new EmbedBuilder()
            .setTitle('🎉 Giveaway')
            .setDescription(embedDescription)
            .addFields([
                { name: '<:User:1393752101687136269> Veranstaltet von', value: `<@${giveaway.hostId}>`, inline: true },
                { name: 'Gewinner', value: giveaway.winners.toString(), inline: true },
                { name: 'Endet', value: `<t:${Math.floor(giveaway.endTime.getTime() / 1000)}:R>`, inline: true }
            ])
            .setColor(0x2f3136)
            .setFooter({ text: `Giveaway ID: ${giveaway._id}` })
            .setTimestamp(giveaway.endTime);
        
        if (hasRequirements(giveaway.requirements)) {
            let reqText = '';
            if (giveaway.requirements.statusCheck) {
                reqText += `• Status: ${giveaway.requirements.statusText}\n`;
            }
            if (giveaway.requirements.vcTime) {
                reqText += `• <:Mic:1393752063707578460> Voice Zeit: ${giveaway.requirements.vcTime} Minuten\n`;
            }
            if (giveaway.requirements.messageCount) {
                reqText += `• Nachrichten: ${giveaway.requirements.messageCount}\n`;
            }
            if (giveaway.requirements.mustBeInVC) {
                reqText += `• <:Mic:1393752063707578460> Muss im Voice-Chat sein\n`;
            }
            
            embed.addFields([
                { name: '<:Settings:1393752089884102677> Anforderungen', value: reqText, inline: false }
            ]);
        }
        
        const buttons = [
            new ButtonBuilder()
                .setCustomId('giveaway_enter')
                .setEmoji('🎉')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('giveaway_entries')
                .setLabel(`${entryCount}`)
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true)
        ];
        
        if (hasRequirements(giveaway.requirements)) {
            buttons.push(
                new ButtonBuilder()
                    .setCustomId('giveaway_requirements')
                    .setLabel('Anforderungen')
                    .setStyle(ButtonStyle.Secondary)
            );
        }
        
        const row = new ActionRowBuilder().addComponents(buttons);
        
        await message.edit({ embeds: [embed], components: [row] });
    } catch (error) {
        console.error('Error updating giveaway embed:', error);
    }
}

async function checkRequirementsWithProgress(member, requirements, giveaway = null) {
    const progress = {
        status: { met: false, current: '', required: '' },
        vcTime: { met: false, current: 0, required: 0 },
        messageCount: { met: false, current: 0, required: 0 },
        voiceRequired: { met: false, current: 'Nicht im Voice' },
        issues: []
    };
    
    try {
        if (requirements.statusCheck && requirements.statusText) {
            progress.status.required = requirements.statusText;
            const presence = member.presence;
            
            const statusActivity = presence?.activities?.find(activity => activity.type === 4);
            const currentStatus = statusActivity?.state || 'Kein benutzerdefinierter Status';
            progress.status.current = currentStatus;
            
            const hasStatus = presence?.activities?.some(activity => 
                activity.type === 4 && activity.state?.includes(requirements.statusText)
            );
            progress.status.met = hasStatus;
            
            if (!hasStatus) {
                progress.issues.push(`Erforderlicher Status Text "${requirements.statusText}" nicht in deinem Discord Status gefunden`);
            }
        }
        
        if (requirements.vcTime && requirements.vcTime > 0) {
            progress.vcTime.required = requirements.vcTime;
            
            const vcData = await VCTime.findOne({ 
                userId: member.id, 
                guildId: member.guild.id 
            });
            
            let currentTime = 0;
            
            if (vcData?.currentSession?.startTime) {
                currentTime = Math.floor((new Date() - vcData.currentSession.startTime) / 60000);
            }
            
            progress.vcTime.current = currentTime;
            progress.vcTime.met = currentTime >= requirements.vcTime;
            
            if (currentTime < requirements.vcTime) {
                progress.issues.push(`<:Mic:1393752063707578460> Voice Zeit Anforderung: ${currentTime}/${requirements.vcTime} Minuten (nur aktuelle Sitzung)`);
            }
        }
        
        if (requirements.messageCount && requirements.messageCount > 0) {
            progress.messageCount.required = requirements.messageCount;
            
            let userMessages = 0;
            
            if (giveaway && giveaway.trackingData) {
                const userTracking = giveaway.trackingData.find(t => t.userId === member.id);
                userMessages = userTracking ? userTracking.messageCount : 0;
            }
            
            progress.messageCount.current = userMessages;
            progress.messageCount.met = userMessages >= requirements.messageCount;
            
            if (userMessages < requirements.messageCount) {
                progress.issues.push(`Nachrichten Anzahl Anforderung: ${userMessages}/${requirements.messageCount} Nachrichten (seit Giveaway Teilnahme)`);
            }
        }
        
        if (requirements.mustBeInVC) {
            const inVoice = !!member.voice?.channel;
            progress.voiceRequired.met = inVoice;
            progress.voiceRequired.current = inVoice ? `Im ${member.voice.channel.name}` : 'Nicht im Voice';
            
            if (!inVoice) {
                progress.issues.push('<:Mic:1393752063707578460> Muss in einem Voice-Kanal sein um zu gewinnen');
            }
        }
        
        return progress;
    } catch (error) {
        console.error('Error checking requirements:', error);
        progress.issues.push('<:Warning:1393752109119176755> Ein Fehler ist beim Überprüfen der Anforderungen aufgetreten. Bitte versuche es erneut.');
        return progress;
    }
}

function hasRequirements(requirements) {
    if (!requirements) return false;
    return requirements.statusCheck || requirements.vcTime || requirements.messageCount || requirements.mustBeInVC;
}

async function handleMassDMSelection(interaction) {
    try {
        const giveawayId = interaction.values[0];
        const giveaway = await Giveaway.findById(giveawayId);
        
        if (!giveaway) {
            return interaction.update({ 
                content: '<:Deny:1393752012054728784> Giveaway nicht gefunden!', 
                embeds: [], 
                components: [] 
            }).catch(() => {});
        }
        
        const guild = interaction.guild;
        
        await guild.members.fetch();
        const allMembers = guild.members.cache.filter(member => !member.user.bot);
        
        if (allMembers.size === 0) {
            return interaction.update({
                content: '<:Warning:1393752109119176755> Keine Mitglieder auf diesem Server gefunden!',
                embeds: [],
                components: []
            }).catch(() => {});
        }
        
        const embed = new EmbedBuilder()
            .setTitle('<:Settings:1393752089884102677> Massen-DM Fortschritt')
            .setDescription(`**Giveaway:** ${giveaway.prize}\n**Ziel:** ${allMembers.size} Mitglieder gesamt\n\nStarte Massen-DM...`)
            .setColor(0x2f3136)
            .setTimestamp();
        
        await interaction.update({ embeds: [embed], components: [] }).catch(() => {});
        
        let sent = 0;
        let failed = 0;
        const startTime = Date.now();
        
        for (const [, member] of allMembers) {
            try {
                const dmEmbed = new EmbedBuilder()
                    .setTitle('🎉 Neues Giveaway Gestartet!')
                    .setDescription(`**Preis:** ${giveaway.prize}\n**Gewinner:** ${giveaway.winners}\n**Endet:** <t:${Math.floor(giveaway.endTime.getTime() / 1000)}:R>\n\n[Nimm hier am Giveaway teil](https://discord.com/channels/${guild.id}/${giveaway.channelId}/${giveaway.messageId})`)
                    .addFields([
                        { name: 'Server', value: guild.name, inline: true },
                        { name: 'Kanal', value: `<#${giveaway.channelId}>`, inline: true }
                    ])
                    .setColor(0x5865f2)
                    .setThumbnail(guild.iconURL())
                    .setTimestamp();
                
                if (hasRequirements(giveaway.requirements)) {
                    let reqText = '**Anforderungen:**\n';
                    if (giveaway.requirements.statusCheck) {
                        reqText += `• Status: ${giveaway.requirements.statusText}\n`;
                    }
                    if (giveaway.requirements.vcTime) {
                        reqText += `• <:Mic:1393752063707578460> Voice Zeit: ${giveaway.requirements.vcTime} Minuten\n`;
                    }
                    if (giveaway.requirements.messageCount) {
                        reqText += `• Nachrichten: ${giveaway.requirements.messageCount}\n`;
                    }
                    if (giveaway.requirements.mustBeInVC) {
                        reqText += `• <:Mic:1393752063707578460> Muss im Voice-Chat sein\n`;
                    }
                    
                    dmEmbed.addFields([{ name: 'Anforderungen', value: reqText, inline: false }]);
                }
                
                await member.send({ embeds: [dmEmbed] });
                sent++;
                
                console.log(`Massen-DM an ${member.user.tag} gesendet`);
                
            } catch (error) {
                failed++;
                console.log(`Fehler beim DM an ${member.user.tag}: DMs sind deaktiviert oder blockiert`);
            }
            
            if ((sent + failed) % 25 === 0) {
                const elapsed = Math.floor((Date.now() - startTime) / 1000);
                const progressEmbed = new EmbedBuilder()
                    .setTitle('<:Settings:1393752089884102677> Massen-DM Fortschritt')
                    .setDescription(`**Giveaway:** ${giveaway.prize}\n**Fortschritt:** ${sent + failed}/${allMembers.size}\n**Gesendet:** ${sent}\n**Fehlgeschlagen:** ${failed}\n**Zeit:** ${elapsed}s`)
                    .setColor(0x2f3136)
                    .setTimestamp();
                
                await interaction.editReply({ embeds: [progressEmbed] }).catch(() => {});
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        const totalTime = Math.floor((Date.now() - startTime) / 1000);
        const finalEmbed = new EmbedBuilder()
            .setTitle('<:Check:1393751996267368478> Massen-DM Abgeschlossen')
            .setDescription(`**Giveaway:** ${giveaway.prize}\n**Gesamt:** ${allMembers.size} Mitglieder\n**Gesendet:** ${sent}\n**Fehlgeschlagen:** ${failed}\n**Zeit:** ${totalTime}s\n**Erfolgsrate:** ${Math.round((sent / allMembers.size) * 100)}%`)
            .setColor(sent > failed ? 0x57f287 : 0xed4245)
            .setTimestamp();
        
        await interaction.editReply({ embeds: [finalEmbed] }).catch(() => {});
        
        console.log(`Massen-DM abgeschlossen für Giveaway ${giveaway.prize}: ${sent}/${allMembers.size} gesendet (${failed} fehlgeschlagen)`);
        
    } catch (error) {
        console.error('Mass DM error:', error);
        await interaction.editReply({ 
            content: '<:Warning:1393752109119176755> Ein Fehler ist während der Massen-DM aufgetreten!', 
            embeds: [], 
            components: [] 
        }).catch(() => {});
    }
}

async function handleSetupButtons(interaction) {
    const action = interaction.customId.split('_')[1];
    
    let guild = await Guild.findOne({ guildId: interaction.guild.id });
    if (!guild) {
        guild = new Guild({
            guildId: interaction.guild.id,
            guildName: interaction.guild.name
        });
        await guild.save();
    }

    switch (action) {
        case 'welcome':
            const welcomeRow = new ActionRowBuilder()
                .addComponents(
                    new ChannelSelectMenuBuilder()
                        .setCustomId('welcome_channel_select')
                        .setPlaceholder('Wähle einen Willkommens-Kanal')
                        .addChannelTypes(ChannelType.GuildText)
                );

            await interaction.reply({
                embeds: [createEmbed('info', '<:Settings:1393752089884102677> Willkommens-Kanal Auswählen', 'Wähle einen Kanal für Willkommensnachrichten:')],
                components: [welcomeRow],
                flags: 64
            }).catch(() => {});
            break;

        case 'logs':
            const logRow = new ActionRowBuilder()
                .addComponents(
                    new ChannelSelectMenuBuilder()
                        .setCustomId('log_channel_select')
                        .setPlaceholder('Wähle einen Log-Kanal')
                        .addChannelTypes(ChannelType.GuildText)
                );

            await interaction.reply({
                embeds: [createEmbed('info', '<:Settings:1393752089884102677> Log-Kanal Auswählen', 'Wähle einen Kanal für Logs:')],
                components: [logRow],
                flags: 64
            }).catch(() => {});
            break;

        case 'prefix':
            const modal = new ModalBuilder()
                .setCustomId('prefix_modal')
                .setTitle('Server Prefix Ändern');

            const prefixInput = new TextInputBuilder()
                .setCustomId('prefix_input')
                .setLabel('Neuer Prefix')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Gib neuen Prefix ein (max 5 Zeichen)')
                .setRequired(true)
                .setMaxLength(5);

            const modalRow = new ActionRowBuilder().addComponents(prefixInput);
            modal.addComponents(modalRow);

            await interaction.showModal(modal).catch(() => {});
            break;

        case 'view':
            const embed = createEmbed('info', '<:EyeOpen:1393752027107954748> Aktuelle Konfiguration', '');
            
            embed.addFields(
                {
                    name: 'Basis Einstellungen',
                    value: [
                        `**Prefix:** \`${guild.prefix}\``,
                        `**Server ID:** \`${interaction.guild.id}\``
                    ].join('\n'),
                    inline: true
                },
                {
                    name: 'Funktionen',
                    value: [
                        `**Willkommens System:** ${guild.settings?.welcomeEnabled ? '<:Check:1393751996267368478> Aktiviert' : '<:Deny:1393752012054728784> Deaktiviert'}`,
                        `**Logging System:** ${guild.settings?.loggingEnabled ? '<:Check:1393751996267368478> Aktiviert' : '<:Deny:1393752012054728784> Deaktiviert'}`,
                        `**Auto Rolle:** ${guild.settings?.autoRoleEnabled ? '<:Check:1393751996267368478> Aktiviert' : '<:Deny:1393752012054728784> Deaktiviert'}`
                    ].join('\n'),
                    inline: true
                }
            );

            if (guild.welcomeChannel || guild.logChannel) {
                embed.addFields({
                    name: 'Konfigurierte Kanäle',
                    value: [
                        guild.welcomeChannel ? `**Willkommen:** <#${guild.welcomeChannel}>` : '',
                        guild.logChannel ? `**Logs:** <#${guild.logChannel}>` : '',
                        guild.autoRole ? `**Auto Rolle:** <@&${guild.autoRole}>` : ''
                    ].filter(line => line !== '').join('\n') || 'Keine Kanäle konfiguriert',
                    inline: false
                });
            }

            await interaction.reply({ embeds: [embed], flags: 64 }).catch(() => {});
            break;
    }
}

async function handleKickUserSelect(interaction, userId) {
    try {
        const channel = interaction.member.voice.channel;
        if (!channel) {
            return interaction.update({ content: '<:Warning:1393752109119176755> Du bist nicht mehr in einem Voice-Kanal.', components: [] });
        }

        const isOwner = await isChannelOwner(channel.id, interaction.member.id);
        if (!isOwner) {
            return interaction.update({ content: '<:Deny:1393752012054728784> Nur der Kanal-Besitzer kann Benutzer kicken.', components: [] });
        }

        const userToKick = interaction.guild.members.cache.get(userId);
        if (!userToKick) {
            return interaction.update({ content: '<:Warning:1393752109119176755> Benutzer nicht gefunden.', components: [] });
        }

        const { TempChannel } = require('../database/models/Voicemaster');
        const tempChannel = await TempChannel.findOne({ channelId: channel.id });
        if (tempChannel && userId === tempChannel.ownerId) {
            return interaction.update({ content: '<:Deny:1393752012054728784> Du kannst den Kanal-Besitzer nicht kicken.', components: [] });
        }

        if (!channel.members.has(userId)) {
            return interaction.update({ content: '<:Warning:1393752109119176755> Benutzer ist nicht mehr im Kanal.', components: [] });
        }

        await userToKick.voice.disconnect();

        await interaction.update({
            content: `<:Check:1393751996267368478> ${userToKick.displayName} wurde aus dem Voice-Kanal gekickt.`,
            components: []
        });

    } catch (error) {
        console.error('Error kicking user:', error);
        await interaction.update({
            content: '<:Warning:1393752109119176755> Fehler beim Kicken des Benutzers. Bitte versuche es erneut.',
            components: []
        });
    }
}

async function handleBanUserSelect(interaction, userId) {
    try {
        const channel = interaction.member.voice.channel;
        if (!channel) {
            return interaction.update({ content: '<:Warning:1393752109119176755> Du bist nicht mehr in einem Voice-Kanal.', components: [] });
        }

        const isOwner = await isChannelOwner(channel.id, interaction.member.id);
        if (!isOwner) {
            return interaction.update({ content: '<:Deny:1393752012054728784> Nur der Kanal-Besitzer kann Benutzer bannen.', components: [] });
        }

        const userToBan = interaction.guild.members.cache.get(userId);
        if (!userToBan) {
            return interaction.update({ content: '<:Warning:1393752109119176755> Benutzer nicht gefunden.', components: [] });
        }

        const { TempChannel } = require('../database/models/Voicemaster');
        const tempChannel = await TempChannel.findOne({ channelId: channel.id });
        if (tempChannel && userId === tempChannel.ownerId) {
            return interaction.update({ content: '<:Deny:1393752012054728784> Du kannst den Kanal-Besitzer nicht bannen.', components: [] });
        }

        const existingBan = await VoiceBan.findOne({
            channelId: channel.id,
            userId: userId
        });

        if (existingBan) {
            return interaction.update({
                content: `<:Warning:1393752109119176755> ${userToBan.displayName} ist bereits von diesem Kanal gebannt.`,
                components: []
            });
        }

        await VoiceBan.create({
            channelId: channel.id,
            userId: userId
        });

        await channel.permissionOverwrites.edit(userId, {
            Connect: false
        });

        if (channel.members.has(userId)) {
            await userToBan.voice.disconnect();
        }

        const isAdmin = userToBan.permissions.has(PermissionFlagsBits.Administrator);
        const adminWarning = isAdmin ? '\nHinweis: Dieser Benutzer hat Administrator-Berechtigungen und wird automatisch gekickt wenn er erneut beitritt.' : '';

        await interaction.update({
            content: `<:Check:1393751996267368478> ${userToBan.displayName} wurde vom Voice-Kanal gebannt und kann nicht mehr beitreten.${adminWarning}`,
            components: []
        });

    } catch (error) {
        console.error('Error banning user:', error);
        await interaction.update({
            content: '<:Warning:1393752109119176755> Fehler beim Bannen des Benutzers. Bitte versuche es erneut.',
            components: []
        });
    }
}

async function handleRenameModal(interaction) {
    const newName = interaction.fields.getTextInputValue('channel_name');
    
    if (!interaction.member.voice.channelId) {
        return interaction.reply({ content: '<:Warning:1393752109119176755> Du musst in einem Voice-Kanal sein.', ephemeral: true });
    }

    const isOwner = await isChannelOwner(interaction.member.voice.channelId, interaction.member.id);
    if (!isOwner) {
        return interaction.reply({ content: '<:Deny:1393752012054728784> Nur der Kanal-Besitzer kann den Kanal umbenennen.', ephemeral: true });
    }

    try {
        await interaction.member.voice.channel.setName(newName);
        await interaction.reply({ content: `<:Check:1393751996267368478> Kanal zu "${newName}" umbenannt`, ephemeral: true });
    } catch (error) {
        await interaction.reply({ content: '<:Warning:1393752109119176755> Kanal konnte nicht umbenannt werden', ephemeral: true });
    }
}

async function handleUserLimitModal(interaction) {
    const userLimit = interaction.fields.getTextInputValue('user_limit');
    const member = interaction.member;
    
    if (!member.voice.channelId) {
        return interaction.reply({ content: '<:Warning:1393752109119176755> Du musst in einem Voice-Kanal sein um das zu verwenden.', ephemeral: true });
    }

    const isOwner = await isChannelOwner(member.voice.channelId, member.id);
    if (!isOwner) {
        return interaction.reply({ content: '<:Deny:1393752012054728784> Nur der Kanal-Besitzer kann Benutzer-Limits setzen.', ephemeral: true });
    }

    const limit = parseInt(userLimit);
    if (isNaN(limit) || limit < 0 || limit > 99) {
        return interaction.reply({ 
            content: '<:Warning:1393752109119176755> Ungültiges Benutzer-Limit. Bitte gib eine Zahl zwischen 1-99 ein oder 0 für unbegrenzt.', 
            ephemeral: true 
        });
    }

    try {
        const channel = member.voice.channel;
        await channel.setUserLimit(limit);
        
        const limitText = limit === 0 ? 'unbegrenzt' : limit.toString();
        await interaction.reply({ 
            content: `<:Check:1393751996267368478> Benutzer-Limit auf ${limitText} gesetzt`, 
            ephemeral: true 
        });
    } catch (error) {
        console.error('Error setting user limit:', error);
        await interaction.reply({ 
            content: '<:Warning:1393752109119176755> Benutzer-Limit konnte nicht gesetzt werden. Bitte versuche es erneut.', 
            ephemeral: true 
        });
    }
}

async function handlePermitModal(interaction) {
    const userString = interaction.fields.getTextInputValue('user_id');
    
    if (!interaction.member.voice.channelId) {
        return interaction.reply({ content: '<:Warning:1393752109119176755> Du musst in einem Voice-Kanal sein.', ephemeral: true });
    }

    const isOwner = await isChannelOwner(interaction.member.voice.channelId, interaction.member.id);
    if (!isOwner) {
        return interaction.reply({ content: '<:Deny:1393752012054728784> Nur der Kanal-Besitzer kann Benutzer berechtigen.', ephemeral: true });
    }

    try {
        const user = await getUserFromString(interaction.guild, userString);
        if (!user) {
            return interaction.reply({ content: '<:Warning:1393752109119176755> Benutzer nicht gefunden.', ephemeral: true });
        }

        const { TempChannel, VoicePermit, VoiceBan } = require('../database/models/Voicemaster');
        const tempChannel = await TempChannel.findOne({ channelId: interaction.member.voice.channelId });
        if (tempChannel && user.id === tempChannel.ownerId) {
            return interaction.reply({ content: '<:Warning:1393752109119176755> Der Kanal-Besitzer muss nicht berechtigt werden.', ephemeral: true });
        }

        const ban = await VoiceBan.findOne({
            channelId: interaction.member.voice.channelId,
            userId: user.id
        });

        if (ban) {
            await VoiceBan.deleteOne({
                channelId: interaction.member.voice.channelId,
                userId: user.id
            });
        }

        await VoicePermit.findOneAndUpdate(
            { channelId: interaction.member.voice.channelId, userId: user.id },
            { channelId: interaction.member.voice.channelId, userId: user.id },
            { upsert: true, new: true }
        );
        
        await interaction.member.voice.channel.permissionOverwrites.edit(user.id, {
            Connect: true,
            ViewChannel: true
        });

        await interaction.reply({ content: `<:Check:1393751996267368478> ${user.user.tag} berechtigt beizutreten auch wenn Kanal gesperrt ist`, ephemeral: true });
    } catch (error) {
        await interaction.reply({ content: '<:Warning:1393752109119176755> Benutzer konnte nicht berechtigt werden', ephemeral: true });
    }
}

async function handleBanModal(interaction) {
    const userString = interaction.fields.getTextInputValue('user_id');
    
    if (!interaction.member.voice.channelId) {
        return interaction.reply({ content: '<:Warning:1393752109119176755> Du musst in einem Voice-Kanal sein.', ephemeral: true });
    }

    const isOwner = await isChannelOwner(interaction.member.voice.channelId, interaction.member.id);
    if (!isOwner) {
        return interaction.reply({ content: '<:Deny:1393752012054728784> Nur der Kanal-Besitzer kann Benutzer bannen.', ephemeral: true });
    }

    try {
        const user = await getUserFromString(interaction.guild, userString);
        if (!user) {
            return interaction.reply({ content: '<:Warning:1393752109119176755> Benutzer nicht gefunden.', ephemeral: true });
        }

        const { TempChannel } = require('../database/models/Voicemaster');
        const tempChannel = await TempChannel.findOne({ channelId: interaction.member.voice.channelId });
        if (tempChannel && user.id === tempChannel.ownerId) {
            return interaction.reply({ content: '<:Deny:1393752012054728784> Du kannst den Kanal-Besitzer nicht bannen.', ephemeral: true });
        }

        await addBan(interaction.member.voice.channelId, user.id);
        
        await interaction.member.voice.channel.permissionOverwrites.edit(user.id, {
            Connect: false
        });
        
        if (user.voice.channelId === interaction.member.voice.channelId) {
            await user.voice.disconnect();
        }

        await interaction.reply({ content: `<:Check:1393751996267368478> ${user.user.tag} vom Kanal gebannt und kann nicht mehr beitreten`, ephemeral: true });
    } catch (error) {
        await interaction.reply({ content: '<:Warning:1393752109119176755> Benutzer konnte nicht gebannt werden', ephemeral: true });
    }
}

async function handleKickModal(interaction) {
    const userString = interaction.fields.getTextInputValue('user_id');
    
    if (!interaction.member.voice.channelId) {
        return interaction.reply({ content: '<:Warning:1393752109119176755> Du musst in einem Voice-Kanal sein.', ephemeral: true });
    }

    const isOwner = await isChannelOwner(interaction.member.voice.channelId, interaction.member.id);
    if (!isOwner) {
        return interaction.reply({ content: '<:Deny:1393752012054728784> Nur der Kanal-Besitzer kann Benutzer kicken.', ephemeral: true });
    }

    try {
        const user = await getUserFromString(interaction.guild, userString);
        if (!user) {
            return interaction.reply({ content: '<:Warning:1393752109119176755> Benutzer nicht gefunden.', ephemeral: true });
        }

        const { TempChannel } = require('../database/models/Voicemaster');
        const tempChannel = await TempChannel.findOne({ channelId: interaction.member.voice.channelId });
        if (tempChannel && user.id === tempChannel.ownerId) {
            return interaction.reply({ content: '<:Deny:1393752012054728784> Du kannst den Kanal-Besitzer nicht kicken.', ephemeral: true });
        }

        if (user.voice.channelId === interaction.member.voice.channelId) {
            await user.voice.disconnect();
            await interaction.reply({ content: `<:Check:1393751996267368478> ${user.user.tag} aus dem Kanal gekickt`, ephemeral: true });
        } else {
            await interaction.reply({ content: '<:Warning:1393752109119176755> Benutzer ist nicht in diesem Kanal.', ephemeral: true });
        }
    } catch (error) {
        await interaction.reply({ content: '<:Warning:1393752109119176755> Benutzer konnte nicht gekickt werden', ephemeral: true });
    }
}

async function handleGreetingButton(interaction) {
    try {
        const channelId = interaction.customId.replace('greeting_button_', '');
        const targetChannel = interaction.guild.channels.cache.get(channelId);

        if (!targetChannel) {
            return interaction.reply({
                content: '<:Warning:1393752109119176755> Der Kanal ist nicht mehr verfügbar.',
                flags: MessageFlags.Ephemeral
            });
        }

        if (targetChannel.type === 2) {
            const channelUrl = `https://discord.com/channels/${interaction.guild.id}/${channelId}`;
            
            await interaction.reply({
                content: `<:Mic:1393752063707578460> ${targetChannel.name} beitreten: ${channelUrl}`,
                flags: MessageFlags.Ephemeral
            });
        } else {
            await interaction.reply({
                content: `<:Check:1393751996267368478> Schau dir ${targetChannel} an!`,
                flags: MessageFlags.Ephemeral
            });
        }

        console.log(`${interaction.user.tag} hat Begrüßungs-Button für ${targetChannel.name} geklickt`);

    } catch (error) {
        console.error('Error handling greeting button:', error);
        
        if (!interaction.replied) {
            await interaction.reply({
                content: '<:Warning:1393752109119176755> Ein Fehler ist aufgetreten.',
                flags: MessageFlags.Ephemeral
            });
        }
    }
}

async function handleHelpBack(interaction) {
    const Guild = require('../database/models/Guild');
    
    let guild = await Guild.findOne({ guildId: interaction.guild.id });
    const prefix = guild?.prefix || '!';
    
    const { buildMainHelp } = require('../commands/general/help');
    const { embed, components } = buildMainHelp(interaction.client, interaction.guild, prefix);
    
    await interaction.update({ embeds: [embed], components });
}

async function handleHelpCategorySelect(interaction) {
    const selectedValue = interaction.values[0];
    const Guild = require('../database/models/Guild');
    
    let guild = await Guild.findOne({ guildId: interaction.guild.id });
    const prefix = guild?.prefix || '!';
    
    const commandsPath = path.join(__dirname, '../commands');
    const categoryPath = path.join(commandsPath, selectedValue);
    
    let commandFiles = [];
    try {
        if (fs.existsSync(categoryPath)) {
            commandFiles = fs.readdirSync(categoryPath).filter(file => file.endsWith('.js'));
        }
    } catch (error) {
        console.log(`Fehler beim Lesen der Kategorie ${selectedValue}:`, error.message);
    }
    
    const categoryTitle = selectedValue.charAt(0).toUpperCase() + selectedValue.slice(1);
    const embed = createEmbed('default', `${categoryTitle} Befehle`, '');
    
    if (interaction.guild.iconURL()) {
        embed.setThumbnail(interaction.guild.iconURL({ dynamic: true, size: 256 }));
    }
    
    if (commandFiles.length === 0) {
        embed.setDescription('Keine Befehle für diese Kategorie.');
    } else {
        const commands = [];
        for (const file of commandFiles) {
            const commandName = file.replace('.js', '');
            const command = interaction.client.commands.get(commandName);
            
            if (command && command.name) {
                const aliases = command.aliases && command.aliases.length > 0 
                    ? ` (${command.aliases.join(', ')})` 
                    : '';
                commands.push(`\`${prefix}${command.name}\`${aliases}\n${command.description || 'Keine Beschreibung'}`);
            }
        }
        
        if (commands.length > 0) {
            embed.setDescription(commands.join('\n\n'));
        } else {
            embed.setDescription('Keine Befehle für diese Kategorie.');
        }
    }
    
    embed.addFields({
        name: 'Verwendung',
        value: `Verwende \`${prefix}help <befehl>\` für detaillierte Informationen über einen spezifischen Befehl.`,
        inline: false
    });
    
    const backButton = new ButtonBuilder()
        .setCustomId('help_back')
        .setLabel('Zurück')
        .setStyle(ButtonStyle.Secondary);
    
    const row = new ActionRowBuilder().addComponents(backButton);
    
    await interaction.update({ embeds: [embed], components: [row] });
}

async function handleResetConfirmation(interaction) {
    const [, , action, target] = interaction.customId.split('_');
    
    pendingResets.set(interaction.user.id, {
        action,
        target,
        channelId: interaction.channel.id,
        messageId: interaction.message.id
    });

    await interaction.update({
        embeds: [createEmbed('default', 'Schreibe BESTÄTIGEN', `Bitte schreibe \`BESTÄTIGEN\` in diesem Kanal um mit dem ${action} Reset fortzufahren.\n\nDiese Bestätigung läuft in 30 Sekunden ab.`)],
        components: []
    });

    setTimeout(() => {
        if (pendingResets.has(interaction.user.id)) {
            pendingResets.delete(interaction.user.id);
        }
    }, 30000);
}

module.exports.pendingResets = pendingResets;