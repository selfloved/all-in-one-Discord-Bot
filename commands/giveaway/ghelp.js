const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    name: 'ghelp',
    aliases: ['ghelp', 'gcommands', 'giveawayhelp'],
    description: 'Show all available giveaway commands',
    usage: 'ghelp',
    
    async executePrefix(message, args, client) {
        message.delete().catch(() => {});
        
        if (!message || !message.author || !client || !client.user) {
            console.error('Missing required objects in ghelp command');
            return;
        }
        
        const embed = new EmbedBuilder()
            .setTitle('Giveaway Befehle')
            .setDescription('Giveaway Verwaltungssystem')
            .setColor(0x2f3136)
            .setTimestamp()
            .addFields([
                {
                    name: 'Befehle',
                    value: '`!giveaway` - Neues Giveaway erstellen\n`!reroll <id>` - Giveaway neu auslosen\n`!massdm` - Mass DM Werbung (Nur Besitzer)',
                    inline: false
                },
                {
                    name: 'Statistiken', 
                    value: '`!vctime [@user]` - Voice-Session-Zeit prüfen\n`!messages [@user]` - Nachrichten-Anzahl prüfen',
                    inline: false
                }
            ])
            .setFooter({ 
                text: `Angefragt von ${message.author.displayName}`, 
                iconURL: message.author.displayAvatarURL() 
            });
        
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('help_examples')
                    .setLabel('Beispiele')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('help_features')
                    .setLabel('Features')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('help_close')
                    .setLabel('Schließen')
                    .setStyle(ButtonStyle.Danger)
            );
        
        const helpMessage = await message.channel.send({ embeds: [embed], components: [row] });
        
        setTimeout(() => {
            helpMessage.delete().catch(() => {});
        }, 300000);
    }
};

async function handleHelpInteraction(interaction) {
    try {
        if (!interaction || !interaction.customId) {
            console.error('Invalid interaction object in handleHelpInteraction');
            return;
        }

        const customId = interaction.customId;
        
        switch (customId) {
            case 'help_examples':
                const exampleEmbed = new EmbedBuilder()
                    .setTitle('Befehl-Beispiele')
                    .setColor(0x2f3136)
                    .addFields([
                        {
                            name: 'Giveaways Erstellen',
                            value: '`!giveaway` - Öffnet Modal-Setup\n• Preis, Dauer und Gewinner eingeben\n• Optionale Beschreibung\n• Sauberes Modal-Interface',
                            inline: false
                        },
                        {
                            name: 'Giveaways Verwalten',
                            value: '`!reroll 507f1f77bcf86cd799439011` - Neu auslosen mit Giveaway-ID\n`!massdm` - Giveaway zum Bewerben auswählen',
                            inline: false
                        },
                        {
                            name: 'Statistiken Prüfen',
                            value: '`!vctime` - Deine Voice-Session prüfen\n`!messages @user` - Nachrichten-Anzahl prüfen',
                            inline: false
                        }
                    ])
                    .setTimestamp();
                
                await interaction.update({ embeds: [exampleEmbed] });
                break;
                
            case 'help_features':
                const featureEmbed = new EmbedBuilder()
                    .setTitle('System-Features')
                    .setColor(0x2f3136)
                    .addFields([
                        {
                            name: 'Sauberes Interface',
                            value: 'Modal-basiertes Setup ohne Chat-Unordnung. Button-basiertes Teilnahmesystem mit Live-Zählern.',
                            inline: false
                        },
                        {
                            name: 'Teilnahme-Validierung',
                            value: 'Status-Verifizierung, Voice-Aktivitäts-Tracking, Nachrichten-Anzahl-Anforderungen.',
                            inline: false
                        },
                        {
                            name: 'Zuverlässigkeit',
                            value: 'MongoDB-Persistierung, automatische Wiederherstellung, Giveaway-ID-System für Neuauslosungen.',
                            inline: false
                        }
                    ])
                    .setTimestamp();
                
                await interaction.update({ embeds: [featureEmbed] });
                break;
                
            case 'help_close':
                await interaction.update({ 
                    content: 'Hilfe geschlossen. Verwende `!ghelp` zum Wiedereröffnen.', 
                    embeds: [], 
                    components: [] 
                });
                setTimeout(() => interaction.deleteReply().catch(() => {}), 3000);
                break;
                
            default:
                console.error('Unknown customId in handleHelpInteraction:', customId);
                break;
        }
    } catch (error) {
        console.error('Error in handleHelpInteraction:', error);
        
        try {
            if (interaction && !interaction.replied && !interaction.deferred) {
                await interaction.reply({ 
                    content: 'Ein Fehler ist bei der Hilfe-Interaktion aufgetreten.', 
                    flags: 64
                });
            }
        } catch (fallbackError) {
            console.error('Failed to send fallback response:', fallbackError);
        }
    }
}

module.exports.handleHelpInteraction = handleHelpInteraction;