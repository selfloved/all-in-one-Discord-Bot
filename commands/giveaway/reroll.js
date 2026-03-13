const { EmbedBuilder } = require('discord.js');
const { rerollGiveaway } = require('../../utils/giveawayUtils');

module.exports = {
    name: 'reroll',
    aliases: ['reroll-giveaway'],
    description: 'Giveaway mit ID neu auslosen',
    usage: 'reroll <giveaway_id>',
    
    async executePrefix(message, args, client) {
        const { guild, member, channel } = message;
        
        if (!member.permissions.has('ManageMessages')) {
            const errorMsg = await message.reply('Du benötigst die Berechtigung "Nachrichten verwalten" um Giveaways neu auszulosen.');
            setTimeout(() => {
                message.delete().catch(() => {});
                errorMsg.delete().catch(() => {});
            }, 5000);
            return;
        }
        
        message.delete().catch(() => {});
        
        if (!args[0]) {
            const errorMsg = await message.channel.send('Bitte gib eine Giveaway-ID an. Verwendung: `!reroll <giveaway_id>`');
            setTimeout(() => errorMsg.delete().catch(() => {}), 5000);
            return;
        }
        
        const giveawayId = args[0];
        
        try {
            const result = await rerollGiveaway(client, giveawayId, guild.id);
            
            if (result.success) {
                const successEmbed = new EmbedBuilder()
                    .setTitle('<:Check:1393751996267368478> Giveaway erfolgreich neu ausgelost')
                    .setDescription(`**Neue Gewinner:** ${result.winners.length}\n${result.winners.map(id => `<@${id}>`).join('\n')}`)
                    .setColor(0x2f3136)
                    .setTimestamp();
                
                const resultMsg = await message.channel.send({ embeds: [successEmbed] });
                setTimeout(() => resultMsg.delete().catch(() => {}), 30000);
            } else {
                const errorMsg = await message.channel.send(`<:Deny:1393752012054728784> ${result.message}`);
                setTimeout(() => errorMsg.delete().catch(() => {}), 5000);
            }
            
        } catch (error) {
            console.error('Reroll command error:', error);
            const errorMsg = await message.channel.send('<:Warning:1393752109119176755> Ein Fehler ist beim Neuauslosen des Giveaways aufgetreten.');
            setTimeout(() => errorMsg.delete().catch(() => {}), 5000);
        }
    }
};