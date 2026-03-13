const { EmbedBuilder } = require('discord.js');
const Giveaway = require('../../database/models/Giveaway');

async function handleRigSelection(interaction) {
    try {
        const giveawayId = interaction.values[0];
        const giveaway = await Giveaway.findById(giveawayId);
        
        if (!giveaway || giveaway.ended) {
            return interaction.update({ 
                content: '❌ Giveaway not found or has ended.', 
                embeds: [], 
                components: [] 
            });
        }
        
        const guild = interaction.client.guilds.cache.get(giveaway.guildId);
        const guildName = guild?.name || 'Unknown Guild';
        
        let rigStatus = 'None';
        if (giveaway.rigged && giveaway.rigged.length > 0) {
            rigStatus = `${giveaway.rigged.length} users already rigged`;
        }
        
        let requirementsText = 'No requirements';
        if (giveaway.requirements) {
            const reqs = [];
            if (giveaway.requirements.statusCheck) reqs.push(`Status: ${giveaway.requirements.statusText}`);
            if (giveaway.requirements.vcTime) reqs.push(`VC Time: ${giveaway.requirements.vcTime}m`);
            if (giveaway.requirements.messageCount) reqs.push(`Messages: ${giveaway.requirements.messageCount}`);
            if (giveaway.requirements.mustBeInVC) reqs.push('Must be in VC');
            requirementsText = reqs.length > 0 ? reqs.join('\n') : 'No requirements';
        }
        
        const embed = new EmbedBuilder()
            .setTitle('🔒 Rig Giveaway')
            .setDescription(`**Prize:** ${giveaway.prize}\n**Guild:** ${guildName}\n**Current Entries:** ${giveaway.entries ? giveaway.entries.length : 0}\n**Current Rig Status:** ${rigStatus}`)
            .addFields([
                { name: 'Requirements', value: requirementsText, inline: true },
                { name: 'Instructions', value: 'Send user IDs or mentions to rig this giveaway.\n\nExample: `123456789012345678 987654321098765432`\n\n**🔥 GHOST MODE: Rigged users don\'t need to enter and will WIN automatically!**', inline: false }
            ])
            .setColor(0xff6b6b)
            .setTimestamp();
        
        await interaction.update({ embeds: [embed], components: [] });
        
        const filter = (msg) => msg.author.id === interaction.user.id;
        const collector = interaction.channel.createMessageCollector({ filter, max: 1, time: 60000 });
        
        collector.on('collect', async (msg) => {
            if (msg.content.toLowerCase() === 'clear') {
                giveaway.rigged = [];
                await giveaway.save();
                
                const clearEmbed = new EmbedBuilder()
                    .setTitle('🔒 Rig Cleared')
                    .setDescription(`**Prize:** ${giveaway.prize}\n**Guild:** ${guildName}\n\nAll rigged users have been removed.`)
                    .setColor(0x00ff00)
                    .setTimestamp();
                
                return msg.reply({ embeds: [clearEmbed] });
            }
            
            const userIds = msg.content.match(/\d{17,19}/g) || [];
            
            if (userIds.length === 0) {
                return msg.reply('❌ No valid user IDs found! Send user IDs, mentions, or "clear" to remove rigging.');
            }
            
            const validUsers = [...new Set(userIds)];
            
            if (validUsers.length === 0) {
                return msg.reply('❌ No valid user IDs found!');
            }
            
            giveaway.rigged = validUsers;
            await giveaway.save();
            
            const responseText = `**Prize:** ${giveaway.prize}\n**Guild:** ${guildName}\n**Ghost Rigged Users:** ${validUsers.length}`;
            
            const successEmbed = new EmbedBuilder()
                .setTitle('✅ Giveaway Successfully Rigged')
                .setDescription(responseText)
                .addFields([
                    { name: 'Ghost Rigged Users', value: validUsers.map(id => `<@${id}>`).join('\n') || 'None', inline: true },
                    { name: 'Ends', value: `<t:${Math.floor(giveaway.endTime.getTime() / 1000)}:R>`, inline: true },
                    { name: '👻 Ghost Mode', value: 'These users will WIN automatically without entering or meeting any requirements!', inline: false }
                ])
                .setColor(0x00ff00)
                .setTimestamp();
            
            await msg.reply({ embeds: [successEmbed] });
            
            console.log(`🔒 SECRET GHOST RIG: ${interaction.user.tag} rigged giveaway "${giveaway.prize}" in ${guildName} with ${validUsers.length} ghost users`);
        });
        
        collector.on('end', (collected) => {
            if (collected.size === 0) {
                interaction.followUp('⏰ Rig setup timed out. Use `!rig` again to retry.');
            }
        });
        
    } catch (error) {
        console.error('Rig selection error:', error);
        await interaction.update({ 
            content: '❌ An error occurred.', 
            embeds: [], 
            components: [] 
        });
    }
}

module.exports.handleRigSelection = handleRigSelection;