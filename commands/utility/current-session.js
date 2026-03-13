const { EmbedBuilder } = require('discord.js');
const monthlyTracker = require('../../utils/monthlyTracker');

const emojis = {
    user: '<:User:1393752101687136269>',
    mic: '<:Mic:1393752063707578460>',
    warning: '<:Warning:1393752109119176755>',
    check: '<:Check:1393751996267368478>'
};

module.exports = {
    name: 'current-session',
    description: 'Zeige deine aktuelle Voice-Session',
    usage: '!current-session [@user]',
    aliases: ['session', 'currentsession', 'vc-session'],
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
            const currentSession = await monthlyTracker.getCurrentVcSession(
                targetUser.id,
                message.guild.id
            );
            
            const embed = new EmbedBuilder()
                .setTitle(`Voice Session`)
                .setDescription(`**Benutzer:** ${targetUser}`)
                .setTimestamp();
            
            if (currentSession.isInVc) {
                const channel = message.guild.channels.cache.get(currentSession.channelId);
                const channelName = channel ? channel.name : 'Unbekannter Kanal';
                const memberCount = channel ? channel.members.size : 0;
                
                embed.addFields(
                    {
                        name: `Aktuell im Voice Chat`,
                        value: `**${channelName}**`,
                        inline: true
                    },
                    {
                        name: 'Session Dauer',
                        value: `**${currentSession.currentSessionMinutes}** Minuten`,
                        inline: true
                    },
                    {
                        name: 'Mitglieder im Kanal',
                        value: `**${memberCount}** Mitglied${memberCount === 1 ? '' : 'er'}`,
                        inline: true
                    }
                );
                
                if (channel && channel.members.size > 1) {
                    const otherMembers = channel.members
                        .filter(member => member.id !== targetUser.id)
                        .map(member => member.displayName)
                        .slice(0, 10);
                    
                    if (otherMembers.length > 0) {
                        embed.addFields({
                            name: 'Andere Mitglieder',
                            value: otherMembers.join(', ') + (channel.members.size > 11 ? ` und ${channel.members.size - 11} weitere...` : ''),
                            inline: false
                        });
                    }
                }
                
                embed.setColor('#57F287');
                
                const joinTime = Math.floor((Date.now() - (currentSession.currentSessionMinutes * 60000)) / 1000);
                embed.addFields({
                    name: 'Beigetreten',
                    value: `<t:${joinTime}:R>`,
                    inline: true
                });
                
            } else {
                embed.addFields({
                    name: `Nicht im Voice Chat`,
                    value: 'Derzeit in keinem Voice-Kanal',
                    inline: false
                });
            }
            
            const stats = await monthlyTracker.getMonthlyStats(targetUser.id, message.guild.id);
            embed.addFields({
                name: 'Monatliche Voice Zeit',
                value: `**${stats.vcTimeMinutes}** Minuten (inkl. aktuelle Session)`,
                inline: true
            });
            
            const resultMsg = await message.reply({ embeds: [embed] });
            setTimeout(() => resultMsg.delete().catch(() => {}), 30000);
            
        } catch (error) {
            console.error('Current session error:', error);
            const errorMsg = await message.reply({
                embeds: [createErrorEmbed('Ein Fehler ist beim Abrufen der Session-Informationen aufgetreten!')]
            });
            setTimeout(() => errorMsg.delete().catch(() => {}), 5000);
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