const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const Guild = require('../../database/models/Guild');

const emojis = {
    check: '<:Check:1393751996267368478>',
    deny: '<:Deny:1393752012054728784>',
    warning: '<:Warning:1393752109119176755>'
};

module.exports = {
    name: 'reward-test',
    description: 'Teste ob das Reward System funktioniert',
    usage: '!reward-test',
    aliases: ['rtest'],
    category: 'utility',
    
    async executePrefix(message, args) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply({
                embeds: [createEmbed('error', `${emojis.deny} Keine Berechtigung`, 'Du benötigst Administrator-Berechtigungen.')]
            });
        }

        try {
            const guild = await Guild.findOne({ guildId: message.guild.id });
            
            if (!guild || !guild.leaderboard) {
                return message.reply({
                    embeds: [createEmbed('error', `${emojis.warning} Keine Konfiguration`, 'Keine Leaderboard-Konfiguration gefunden. Verwende `!leaderboard setup`.')]
                });
            }

            const status = [];
            
            if (guild.leaderboard.messageRewards?.enabled) {
                const msgRoles = guild.leaderboard.messageRewards.roles;
                const totalMsgRoles = (msgRoles?.first?.length || 0) + 
                                     (msgRoles?.second?.length || 0) + 
                                     (msgRoles?.third?.length || 0) + 
                                     (msgRoles?.allTop3?.length || 0);
                status.push(`${emojis.check} **Nachrichten Belohnungen:** Aktiviert (${totalMsgRoles} Rollen)`);
            } else {
                status.push(`${emojis.deny} **Nachrichten Belohnungen:** Deaktiviert`);
            }

            if (guild.leaderboard.vcRewards?.enabled) {
                const vcRoles = guild.leaderboard.vcRewards.roles;
                const totalVcRoles = (vcRoles?.first?.length || 0) + 
                                    (vcRoles?.second?.length || 0) + 
                                    (vcRoles?.third?.length || 0) + 
                                    (vcRoles?.allTop3?.length || 0);
                status.push(`${emojis.check} **Voice Belohnungen:** Aktiviert (${totalVcRoles} Rollen)`);
            } else {
                status.push(`${emojis.deny} **Voice Belohnungen:** Deaktiviert`);
            }

            if (guild.leaderboard.enabled) {
                status.push(`${emojis.check} **Leaderboard System:** Aktiviert`);
            } else {
                status.push(`${emojis.deny} **Leaderboard System:** Deaktiviert`);
            }

            const embed = new EmbedBuilder()
                .setTitle(`${emojis.check} Reward System Test`)
                .setColor('#2f3136')
                .setDescription(`**Test-Ergebnis für ${message.guild.name}:**\n\n${status.join('\n')}`)
                .addFields({
                    name: 'Nächste Schritte:',
                    value: '• `!leaderboard setup` - Konfiguration öffnen\n• `!reward-status` - Detaillierte Konfiguration anzeigen\n• `!test-rewards` - Simuliere Rollenvergabe',
                    inline: false
                })
                .setTimestamp();

            await message.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Error testing reward system:', error);
            await message.reply({
                embeds: [createEmbed('error', `${emojis.warning} Fehler`, 'Fehler beim Testen des Reward Systems.')]
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