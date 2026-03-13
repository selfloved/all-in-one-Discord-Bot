const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const Guild = require('../../database/models/Guild');

const emojis = {
    check: '<:Check:1393751996267368478>',
    deny: '<:Deny:1393752012054728784>',
    settings: '<:Settings:1393752089884102677>',
    warning: '<:Warning:1393752109119176755>'
};

module.exports = {
    name: 'leaderboard-limit',
    description: 'Ändere wie viele Benutzer auf der Rangliste angezeigt werden',
    usage: '!leaderboard-limit [number]',
    aliases: ['lb-limit', 'leaderboard-size'],
    category: 'utility',
    
    async executePrefix(message, args) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply({
                embeds: [createEmbed('error', `${emojis.deny} Keine Berechtigung`, 'Du benötigst Administrator-Berechtigungen.')]
            });
        }

        try {
            let guild = await Guild.findOne({ guildId: message.guild.id });
            
            if (!guild) {
                return message.reply({
                    embeds: [createEmbed('error', `${emojis.warning} Server Nicht Gefunden`, 'Server nicht in der Datenbank gefunden.')]
                });
            }

            if (!guild.leaderboard) {
                return message.reply({
                    embeds: [createEmbed('error', `${emojis.warning} Leaderboard Nicht Konfiguriert`, 'Verwende `!leaderboard setup` um die Rangliste zuerst zu konfigurieren.')]
                });
            }

            if (!args[0]) {
                const currentLimit = guild.leaderboard.showTop || 5;
                return message.reply({
                    embeds: [createEmbed('info', `${emojis.settings} Aktuelle Einstellung`, `Die Rangliste zeigt derzeit **Top ${currentLimit}** Benutzer pro Kategorie an.\n\nVerwende \`!leaderboard-limit <zahl>\` um dies zu ändern.\n**Erlaubt:** 3-15 Benutzer`)]
                });
            }

            const newLimit = parseInt(args[0]);
            
            if (isNaN(newLimit) || newLimit < 3 || newLimit > 15) {
                return message.reply({
                    embeds: [createEmbed('error', `${emojis.warning} Ungültige Zahl`, 'Bitte gib eine Zahl zwischen 3 und 15 ein.')]
                });
            }

            await Guild.findOneAndUpdate(
                { guildId: message.guild.id },
                { $set: { 'leaderboard.showTop': newLimit } }
            );

            await message.reply({
                embeds: [createEmbed('success', `${emojis.check} Limit Aktualisiert`, `Die Rangliste zeigt nun **Top ${newLimit}** Benutzer pro Kategorie an.`)]
            });

            if (message.client.leaderboardManager) {
                await message.client.leaderboardManager.forceRefresh(message.guild.id);
            }

        } catch (error) {
            console.error('Error setting leaderboard limit:', error);
            await message.reply({
                embeds: [createEmbed('error', `${emojis.warning} Fehler`, 'Konnte das Limit nicht ändern.')]
            });
        }
    }
};

function createEmbed(type, title, description) {
    let color = '#2f3136';
    if (type === 'success') color = '#57F287';
    else if (type === 'error') color = '#ED4245';
    else if (type === 'info') color = '#5865F2';
    
    const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(color)
        .setTimestamp();
    
    return embed;
}