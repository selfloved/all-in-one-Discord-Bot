const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const monthlyTracker = require('../../utils/monthlyTracker');

const emojis = {
    warning: '<:Warning:1393752109119176755>',
    check: '<:Check:1393751996267368478>',
    settings: '<:Settings:1393752089884102677>'
};

module.exports = {
    name: 'resetmonthly',
    description: 'Setze die monatlichen Statistiken zurück',
    usage: '!resetmonthly',
    aliases: ['resetstats', 'clearmonthly'],
    category: 'admin',
    
    async executePrefix(message, args) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply({
                embeds: [createErrorEmbed('Du benötigst Administrator-Rechte um diesen Befehl zu verwenden!')]
            });
        }

        if (args[0] !== 'BESTÄTIGEN') {
            const embed = new EmbedBuilder()
                .setTitle(`${emojis.warning} Monatliche Statistiken Zurücksetzen`)
                .setDescription(`**⚠️ WARNUNG:** Dieser Befehl wird alle monatlichen Statistiken für diesen Server unwiderruflich löschen!\n\n**Betroffene Daten:**\n• Nachrichten-Statistiken\n• Voice-Chat-Statistiken\n• Tägliche Aktivitäts-Aufzeichnungen\n• Leaderboard-Daten\n\n**Um fortzufahren, verwende:**\n\`!resetmonthly BESTÄTIGEN\``)
                .setColor('#ff0000')
                .setTimestamp();

            const warningMsg = await message.reply({ embeds: [embed] });
            setTimeout(() => warningMsg.delete().catch(() => {}), 60000);
            return;
        }

        try {
            const loadingEmbed = new EmbedBuilder()
                .setTitle(`${emojis.settings} Setze Monatliche Statistiken Zurück`)
                .setDescription('Bitte warten, während alle monatlichen Statistiken gelöscht werden...')
                .setColor('#ffaa00')
                .setTimestamp();

            const loadingMsg = await message.reply({ embeds: [loadingEmbed] });

            const deletedCount = await monthlyTracker.resetMonthlyStats(message.guild.id);

            const successEmbed = new EmbedBuilder()
                .setTitle(`${emojis.check} Monatliche Statistiken Zurückgesetzt`)
                .setDescription(`**Erfolgreich ${deletedCount} monatliche Statistik-Einträge gelöscht!**\n\nAlle Benutzer beginnen nun mit neuen Statistiken für den aktuellen Monat.`)
                .setColor('#00ff00')
                .addFields(
                    {
                        name: 'Zurückgesetzte Daten',
                        value: '• Nachrichten-Anzahl\n• Voice-Chat-Zeit\n• Tägliche Aktivitäts-Daten\n• Leaderboard-Positionen',
                        inline: false
                    }
                )
                .setTimestamp();

            await loadingMsg.edit({ embeds: [successEmbed] });

            if (message.client.leaderboardManager) {
                setTimeout(async () => {
                    await message.client.leaderboardManager.forceRefresh(message.guild.id);
                    console.log(`🔄 Forced leaderboard refresh after monthly reset for guild ${message.guild.id}`);
                }, 5000);
            }

            console.log(`🔄 Monthly stats reset completed for guild ${message.guild.name} (${message.guild.id}) by ${message.author.tag}`);

        } catch (error) {
            console.error('Error resetting monthly stats:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle(`${emojis.warning} Fehler`)
                .setDescription('Ein Fehler ist beim Zurücksetzen der monatlichen Statistiken aufgetreten!')
                .setColor('#ff0000')
                .setTimestamp();

            await message.reply({ embeds: [errorEmbed] });
        }
    }
};

function createErrorEmbed(message) {
    return new EmbedBuilder()
        .setTitle(`${emojis.warning} Fehler`)
        .setDescription(message)
        .setColor('#ff0000')
        .setTimestamp();
}