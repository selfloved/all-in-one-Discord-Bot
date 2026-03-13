const { EmbedBuilder } = require('discord.js');
const monthlyTracker = require('../../utils/monthlyTracker');

const emojis = {
    user: '<:User:1393752101687136269>',
    mic: '<:Mic:1393752063707578460>',
    claim: '<:Claim:1393752141423706143>',
    warning: '<:Warning:1393752109119176755>'
};

module.exports = {
    name: 'monthly',
    description: 'Zeige deine monatlichen Statistiken',
    usage: '!monthly [@user]',
    aliases: ['monatlich', 'stats', 'mystats'],
    category: 'utility',
    
    async executePrefix(message, args) {
        let targetUser = message.author;
        
        if (message.mentions.users.size > 0) {
            targetUser = message.mentions.users.first();
        } else if (args[0]) {
            try {
                const user = await message.client.users.fetch(args[0]);
                if (user) targetUser = user;
            } catch (error) {
            }
        }
        
        try {
            const stats = await monthlyTracker.getMonthlyStats(
                targetUser.id,
                message.guild.id
            );
            
            const currentMonth = monthlyTracker.getCurrentMonth();
            const monthName = formatMonthName(currentMonth);
            
            const embed = new EmbedBuilder()
                .setTitle(`Monatliche Statistiken`)
                .setDescription(`**Benutzer:** ${targetUser}\n**Monat:** ${monthName}`)
                .addFields(
                    {
                        name: 'Nachrichten',
                        value: `**${stats.messageCount.toLocaleString()}** Nachrichten`,
                        inline: true
                    },
                    {
                        name: 'Voice Zeit',
                        value: `**${stats.vcTimeMinutes}** Minuten`,
                        inline: true
                    },
                    {
                        name: 'Aktivität',
                        value: getActivityLevel(stats.messageCount, stats.vcTimeMinutes),
                        inline: true
                    }
                )
                .setTimestamp();
            
            if (stats.currentSession && stats.currentSession.isInVc) {
                const channel = message.guild.channels.cache.get(stats.currentSession.channelId);
                const channelName = channel ? channel.name : 'Unbekannter Kanal';
                
                embed.addFields({
                    name: 'Aktuelle Session',
                    value: `**${stats.currentSession.currentSessionMinutes}** Min in **${channelName}**`,
                    inline: false
                });
            }
            
            const messageRank = await getUserRank(targetUser.id, message.guild.id, 'messages');
            const voiceRank = await getUserRank(targetUser.id, message.guild.id, 'voice');
            
            let rankingText = '';
            if (messageRank > 0) {
                rankingText += `**Nachrichten Rang:** #${messageRank}\n`;
            }
            if (voiceRank > 0) {
                rankingText += `**Voice Rang:** #${voiceRank}`;
            }
            
            if (rankingText) {
                embed.addFields({
                    name: 'Rangliste Position',
                    value: rankingText,
                    inline: false
                });
            }
            
            const resultMsg = await message.reply({ embeds: [embed] });
            
            setTimeout(() => resultMsg.delete().catch(() => {}), 30000);
            
        } catch (error) {
            console.error('Monthly stats error:', error);
            const errorMsg = await message.reply({
                embeds: [createErrorEmbed('Ein Fehler ist beim Abrufen der monatlichen Statistiken aufgetreten!')]
            });
            setTimeout(() => errorMsg.delete().catch(() => {}), 5000);
        }
    }
};

async function getUserRank(userId, guildId, type) {
    try {
        const topUsers = await monthlyTracker.getTopUsers(guildId, type, 100);
        const userIndex = topUsers.findIndex(user => user.userId === userId);
        return userIndex >= 0 ? userIndex + 1 : 0;
    } catch (error) {
        console.error('Error getting user rank:', error);
        return 0;
    }
}

function getActivityLevel(messageCount, vcTimeMinutes) {
    const totalActivity = messageCount + Math.floor(vcTimeMinutes / 10);
    
    if (totalActivity >= 1000) {
        return 'Sehr Aktiv';
    } else if (totalActivity >= 500) {
        return 'Aktiv';
    } else if (totalActivity >= 100) {
        return 'Mäßig Aktiv';
    } else if (totalActivity >= 10) {
        return 'Wenig Aktiv';
    } else {
        return 'Inaktiv';
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

function createErrorEmbed(message) {
    return new EmbedBuilder()
        .setTitle(`${emojis.warning} Fehler`)
        .setDescription(message)
        .setColor('#ff0000')
        .setTimestamp();
}