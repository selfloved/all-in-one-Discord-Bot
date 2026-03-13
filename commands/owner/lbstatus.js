const { EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const Guild = require('../../database/models/Guild');
const MonthlyStats = require('../../database/models/MonthlyStats');
const monthlyTracker = require('../../utils/monthlyTracker');

const emojis = {
    settings: '<:Settings:1393752089884102677>',
    check: '<:Check:1393751996267368478>',
    warning: '<:Warning:1393752109119176755>',
    claim: '<:Claim:1393752141423706143>',
    user: '<:User:1393752101687136269>',
    mic: '<:Mic:1393752063707578460>'
};

module.exports = {
    name: 'lbstatus',
    description: 'Zeige den aktuellen Leaderboard-Status',
    usage: '!lbstatus',
    aliases: ['leaderboardstatus', 'lbinfo'],
    category: 'admin',
    
    async executePrefix(message, args) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply({
                embeds: [createErrorEmbed('Du benötigst Administrator-Berechtigungen um diesen Befehl zu verwenden!')]
            });
        }

        try {
            const guild = await Guild.findOne({ guildId: message.guild.id });
            if (!guild) {
                return message.reply({
                    embeds: [createErrorEmbed('Server nicht in der Datenbank gefunden!')]
                });
            }

            const currentMonth = monthlyTracker.getCurrentMonth();
            const monthName = formatMonthName(currentMonth);

            const totalUsers = await MonthlyStats.countDocuments({
                guildId: message.guild.id,
                month: currentMonth
            });

            const totalMessages = await MonthlyStats.aggregate([
                { $match: { guildId: message.guild.id, month: currentMonth } },
                { $group: { _id: null, total: { $sum: '$messageCount' } } }
            ]);

            const totalVcTime = await MonthlyStats.aggregate([
                { $match: { guildId: message.guild.id, month: currentMonth } },
                { $group: { _id: null, total: { $sum: '$vcTimeMinutes' } } }
            ]);

            const totalMessagesCount = totalMessages.length > 0 ? totalMessages[0].total : 0;
            const totalVcMinutes = totalVcTime.length > 0 ? totalVcTime[0].total : 0;
            const totalVcHours = Math.floor(totalVcMinutes / 60);
            const remainingMinutes = totalVcMinutes % 60;

            const embed = new EmbedBuilder()
                .setTitle(`Leaderboard Status`)
                .setDescription(`**Server:** ${message.guild.name}\n**Monat:** ${monthName}`)
                .setTimestamp();

            let statusText = '';
            if (guild.leaderboard && guild.leaderboard.enabled) {
                statusText = `${emojis.check} **Aktiviert**`;
                
                const channel = message.guild.channels.cache.get(guild.leaderboard.channelId);
                if (channel) {
                    statusText += `\n**Kanal:** ${channel}`;
                } else {
                    statusText += `\n**Kanal:** ⚠️ Nicht gefunden`;
                }
                
                statusText += `\n**Auto-Refresh:** ${guild.leaderboard.autoRefresh ? 'Aktiviert' : 'Deaktiviert'}`;
                statusText += `\n**Refresh-Intervall:** ${guild.leaderboard.refreshInterval || 3} Minuten`;
                statusText += `\n**Anzeige:** Top ${guild.leaderboard.showTop || 5} pro Kategorie`;
                
                if (guild.leaderboard.lastRefresh) {
                    const lastRefresh = Math.floor(guild.leaderboard.lastRefresh.getTime() / 1000);
                    statusText += `\n**Letzte Aktualisierung:** <t:${lastRefresh}:R>`;
                }
            } else {
                statusText = `${emojis.warning} **Deaktiviert**\n\nVerwende \`!leaderboard setup\` um es zu aktivieren.`;
            }

            embed.addFields({
                name: `${emojis.claim} Status`,
                value: statusText,
                inline: false
            });

            embed.addFields(
                {
                    name: `Aktive Benutzer`,
                    value: `**${totalUsers}** Benutzer mit Aktivität`,
                    inline: true
                },
                {
                    name: 'Nachrichten Gesamt',
                    value: `**${totalMessagesCount.toLocaleString()}** Nachrichten`,
                    inline: true
                },
                {
                    name: `Voice Zeit Gesamt`,
                    value: `**${totalVcHours}h ${remainingMinutes}m**`,
                    inline: true
                }
            );

            let rewardsText = '';
            if (guild.leaderboard && guild.leaderboard.messageRewards && guild.leaderboard.messageRewards.enabled) {
                const firstRole = message.guild.roles.cache.get(guild.leaderboard.messageRewards.firstPlaceRole);
                const secondRole = message.guild.roles.cache.get(guild.leaderboard.messageRewards.secondPlaceRole);
                const thirdRole = message.guild.roles.cache.get(guild.leaderboard.messageRewards.thirdPlaceRole);
                
                rewardsText += `**Nachrichten Belohnungen:** ${emojis.check}\n`;
                rewardsText += `${emojis.check} **1. Platz:** ${firstRole ? firstRole.name : 'Rolle nicht gefunden'}\n`;
                rewardsText += `${emojis.check} **2. Platz:** ${secondRole ? secondRole.name : 'Rolle nicht gefunden'}\n`;
                rewardsText += `${emojis.check} **3. Platz:** ${thirdRole ? thirdRole.name : 'Rolle nicht gefunden'}\n\n`;
            }
            
            if (guild.leaderboard && guild.leaderboard.vcRewards && guild.leaderboard.vcRewards.enabled) {
                const firstRole = message.guild.roles.cache.get(guild.leaderboard.vcRewards.firstPlaceRole);
                const secondRole = message.guild.roles.cache.get(guild.leaderboard.vcRewards.secondPlaceRole);
                const thirdRole = message.guild.roles.cache.get(guild.leaderboard.vcRewards.thirdPlaceRole);
                
                rewardsText += `**Voice Belohnungen:** ${emojis.check}\n`;
                rewardsText += `${emojis.check} **1. Platz:** ${firstRole ? firstRole.name : 'Rolle nicht gefunden'}\n`;
                rewardsText += `${emojis.check} **2. Platz:** ${secondRole ? secondRole.name : 'Rolle nicht gefunden'}\n`;
                rewardsText += `${emojis.check} **3. Platz:** ${thirdRole ? thirdRole.name : 'Rolle nicht gefunden'}`;
            }

            if (!rewardsText) {
                rewardsText = `${emojis.warning} **Keine Belohnungen konfiguriert**\n\nVerwende \`!leaderboard setup\` um Belohnungen einzurichten.`;
            }

            if (rewardsText) {
                embed.addFields({
                    name: 'Belohnungen',
                    value: rewardsText,
                    inline: false
                });
            }

            const statusMsg = await message.reply({ embeds: [embed] });
            setTimeout(() => statusMsg.delete().catch(() => {}), 60000);

        } catch (error) {
            console.error('Error getting leaderboard status:', error);
            message.reply({
                embeds: [createErrorEmbed('Ein Fehler ist beim Abrufen des Leaderboard-Status aufgetreten!')]
            });
        }
    }
};

function formatMonthName(monthString) {
    const [year, month] = monthString.split('-');
    const monthNames = [
        'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
        'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
    ];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
}

function createErrorEmbed(message) {
    return new EmbedBuilder()
        .setTitle(`${emojis.warning} Fehler`)
        .setDescription(message)
        .setColor('#ff0000')
        .setTimestamp();
}