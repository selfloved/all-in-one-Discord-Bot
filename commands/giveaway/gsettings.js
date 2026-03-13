const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const Giveaway = require('../../database/models/Giveaway');
const { endGiveaway } = require('../../utils/giveawayUtils');

module.exports = {
    name: 'gsettings',
    aliases: ['giveaway-settings', 'gmanage'],
    description: 'Giveaway Einstellungen verwalten',
    usage: 'gsettings',
    
    async executePrefix(message, args, client) {
        const { guild, member, channel } = message;
        
        if (!member.permissions.has('ManageMessages')) {
            const errorMsg = await message.reply('<:Warning:1393752109119176755> Du benötigst die Berechtigung "Nachrichten verwalten".');
            setTimeout(() => {
                message.delete().catch(() => {});
                errorMsg.delete().catch(() => {});
            }, 5000);
            return;
        }
        
        message.delete().catch(() => {});
        
        try {
            const activeGiveaways = await Giveaway.find({ 
                guildId: guild.id, 
                ended: false 
            }).limit(25);
            
            if (activeGiveaways.length === 0) {
                const errorMsg = await message.channel.send('<:Warning:1393752109119176755> Keine aktiven Giveaways auf diesem Server gefunden.');
                setTimeout(() => errorMsg.delete().catch(() => {}), 5000);
                return;
            }
            
            const options = activeGiveaways.map(giveaway => ({
                label: giveaway.prize,
                description: `${giveaway.entries ? giveaway.entries.length : 0} Teilnahmen • Endet in ${Math.floor((giveaway.endTime - Date.now()) / 3600000)}h`,
                value: giveaway._id.toString()
            }));
            
            const selectMenu = new ActionRowBuilder()
                .addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('gsettings_giveaway_select')
                        .setPlaceholder('Wähle ein Giveaway zum Verwalten...')
                        .addOptions(options)
                );
            
            const embed = new EmbedBuilder()
                .setTitle('<:Settings:1393752089884102677> Giveaway Verwaltung')
                .setDescription(`**Aktive Giveaways:** ${activeGiveaways.length}\n\nWähle ein Giveaway aus, um dessen Einstellungen zu verwalten.`)
                .setColor(0x2f3136)
                .setTimestamp();
            
            const settingsMessage = await message.channel.send({ embeds: [embed], components: [selectMenu] });
            
            setTimeout(() => settingsMessage.delete().catch(() => {}), 300000);
            
        } catch (error) {
            console.error('Gsettings command error:', error);
            const errorMsg = await message.channel.send('<:Warning:1393752109119176755> Ein Fehler ist aufgetreten.');
            setTimeout(() => errorMsg.delete().catch(() => {}), 5000);
        }
    }
};

async function handleGsettingsSelection(interaction) {
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
        
        if (giveaway.ended) {
            return interaction.update({ 
                content: '<:Warning:1393752109119176755> Giveaway ist bereits beendet!', 
                embeds: [], 
                components: [] 
            });
        }
        
        const actionMenu = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`gsettings_action_${giveawayId}`)
                    .setPlaceholder('Wähle eine Aktion...')
                    .addOptions([
                        {
                            label: 'Sofort Beenden',
                            description: 'Beende das Giveaway jetzt und wähle Gewinner',
                            value: 'end'
                        },
                        {
                            label: 'Giveaway Abbrechen',
                            description: 'Breche das Giveaway ab ohne Gewinner zu wählen',
                            value: 'cancel'
                        },
                        {
                            label: 'Informationen Anzeigen',
                            description: 'Zeige detaillierte Giveaway Informationen',
                            value: 'info'
                        }
                    ])
            );
        
        const embed = new EmbedBuilder()
            .setTitle('<:Settings:1393752089884102677> Giveaway Verwalten')
            .setDescription(`**Giveaway:** ${giveaway.prize}\n**Teilnehmer:** ${giveaway.entries ? giveaway.entries.length : 0}\n**Endet:** <t:${Math.floor(giveaway.endTime.getTime() / 1000)}:R>\n\nWähle eine Aktion:`)
            .setColor(0x2f3136)
            .setTimestamp();
        
        await interaction.update({ embeds: [embed], components: [actionMenu] });
        
    } catch (error) {
        console.error('Gsettings selection error:', error);
        await interaction.update({ 
            content: '<:Warning:1393752109119176755> Ein Fehler ist aufgetreten!', 
            embeds: [], 
            components: [] 
        });
    }
}

async function handleGsettingsAction(interaction) {
    try {
        const [, , giveawayId] = interaction.customId.split('_');
        const action = interaction.values[0];
        
        const giveaway = await Giveaway.findById(giveawayId);
        
        if (!giveaway) {
            return interaction.update({ 
                content: '<:Deny:1393752012054728784> Giveaway nicht gefunden!', 
                embeds: [], 
                components: [] 
            });
        }
        
        switch (action) {
            case 'end':
                await endGiveaway(interaction.client, giveawayId);
                await interaction.update({ 
                    content: `<:Check:1393751996267368478> Giveaway "${giveaway.prize}" wurde beendet!`, 
                    embeds: [], 
                    components: [] 
                });
                break;
                
            case 'cancel':
                giveaway.ended = true;
                await giveaway.save();
                
                try {
                    const guild = interaction.client.guilds.cache.get(giveaway.guildId);
                    const channel = guild?.channels.cache.get(giveaway.channelId);
                    const message = await channel?.messages.fetch(giveaway.messageId);
                    
                    if (message) {
                        const cancelledEmbed = new EmbedBuilder()
                            .setTitle('<:Deny:1393752012054728784> Giveaway Abgebrochen')
                            .setDescription(`**Preis:** ${giveaway.prize}\n\nDieses Giveaway wurde vom Veranstalter abgebrochen.`)
                            .addFields([
                                { name: '<:User:1393752101687136269> Veranstaltet von', value: `<@${giveaway.hostId}>`, inline: true },
                                { name: 'Gesamte Teilnahmen', value: `${giveaway.entries ? giveaway.entries.length : 0}`, inline: true },
                                { name: 'Abgebrochen', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
                            ])
                            .setColor(0x2f3136)
                            .setFooter({ text: `Giveaway ID: ${giveaway._id}` })
                            .setTimestamp();
                        
                        await message.edit({ embeds: [cancelledEmbed], components: [] });
                    }
                } catch (error) {
                    console.error('Error updating cancelled giveaway:', error);
                }
                
                await interaction.update({ 
                    content: `<:Check:1393751996267368478> Giveaway "${giveaway.prize}" wurde abgebrochen!`, 
                    embeds: [], 
                    components: [] 
                });
                break;
                
            case 'info':
                const infoEmbed = new EmbedBuilder()
                    .setTitle('<:EyeOpen:1393752027107954748> Giveaway Details')
                    .setDescription(`**Preis:** ${giveaway.prize}\n**Beschreibung:** ${giveaway.description || 'Keine'}\n**<:User:1393752101687136269> Veranstalter:** <@${giveaway.hostId}>\n**Gewinner:** ${giveaway.winners}\n**Teilnehmer:** ${giveaway.entries ? giveaway.entries.length : 0}\n**Erstellt:** <t:${Math.floor(giveaway.createdAt.getTime() / 1000)}:R>\n**Endet:** <t:${Math.floor(giveaway.endTime.getTime() / 1000)}:R>\n**ID:** \`${giveaway._id}\``)
                    .setColor(0x2f3136)
                    .setTimestamp();
                
                await interaction.update({ embeds: [infoEmbed], components: [] });
                break;
        }
        
    } catch (error) {
        console.error('Gsettings action error:', error);
        await interaction.update({ 
            content: '<:Warning:1393752109119176755> Ein Fehler ist aufgetreten!', 
            embeds: [], 
            components: [] 
        });
    }
}

module.exports.handleGsettingsSelection = handleGsettingsSelection;
module.exports.handleGsettingsAction = handleGsettingsAction;