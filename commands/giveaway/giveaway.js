const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const Giveaway = require('../../database/models/Giveaway');
const { parseDuration, scheduleGiveaway } = require('../../utils/giveawayUtils');

module.exports = {
    name: 'giveaway',
    aliases: ['gw', 'create-giveaway'],
    description: 'Erstelle ein professionelles Giveaway',
    usage: 'giveaway',
    
    async executePrefix(message, args, client) {
        const { guild, member, channel } = message;
        
        if (!member.permissions.has('ManageMessages')) {
            const errorMsg = await message.reply('<:Warning:1393752109119176755> Du benötigst die Berechtigung "Nachrichten verwalten" um Giveaways zu erstellen.');
            setTimeout(() => {
                message.delete().catch(() => {});
                errorMsg.delete().catch(() => {});
            }, 5000);
            return;
        }
        
        message.delete().catch(() => {});
        
        const embed = new EmbedBuilder()
            .setTitle('<:Settings:1393752089884102677> Giveaway Einrichtung')
            .setDescription('Klicke auf den Button unten, um ein neues Giveaway mit optionalen Anforderungen zu erstellen.')
            .addFields([
                { name: 'Verfügbare Anforderungen', value: '• Discord Status Text\n• Voice-Chat Zeit\n• Nachrichten Anzahl\n• Muss im Voice sein', inline: true },
                { name: 'Funktionen', value: '• Automatische Gewinner Auswahl\n• Echtzeit Teilnahme Verfolgung\n• Anforderungen Validierung\n• Status Überwachung alle 5s', inline: true }
            ])
            .setColor(0x2f3136)
            .setTimestamp();
        
        const setupRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('gsetup_start')
                    .setLabel('Giveaway Erstellen')
                    .setStyle(ButtonStyle.Primary)
            );
        
        const setupMessage = await channel.send({ embeds: [embed], components: [setupRow] });
        
        setTimeout(() => setupMessage.delete().catch(() => {}), 15000);
    }
};

async function handleSetupInteraction(interaction) {
    try {
        const customId = interaction.customId;
        
        if (customId === 'gsetup_start') {
            const modal = new ModalBuilder()
                .setCustomId('giveaway_create_modal')
                .setTitle('Giveaway Erstellen');
            
            const prizeInput = new TextInputBuilder()
                .setCustomId('prize')
                .setLabel('Preis')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Discord Nitro, 50€ Geschenkkarte, Gaming Setup, etc.')
                .setRequired(true)
                .setMaxLength(100);
            
            const durationInput = new TextInputBuilder()
                .setCustomId('duration')
                .setLabel('Dauer')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Beispiele: 30m, 2h, 1d, 1w')
                .setRequired(true)
                .setMaxLength(10);
            
            const winnersInput = new TextInputBuilder()
                .setCustomId('winners')
                .setLabel('Anzahl der Gewinner')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('1')
                .setRequired(true)
                .setMaxLength(3);
            
            const descriptionInput = new TextInputBuilder()
                .setCustomId('description')
                .setLabel('Beschreibung (Optional)')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Spezielle Anweisungen, Regeln oder Details zum Preis...')
                .setRequired(false)
                .setMaxLength(500);
            
            const requirementsInput = new TextInputBuilder()
                .setCustomId('requirements_setup')
                .setLabel('Anforderungen (Optional)')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('status:SERVER BOOSTER | vctime:30 | messages:100 | mustbeinvc:true\n(Leer = keine Anforderungen)')
                .setRequired(false)
                .setMaxLength(300);
            
            const row1 = new ActionRowBuilder().addComponents(prizeInput);
            const row2 = new ActionRowBuilder().addComponents(durationInput);
            const row3 = new ActionRowBuilder().addComponents(winnersInput);
            const row4 = new ActionRowBuilder().addComponents(descriptionInput);
            const row5 = new ActionRowBuilder().addComponents(requirementsInput);
            
            modal.addComponents(row1, row2, row3, row4, row5);
            
            await interaction.showModal(modal);
        }
        
        if (customId === 'giveaway_create_modal') {
            await handleGiveawayCreation(interaction);
        }
        
        if (customId === 'giveaway_requirements_modal') {
            await handleRequirementsModal(interaction);
        }
        
    } catch (error) {
        console.error('Setup interaction error:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '<:Warning:1393752109119176755> Ein Fehler ist während der Einrichtung aufgetreten.', flags: 64 }).catch(() => {});
        }
    }
}

async function handleGiveawayCreation(interaction) {
    try {
        if (!interaction.isModalSubmit()) return;
        
        const prize = interaction.fields.getTextInputValue('prize');
        const durationStr = interaction.fields.getTextInputValue('duration');
        const winnersStr = interaction.fields.getTextInputValue('winners');
        const description = interaction.fields.getTextInputValue('description') || '';
        const requirementsStr = interaction.fields.getTextInputValue('requirements_setup') || '';
        
        const duration = parseDuration(durationStr);
        if (!duration) {
            return interaction.reply({ content: '<:Warning:1393752109119176755> Ungültiges Dauerformat. Verwende: 30m, 2h, 1d, 1w', flags: 64 }).catch(() => {});
        }
        
        const winners = parseInt(winnersStr);
        if (isNaN(winners) || winners < 1 || winners > 20) {
            return interaction.reply({ content: '<:Warning:1393752109119176755> Gewinner Anzahl muss zwischen 1 und 20 liegen.', flags: 64 }).catch(() => {});
        }
        
        let requirements = {
            statusCheck: false,
            statusText: null,
            vcTime: null,
            messageCount: null,
            mustBeInVC: false
        };
        
        if (requirementsStr.trim()) {
            const parts = requirementsStr.split('|').map(p => p.trim());
            
            for (const part of parts) {
                const [key, value] = part.split(':').map(s => s.trim());
                
                switch (key.toLowerCase()) {
                    case 'status':
                        requirements.statusCheck = true;
                        requirements.statusText = value;
                        break;
                    case 'vctime':
                        const time = parseInt(value);
                        if (!isNaN(time) && time > 0) requirements.vcTime = time;
                        break;
                    case 'messages':
                        const count = parseInt(value);
                        if (!isNaN(count) && count > 0) requirements.messageCount = count;
                        break;
                    case 'mustbeinvc':
                        requirements.mustBeInVC = value.toLowerCase() === 'true';
                        break;
                }
            }
        }
        
        await createGiveaway(interaction, { prize, duration, winners, description, requirements });
        
    } catch (error) {
        console.error('Giveaway creation error:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '<:Warning:1393752109119176755> Giveaway konnte nicht erstellt werden. Bitte versuche es erneut.', flags: 64 }).catch(() => {});
        }
    }
}

async function createGiveaway(interaction, data) {
    try {
        const { prize, duration, winners, description, requirements } = data;
        
        const targetChannel = interaction.channel;
        
        const endTime = new Date(Date.now() + duration);
        
        let embedDescription = `**Preis:** ${prize}\n\n`;
        if (description) {
            embedDescription += `${description}\n\n`;
        }
        embedDescription += 'Klicke 🎉 um an diesem Giveaway teilzunehmen!';
        
        const giveawayEmbed = new EmbedBuilder()
            .setTitle('🎉 Giveaway')
            .setDescription(embedDescription)
            .addFields([
                { name: '<:User:1393752101687136269> Veranstaltet von', value: `<@${interaction.user.id}>`, inline: true },
                { name: 'Gewinner', value: winners.toString(), inline: true },
                { name: 'Endet', value: `<t:${Math.floor(endTime.getTime() / 1000)}:R>`, inline: true }
            ])
            .setColor(0x2f3136)
            .setTimestamp(endTime);
        
        if (hasRequirements(requirements)) {
            let reqText = '';
            if (requirements.statusCheck) {
                reqText += `• Status: ${requirements.statusText}\n`;
            }
            if (requirements.vcTime) {
                reqText += `• <:Mic:1393752063707578460> Voice Zeit: ${requirements.vcTime} Minuten\n`;
            }
            if (requirements.messageCount) {
                reqText += `• Nachrichten: ${requirements.messageCount}\n`;
            }
            if (requirements.mustBeInVC) {
                reqText += `• <:Mic:1393752063707578460> Muss im Voice-Chat sein\n`;
            }
            
            giveawayEmbed.addFields([
                { name: '<:Settings:1393752089884102677> Anforderungen', value: reqText, inline: false }
            ]);
        }
        
        const giveawayMessage = await targetChannel.send({ embeds: [giveawayEmbed] });
        
        const giveaway = new Giveaway({
            guildId: interaction.guild.id,
            channelId: targetChannel.id,
            messageId: giveawayMessage.id,
            hostId: interaction.user.id,
            title: prize,
            description: description,
            prize: prize,
            winners: winners,
            endTime,
            requirements: requirements,
            entries: [],
            trackingData: []
        });
        
        await giveaway.save();
        
        const updatedEmbed = new EmbedBuilder()
            .setTitle('🎉 Giveaway')
            .setDescription(embedDescription)
            .addFields([
                { name: '<:User:1393752101687136269> Veranstaltet von', value: `<@${interaction.user.id}>`, inline: true },
                { name: 'Gewinner', value: winners.toString(), inline: true },
                { name: 'Endet', value: `<t:${Math.floor(endTime.getTime() / 1000)}:R>`, inline: true }
            ])
            .setColor(0x2f3136)
            .setFooter({ text: `Giveaway ID: ${giveaway._id}` })
            .setTimestamp(endTime);
        
        if (hasRequirements(requirements)) {
            let reqText = '';
            if (requirements.statusCheck) {
                reqText += `• Status: ${requirements.statusText}\n`;
            }
            if (requirements.vcTime) {
                reqText += `• <:Mic:1393752063707578460> Voice Zeit: ${requirements.vcTime} Minuten\n`;
            }
            if (requirements.messageCount) {
                reqText += `• Nachrichten: ${requirements.messageCount}\n`;
            }
            if (requirements.mustBeInVC) {
                reqText += `• <:Mic:1393752063707578460> Muss im Voice-Chat sein\n`;
            }
            
            updatedEmbed.addFields([
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
                .setLabel('0')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true)
        ];
        
        if (hasRequirements(requirements)) {
            buttons.push(
                new ButtonBuilder()
                    .setCustomId('giveaway_requirements')
                    .setLabel('Anforderungen')
                    .setStyle(ButtonStyle.Secondary)
            );
        }
        
        const giveawayRow = new ActionRowBuilder().addComponents(buttons);
        
        await giveawayMessage.edit({ embeds: [updatedEmbed], components: [giveawayRow] });
        
        try {
            await giveawayMessage.pin();
            
            const messages = await targetChannel.messages.fetch({ limit: 5 });
            const pinMessage = messages.find(msg => 
                msg.type === 6 &&
                msg.reference?.messageId === giveawayMessage.id
            );
            if (pinMessage) {
                await pinMessage.delete();
            }
        } catch (error) {
            console.log('Could not pin giveaway message or delete pin notification:', error.message);
        }
        
        scheduleGiveaway(interaction.client, giveaway._id, duration);
        
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ 
                content: `<:Check:1393751996267368478> Giveaway erfolgreich erstellt! Viel Glück an alle Teilnehmer!`, 
                flags: 64
            }).catch(() => {});
            
            setTimeout(() => {
                interaction.deleteReply().catch(() => {});
            }, 10000);
        }
        
        console.log(`Giveaway erstellt: ${prize} mit ${Object.keys(requirements).filter(k => requirements[k]).length} Anforderungen`);
        
    } catch (error) {
        console.error('Create giveaway error:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '<:Warning:1393752109119176755> Giveaway konnte nicht erstellt werden. Bitte versuche es erneut.', flags: 64 }).catch(() => {});
        }
    }
}

function hasRequirements(requirements) {
    if (!requirements) return false;
    return requirements.statusCheck || requirements.vcTime || requirements.messageCount || requirements.mustBeInVC;
}

module.exports.handleSetupInteraction = handleSetupInteraction;