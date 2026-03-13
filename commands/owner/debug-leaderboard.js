const { EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

const emojis = {
    check: '<:Check:1393751996267368478>',
    deny: '<:Deny:1393752012054728784>',
    settings: '<:Settings:1393752089884102677>',
    warning: '<:Warning:1393752109119176755>'
};

module.exports = {
    name: 'debug-leaderboard',
    description: 'Debug information for leaderboard system',
    usage: '!debug-leaderboard [force-refresh|restart]',
    aliases: ['debug-lb'],
    category: 'utility',
    
    async executePrefix(message, args) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply({
                embeds: [createEmbed('error', `${emojis.deny} Keine Berechtigung`, 'Du benötigst Administrator-Berechtigungen.')]
            });
        }

        const leaderboardManager = message.client.leaderboardManager;
        
        if (!leaderboardManager) {
            return message.reply({
                embeds: [createEmbed('error', `${emojis.warning} Manager Nicht Gefunden`, 'LeaderboardManager ist nicht initialisiert.')]
            });
        }

        if (args[0] === 'force-refresh') {
            const success = await leaderboardManager.forceRefresh(message.guild.id);
            return message.reply({
                embeds: [createEmbed(
                    success ? 'success' : 'error',
                    success ? `${emojis.check} Aktualisierung Erzwungen` : `${emojis.warning} Fehler`,
                    success ? 'Leaderboard wurde manuell aktualisiert.' : 'Konnte Leaderboard nicht aktualisieren.'
                )]
            });
        }

        if (args[0] === 'restart') {
            await leaderboardManager.updateGuildConfig(message.guild.id);
            return message.reply({
                embeds: [createEmbed('success', `${emojis.check} Auto-Refresh Neugestartet`, 'LeaderboardManager Auto-Refresh wurde für diesen Server neu gestartet.')]
            });
        }

        const status = leaderboardManager.getStatus();
        
        const embed = new EmbedBuilder()
            .setTitle(`${emojis.settings} Leaderboard Manager Debug`)
            .setColor('#2f3136')
            .addFields(
                {
                    name: 'Manager Status',
                    value: status.isInitialized ? `${emojis.check} Initialisiert` : `${emojis.deny} Nicht Initialisiert`,
                    inline: true
                },
                {
                    name: 'Aktive Auto-Refresh',
                    value: status.activeRefreshes.toString(),
                    inline: true
                },
                {
                    name: 'Dieser Server',
                    value: status.guilds.includes(message.guild.id) ? `${emojis.check} Auto-Refresh Aktiv` : `${emojis.warning} Nicht Aktiv`,
                    inline: true
                },
                {
                    name: 'Guilds mit Auto-Refresh',
                    value: status.guilds.length > 0 ? status.guilds.join(', ') : 'Keine',
                    inline: false
                },
                {
                    name: 'Befehle',
                    value: [
                        '`!debug-leaderboard force-refresh` - Manuelle Aktualisierung',
                        '`!debug-leaderboard restart` - Auto-Refresh neu starten'
                    ].join('\n'),
                    inline: false
                }
            )
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    }
};

function createEmbed(type, title, description) {
    const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor('#2f3136')
        .setTimestamp();
    
    return embed;
}