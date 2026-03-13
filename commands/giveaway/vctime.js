const { EmbedBuilder } = require('discord.js');
const VCTime = require('../../database/models/VCTime');

module.exports = {
    name: 'vctime',
    aliases: ['voice-time', 'vt'],
    description: 'Überprüfe deine oder jemand anders aktuelle Voice-Chat Sitzungszeit',
    usage: 'vctime [@user]',
    
    async executePrefix(message, args, client) {
        const { guild } = message;
        
        message.delete().catch(() => {});
        
        let targetUser = message.author;
        
        if (message.mentions.users.size > 0) {
            targetUser = message.mentions.users.first();
        } else if (args[0]) {
            try {
                const user = await client.users.fetch(args[0]);
                if (user) targetUser = user;
            } catch (error) {
            }
        }
        
        try {
            const vcData = await VCTime.findOne({ userId: targetUser.id, guildId: guild.id });
            
            let currentSessionMinutes = 0;
            let channelName = 'Nicht im Voice';
            
            if (vcData?.currentSession?.startTime) {
                currentSessionMinutes = Math.floor((new Date() - vcData.currentSession.startTime) / 60000);
                const channel = guild.channels.cache.get(vcData.currentSession.channelId);
                channelName = channel ? channel.name : 'Unbekannter Kanal';
            }
            
            const hours = Math.floor(currentSessionMinutes / 60);
            const minutes = currentSessionMinutes % 60;
            
            let timeString = '';
            if (hours > 0) {
                timeString = `${hours}h ${minutes}m`;
            } else {
                timeString = `${minutes}m`;
            }
            
            const embed = new EmbedBuilder()
                .setTitle('<:Mic:1393752063707578460> Voice-Chat Zeit (Aktuelle Sitzung)')
                .setDescription(`**<:User:1393752101687136269> Benutzer:** ${targetUser}\n**Aktuelle Sitzung:** ${timeString}\n**Status:** ${channelName}`)
                .setColor(0x2f3136)
                .setThumbnail(targetUser.displayAvatarURL())
                .setTimestamp();
            
            const resultMsg = await message.channel.send({ embeds: [embed] });
            
            setTimeout(() => resultMsg.delete().catch(() => {}), 30000);
            
        } catch (error) {
            console.error('VCTime error:', error);
            const errorMsg = await message.channel.send('<:Warning:1393752109119176755> Ein Fehler ist beim Abrufen der Voice-Chat Zeit aufgetreten!');
            setTimeout(() => errorMsg.delete().catch(() => {}), 5000);
        }
    }
};