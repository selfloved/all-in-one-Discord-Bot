const { Events, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ChannelSelectMenuBuilder, ChannelType, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Giveaway = require('../database/models/Giveaway');
const VCTime = require('../database/models/VCTime');
const MessageCount = require('../database/models/MessageCount');
const Guild = require('../database/models/Guild');

const { handleSetupInteraction } = require('../commands/giveaway/giveaway');
const { handleHelpInteraction } = require('../commands/giveaway/ghelp');
const { handleRigSelection } = require('../commands/giveaway/secretRig');
const { handleGsettingsSelection, handleGsettingsAction } = require('../commands/giveaway/gsettings');
const { createEmbed } = require('../utils/embedBuilder');

async function checkRequirements(member, requirements) {
    const issues = [];
    
    try {
        if (requirements.statusCheck && requirements.statusText) {
            const presence = member.presence;
            const hasStatus = presence?.activities?.some(activity => 
                activity.type === 4 && activity.state?.includes(requirements.statusText)
            );
            if (!hasStatus) {
                issues.push(`Erforderlicher Status Text "${requirements.statusText}" nicht in deinem Discord Status gefunden`);
            }
        }
        
        if (requirements.vcTime && requirements.vcTime > 0) {
            const vcData = await VCTime.findOne({ 
                userId: member.id, 
                guildId: member.guild.id 
            });
            
            let currentTime = 0;
            
            if (vcData?.currentSession?.startTime) {
                currentTime = Math.floor((new Date() - vcData.currentSession.startTime) / 60000);
            }
            
            if (currentTime < requirements.vcTime) {
                issues.push(`<:Mic:1393752063707578460> Voice Zeit Anforderung: ${currentTime}/${requirements.vcTime} Minuten (nur aktuelle Sitzung)`);
            }
        }
        
        if (requirements.messageCount && requirements.messageCount > 0) {
            const messageData = await MessageCount.findOne({
                userId: member.id,
                guildId: member.guild.id
            });
            
            const userMessages = messageData?.messageCount || 0;
            
            if (userMessages < requirements.messageCount) {
                issues.push(`Nachrichten Anzahl Anforderung: ${userMessages}/${requirements.messageCount} Nachrichten`);
            }
        }
        
        return issues;
    } catch (error) {
        console.error('Error checking requirements:', error);
        return ['<:Warning:1393752109119176755> Ein Fehler ist beim Überprüfen der Anforderungen aufgetreten. Bitte versuche es erneut.'];
    }
}

async function updateGiveawayEmbed(giveaway, message) {
    try {
        const entryCount = giveaway.entries ? giveaway.entries.length : 0;
        
        const embed = new EmbedBuilder()
            .setTitle(giveaway.prize)
            .setDescription(giveaway.description || 'Klicke auf den Party Button um an diesem Giveaway teilzunehmen!')
            .addFields([
                { name: '<:User:1393752101687136269> Veranstaltet von', value: `<@${giveaway.hostId}>`, inline: true },
                { name: 'Gewinner', value: giveaway.winners.toString(), inline: true },
                { name: 'Endet', value: `<t:${Math.floor(giveaway.endTime.getTime() / 1000)}:R>`, inline: true }
            ])
            .setColor(0x2f3136)
            .setFooter({ text: `ID: ${giveaway._id} • ${entryCount}` })
            .setTimestamp(giveaway.endTime);
        
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

function hasRequirements(requirements) {
    if (!requirements) return false;
    return requirements.statusCheck || requirements.vcTime || requirements.messageCount;
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
            });
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
            });
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

            await interaction.showModal(modal);
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

            await interaction.reply({ embeds: [embed], flags: 64 });
            break;
    }
}

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        try {
            const giveawayInteractions = [
                'gsetup_', 'giveaway_', 'help_', 'rig_', 'gsettings_', 'massdm_'
            ];
            
            if (giveawayInteractions.some(prefix => interaction.customId?.startsWith(prefix))) {
                return;
            }
            
            if (interaction.isButton()) {
                const customId = interaction.customId;
                
                if (customId.startsWith('setup_')) {
                    await handleSetupButtons(interaction);
                    return;
                }
            }
            
            if (interaction.isModalSubmit()) {
                if (interaction.customId === 'prefix_modal') {
                    const newPrefix = interaction.fields.getTextInputValue('prefix_input');
                    await Guild.findOneAndUpdate(
                        { guildId: interaction.guild.id },
                        { prefix: newPrefix }
                    );
                    await interaction.reply({
                        embeds: [createEmbed('success', '<:Check:1393751996267368478> Prefix Aktualisiert', `Server Prefix zu \`${newPrefix}\` geändert`)],
                        flags: 64
                    });
                }
            }
            
            if (interaction.isChannelSelectMenu()) {
                if (interaction.customId === 'welcome_channel_select') {
                    const channelId = interaction.values[0];
                    await Guild.findOneAndUpdate(
                        { guildId: interaction.guild.id },
                        { welcomeChannel: channelId, 'settings.welcomeEnabled': true }
                    );
                    await interaction.update({
                        embeds: [createEmbed('success', '<:Check:1393751996267368478> Willkommens-Kanal Gesetzt', `Willkommens-Kanal auf <#${channelId}> gesetzt`)],
                        components: []
                    });
                }
                
                if (interaction.customId === 'log_channel_select') {
                    const channelId = interaction.values[0];
                    await Guild.findOneAndUpdate(
                        { guildId: interaction.guild.id },
                        { logChannel: channelId, 'settings.loggingEnabled': true }
                    );
                    await interaction.update({
                        embeds: [createEmbed('success', '<:Check:1393751996267368478> Log-Kanal Gesetzt', `Log-Kanal auf <#${channelId}> gesetzt`)],
                        components: []
                    });
                }
            }
            
        } catch (error) {
            console.error('Error in ButtonInteraction handler:', error);
            
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ 
                        content: '<:Warning:1393752109119176755> Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es erneut.', 
                        ephemeral: true 
                    });
                }
            } catch (responseError) {
                console.error('Failed to send error response:', responseError);
            }
        }
    },
};

async function handleMassDMSelection(interaction) {
    try {
        const giveawayId = interaction.values[0];
        const giveaway = await Giveaway.findById(giveawayId);
        
        if (!giveaway) {
            return interaction.update({ 
                content: '<:Deny:1393752012054728784> Giveaway nicht gefunden!', 
                embeds: [], 
                components: [] 
            });
        }
        
        const guild = interaction.guild;
        
        await guild.members.fetch();
        const membersWithStatus = guild.members.cache.filter(member => 
            !member.user.bot && 
            member.presence?.activities?.some(activity => activity.type === 4)
        );
        
        if (membersWithStatus.size === 0) {
            return interaction.update({
                content: '<:Warning:1393752109119176755> Keine Mitglieder mit benutzerdefiniertem Status gefunden!',
                embeds: [],
                components: []
            });
        }
        
        const embed = new EmbedBuilder()
            .setTitle('<:Settings:1393752089884102677> Massen-DM Fortschritt')
            .setDescription(`**Giveaway:** ${giveaway.prize}\n**Ziel:** ${membersWithStatus.size} Mitglieder mit Status\n\nStarte Massen-DM...`)
            .setColor(0x2f3136)
            .setTimestamp();
        
        await interaction.update({ embeds: [embed], components: [] });
        
        let sent = 0;
        let failed = 0;
        const startTime = Date.now();
        
        for (const [, member] of membersWithStatus) {
            try {
                const dmEmbed = new EmbedBuilder()
                    .setTitle('🎉 Giveaway Gestartet')
                    .setDescription(`**Preis:** ${giveaway.prize}\n**Gewinner:** ${giveaway.winners}\n**Endet:** <t:${Math.floor(giveaway.endTime.getTime() / 1000)}:R>\n\n[Nimm hier am Giveaway teil](https://discord.com/channels/${guild.id}/${giveaway.channelId}/${giveaway.messageId})`)
                    .setColor(0x2f3136)
                    .setTimestamp();
                
                await member.send({ embeds: [dmEmbed] });
                sent++;
            } catch (error) {
                failed++;
            }
            
            if ((sent + failed) % 10 === 0) {
                const elapsed = Math.floor((Date.now() - startTime) / 1000);
                const progressEmbed = new EmbedBuilder()
                    .setTitle('<:Settings:1393752089884102677> Massen-DM Fortschritt')
                    .setDescription(`**Giveaway:** ${giveaway.prize}\n**Fortschritt:** ${sent + failed}/${membersWithStatus.size}\n**Gesendet:** ${sent}\n**Fehlgeschlagen:** ${failed}\n**Zeit:** ${elapsed}s`)
                    .setColor(0x2f3136)
                    .setTimestamp();
                
                await interaction.editReply({ embeds: [progressEmbed] });
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        const totalTime = Math.floor((Date.now() - startTime) / 1000);
        const finalEmbed = new EmbedBuilder()
            .setTitle('<:Check:1393751996267368478> Massen-DM Abgeschlossen')
            .setDescription(`**Giveaway:** ${giveaway.prize}\n**Gesamt:** ${membersWithStatus.size} Mitglieder\n**Gesendet:** ${sent}\n**Fehlgeschlagen:** ${failed}\n**Zeit:** ${totalTime}s`)
            .setColor(0x2f3136)
            .setTimestamp();
        
        await interaction.editReply({ embeds: [finalEmbed] });
        
    } catch (error) {
        console.error('Mass DM error:', error);
        await interaction.editReply({ 
            content: '<:Warning:1393752109119176755> Ein Fehler ist während der Massen-DM aufgetreten!', 
            embeds: [], 
            components: [] 
        });
    }
}

module.exports.handleMassDMSelection = handleMassDMSelection;