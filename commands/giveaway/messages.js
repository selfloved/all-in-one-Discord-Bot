const { EmbedBuilder } = require('discord.js');
const MessageCount = require('../../database/models/MessageCount');

module.exports = {
    name: 'messages',
    aliases: ['msg', 'message-count', 'mc'],
    description: 'Check your or someone\'s message count',
    usage: 'messages [@user]',
    
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
            const messageData = await MessageCount.findOne({ 
                userId: targetUser.id, 
                guildId: guild.id 
            });
            
            const messageCount = messageData?.messageCount || 0;
            const lastMessage = messageData?.lastMessageTime;
            
            const embed = new EmbedBuilder()
                .setTitle('Message Count')
                .setDescription(`**User:** ${targetUser}\n**Messages:** ${messageCount.toLocaleString()}`)
                .setColor(0x9b59b6)
                .setThumbnail(targetUser.displayAvatarURL())
                .setTimestamp();
            
            if (lastMessage) {
                embed.addFields([
                    { name: 'Last Message', value: `<t:${Math.floor(lastMessage.getTime() / 1000)}:R>`, inline: true }
                ]);
            }
            
            let activityLevel = '';
            let progress = '';
            if (messageCount >= 10000) {
                activityLevel = 'Chat Legend';
                progress = '▓▓▓▓▓▓▓▓▓▓ MAX';
            } else if (messageCount >= 5000) {
                activityLevel = 'Super Active';
                const prog = Math.floor((messageCount - 5000) / 500);
                progress = '▓'.repeat(prog) + '░'.repeat(10 - prog) + ` ${messageCount}/10000`;
            } else if (messageCount >= 1000) {
                activityLevel = 'Very Active';
                const prog = Math.floor((messageCount - 1000) / 400);
                progress = '▓'.repeat(prog) + '░'.repeat(10 - prog) + ` ${messageCount}/5000`;
            } else if (messageCount >= 500) {
                activityLevel = 'Active';
                const prog = Math.floor((messageCount - 500) / 50);
                progress = '▓'.repeat(prog) + '░'.repeat(10 - prog) + ` ${messageCount}/1000`;
            } else if (messageCount >= 100) {
                activityLevel = 'Getting Started';
                const prog = Math.floor((messageCount - 100) / 40);
                progress = '▓'.repeat(prog) + '░'.repeat(10 - prog) + ` ${messageCount}/500`;
            } else {
                activityLevel = 'New Member';
                const prog = Math.floor(messageCount / 10);
                progress = '▓'.repeat(prog) + '░'.repeat(10 - prog) + ` ${messageCount}/100`;
            }
            
            embed.addFields([
                { name: 'Status', value: activityLevel, inline: true },
                { name: 'Progress', value: `\`${progress}\``, inline: false }
            ]);
            
            const resultMsg = await message.channel.send({ embeds: [embed] });
            
            setTimeout(() => resultMsg.delete().catch(() => {}), 30000);
            
        } catch (error) {
            console.error('Messages command error:', error);
            const errorMsg = await message.channel.send('An error occurred while fetching message count!');
            setTimeout(() => errorMsg.delete().catch(() => {}), 5000);
        }
    }
};