// kaputt
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Giveaway = require('../../database/models/Giveaway');

module.exports = {
    name: 'massdm',
    aliases: ['mass-dm', 'dm-all'],
    description: 'Mass DM all server members about a giveaway (owner only)',
    usage: 'massdm',
    ownerOnly: true,
    
    async executePrefix(message, args, client) {
        const { guild, member } = message;
        
        message.delete().catch(() => {});
        
        const botOwnerId = process.env.OWNER_ID || client.application?.owner?.id;
        if (member.id !== guild.ownerId && member.id !== botOwnerId) {
            const errorMsg = await message.channel.send('Only the server owner or bot owner can use this command.');
            setTimeout(() => errorMsg.delete().catch(() => {}), 5000);
            return;
        }
        
        try {
            const activeGiveaways = await Giveaway.find({ 
                guildId: guild.id, 
                ended: false 
            }).limit(25);
            
            if (activeGiveaways.length === 0) {
                const errorMsg = await message.channel.send('No active giveaways found in this server.');
                setTimeout(() => errorMsg.delete().catch(() => {}), 5000);
                return;
            }
            
            await guild.members.fetch();
            const allMembers = guild.members.cache.filter(member => !member.user.bot);
            
            const options = activeGiveaways.map(giveaway => ({
                label: giveaway.prize.substring(0, 100),
                description: `${giveaway.entries ? giveaway.entries.length : 0} entries • Ends in ${Math.floor((giveaway.endTime - Date.now()) / 3600000)}h`,
                value: giveaway._id.toString(),
                emoji: '🎉'
            }));
            
            const selectMenu = new ActionRowBuilder()
                .addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('massdm_giveaway_select')
                        .setPlaceholder('Choose a giveaway to advertise...')
                        .addOptions(options)
                );
            
            const embed = new EmbedBuilder()
                .setTitle('Mass DM Advertisement')
                .setDescription(`**Active Giveaways:** ${activeGiveaways.length}\n**Target Members:** ${allMembers.size} total members\n\nSelect a giveaway to send DM advertisements to ALL server members.`)
                .addFields([
                    { name: 'Rate Limit', value: '1 DM per 2 seconds to avoid Discord limits', inline: true },
                    { name: 'Target', value: 'All server members (excluding bots)', inline: true },
                    { name: 'DM Failures', value: 'Will be logged and skipped automatically', inline: true }
                ])
                .setColor(0x5865f2)
                .setThumbnail(guild.iconURL())
                .setTimestamp();
            
            const dmMessage = await message.channel.send({ embeds: [embed], components: [selectMenu] });
            
            client.pendingMassDM = client.pendingMassDM || new Map();
            client.pendingMassDM.set(dmMessage.id, {
                guildId: guild.id,
                channelId: message.channel.id,
                authorId: member.id,
                giveaways: activeGiveaways,
                targetMembers: allMembers,
                messageId: dmMessage.id
            });
            
            setTimeout(() => {
                dmMessage.delete().catch(() => {});
                if (client.pendingMassDM) {
                    client.pendingMassDM.delete(dmMessage.id);
                }
            }, 600000);
            
        } catch (error) {
            console.error('Mass DM command error:', error);
            const errorMsg = await message.channel.send('An error occurred while setting up mass DM.');
            setTimeout(() => errorMsg.delete().catch(() => {}), 5000);
        }
    }
};

async function sendMassDM(client, giveaway, targetMembers, updateCallback) {
    const results = {
        success: 0,
        failed: 0,
        dmsClosed: 0,
        total: targetMembers.size
    };
    
    const dmEmbed = new EmbedBuilder()
        .setTitle('🎉 Giveaway Alert!')
        .setDescription(`**${giveaway.prize}**\n\nA new giveaway is happening in **${targetMembers.first().guild.name}**!\n\nClick the button below to join the giveaway and win amazing prizes!`)
        .addFields([
            { name: '🎁 Prize', value: giveaway.prize, inline: true },
            { name: '⏰ Ends', value: `<t:${Math.floor(giveaway.endTime / 1000)}:R>`, inline: true },
            { name: '👥 Entries', value: `${giveaway.entries ? giveaway.entries.length : 0}`, inline: true }
        ])
        .setColor(0x00ff00)
        .setThumbnail(targetMembers.first().guild.iconURL())
        .setTimestamp();
    
    const joinButton = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setLabel('Join Giveaway')
                .setStyle(ButtonStyle.Link)
                .setURL(`https://discord.com/channels/${giveaway.guildId}/${giveaway.channelId}/${giveaway.messageId}`)
                .setEmoji('🎉')
        );
    
    let processed = 0;
    
    for (const [memberId, member] of targetMembers) {
        try {
            await member.send({ 
                embeds: [dmEmbed], 
                components: [joinButton] 
            });
            results.success++;
            console.log(`✅ Sent DM to ${member.user.tag}`);
        } catch (error) {
            results.failed++;
            if (error.code === 50007) {
                results.dmsClosed++;
                console.log(`❌ DMs closed: ${member.user.tag}`);
            } else {
                console.log(`❌ Failed to DM ${member.user.tag}: ${error.message}`);
            }
        }
        
        processed++;
        
        if (processed % 10 === 0 || processed === results.total) {
            updateCallback(results, processed);
        }
        
        if (processed < results.total) {
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    
    return results;
}

module.exports.sendMassDM = sendMassDM;