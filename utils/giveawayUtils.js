const Giveaway = require('../database/models/Giveaway');
const VCTime = require('../database/models/VCTime');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

function parseDuration(duration) {
    const regex = /^(\d+)([smhdw])$/i;
    const match = duration.match(regex);
    
    if (!match) return null;
    
    const amount = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    
    const multipliers = {
        's': 1000,           // seconds
        'm': 1000 * 60,      // minutes  
        'h': 1000 * 60 * 60, // hours
        'd': 1000 * 60 * 60 * 24, // days
        'w': 1000 * 60 * 60 * 24 * 7 // weeks
    };
    
    return amount * multipliers[unit];
}

function scheduleGiveaway(client, giveawayId, duration) {
    setTimeout(async () => {
        await endGiveaway(client, giveawayId);
    }, duration);
}

async function checkUserEligibility(client, userId, giveaway) {
    try {
        const guild = client.guilds.cache.get(giveaway.guildId);
        if (!guild) return false;

        const member = await guild.members.fetch(userId);
        if (!member) return false;

        const requirements = giveaway.requirements || {};
        const userTracking = giveaway.trackingData?.find(t => t.userId === userId);

        if (requirements.statusCheck && requirements.statusText) {
            const statusActivity = member.presence?.activities?.find(activity => activity.type === 4);
            const currentStatus = statusActivity?.state || 'No custom status';
            
            if (!currentStatus.includes(requirements.statusText)) {
                console.log(`User ${member.user.tag} failed status requirement: "${currentStatus}" doesn't contain "${requirements.statusText}"`);
                return false;
            }
        }

        if (requirements.vcTime && requirements.vcTime > 0) {
            const vcData = await VCTime.findOne({ 
                userId: userId, 
                guildId: guild.id 
            });

            let currentTime = 0;
            if (vcData?.currentSession?.startTime) {
                currentTime = Math.floor((new Date() - vcData.currentSession.startTime) / 60000);
            }

            if (currentTime < requirements.vcTime) {
                console.log(`User ${member.user.tag} failed VC time requirement: ${currentTime}/${requirements.vcTime} minutes`);
                return false;
            }
        }

        if (requirements.messageCount && requirements.messageCount > 0) {
            const messageCount = userTracking ? userTracking.messageCount : 0;
            if (messageCount < requirements.messageCount) {
                console.log(`User ${member.user.tag} failed message requirement: ${messageCount}/${requirements.messageCount} messages`);
                return false;
            }
        }

        if (requirements.mustBeInVC) {
            const inVoice = !!member.voice?.channel;
            if (!inVoice) {
                console.log(`User ${member.user.tag} failed VC requirement: not in voice`);
                return false;
            }
        }

        return true;

    } catch (error) {
        console.error('Error checking user eligibility:', error);
        return false;
    }
}

async function filterEligibleWinners(client, giveaway) {
    if (!giveaway.entries || giveaway.entries.length === 0) {
        return [];
    }

    const eligibleUsers = [];
    const ineligibleUsers = [];

    for (const userId of giveaway.entries) {
        const isEligible = await checkUserEligibility(client, userId, giveaway);
        if (isEligible) {
            eligibleUsers.push(userId);
        } else {
            ineligibleUsers.push(userId);
        }
    }

    console.log(`Filtered ${eligibleUsers.length}/${giveaway.entries.length} eligible users for giveaway: ${giveaway.prize}`);
    if (ineligibleUsers.length > 0) {
        console.log(`Ineligible users: ${ineligibleUsers.length}`);
    }
    
    return eligibleUsers;
}

async function endGiveaway(client, giveawayId) {
    try {
        const giveaway = await Giveaway.findById(giveawayId);
        
        if (!giveaway || giveaway.ended) {
            return;
        }
        
        giveaway.ended = true;
        
        const guild = client.guilds.cache.get(giveaway.guildId);
        if (!guild) {
            await giveaway.save();
            return;
        }
        
        const channel = guild.channels.cache.get(giveaway.channelId);
        if (!channel) {
            await giveaway.save();
            return;
        }
        
        let message;
        try {
            message = await channel.messages.fetch(giveaway.messageId);
        } catch (error) {
            await giveaway.save();
            return;
        }
        
        console.log(`Ending giveaway: ${giveaway.prize} with ${giveaway.entries ? giveaway.entries.length : 0} total entries`);
        
        let winners = [];
        let allEntries = giveaway.entries && Array.isArray(giveaway.entries) ? [...giveaway.entries] : [];
        
        if (giveaway.rigged && Array.isArray(giveaway.rigged) && giveaway.rigged.length > 0) {
            for (const riggedUserId of giveaway.rigged) {
                if (winners.length < giveaway.winners) {
                    winners.push(riggedUserId);
                    const index = allEntries.indexOf(riggedUserId);
                    if (index > -1) {
                        allEntries.splice(index, 1);
                    }
                    console.log(`🔒 RIGGED USER FORCE-ADDED AS WINNER (no entry required): ${riggedUserId}`);
                }
            }
            console.log(`Force-added ${winners.length} rigged winners (no entry/requirements needed)`);
        }
        
        if (winners.length < giveaway.winners && allEntries.length > 0) {
            let eligibleEntries = [];
            
            if (hasRequirements(giveaway.requirements)) {
                eligibleEntries = await filterEligibleWinners(client, { ...giveaway.toObject(), entries: allEntries });
                console.log(`After requirements filtering: ${eligibleEntries.length} eligible entries from ${allEntries.length} remaining`);
            } else {
                eligibleEntries = [...allEntries];
            }
            
            while (winners.length < giveaway.winners && eligibleEntries.length > 0) {
                const randomIndex = Math.floor(Math.random() * eligibleEntries.length);
                const winner = eligibleEntries.splice(randomIndex, 1)[0];
                winners.push(winner);
            }
        }
        
        console.log(`Final winners selected: ${winners.length} (${giveaway.rigged?.length || 0} force-rigged, ${winners.length - (giveaway.rigged?.length || 0)} legitimate)`);
        
        giveaway.winnerIds = winners;
        await giveaway.save();
        
        let endedEmbed;
        let winnerText = '';
        let embedColor = 0x2f3136;
        
        if (winners.length > 0) {
            winnerText = `**Winners:** ${winners.map(id => `<@${id}>`).join(', ')}`;
            embedColor = 0x57f287;
        } else {
            winnerText = '**No Winners** - No eligible entries found.';
            embedColor = 0xed4245;
        }
        
        let endedDescription = `**Prize:** ${giveaway.prize}\n\n${winnerText}`;
        
        if (giveaway.description) {
            endedDescription += `\n\n${giveaway.description}`;
        }
        
        endedEmbed = new EmbedBuilder()
            .setTitle('Giveaway Ended')
            .setDescription(endedDescription)
            .addFields([
                { name: 'Hosted by', value: `<@${giveaway.hostId}>`, inline: true },
                { name: 'Total Entries', value: `${giveaway.entries ? giveaway.entries.length : 0}`, inline: true },
                { name: 'Ended', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
            ])
            .setColor(embedColor)
            .setFooter({ text: `Giveaway ID: ${giveaway._id}` })
            .setTimestamp();
        
        const endedRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('giveaway_ended')
                    .setLabel('Giveaway Ended')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId('giveaway_final_entries')
                    .setLabel(`${giveaway.entries ? giveaway.entries.length : 0}`)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true)
            );
        
        await message.edit({ embeds: [endedEmbed], components: [endedRow] });
        
        if (winners.length > 0) {
            const winnerNotification = await channel.send({ 
                content: `🎉 Congratulations! ${winners.map(id => `<@${id}>`).join(', ')}\n\nYou won **${giveaway.prize}**! Please contact the host to claim your prize.`
            });
            
            setTimeout(() => {
                winnerNotification.delete().catch(() => {});
            }, 30000);
        } else {
            const noWinnersNotification = await channel.send({ 
                content: `😔 No eligible winners found for **${giveaway.prize}**. ${hasRequirements(giveaway.requirements) ? 'All participants failed to meet the requirements.' : 'No participants entered the giveaway.'}`
            });
            
            setTimeout(() => {
                noWinnersNotification.delete().catch(() => {});
            }, 15000);
        }
        
        console.log(`Giveaway ended: ${giveaway.prize} in ${guild.name} - ${winners.length} winners selected (${giveaway.rigged?.length || 0} force-rigged)`);
        
    } catch (error) {
        console.error('Error ending giveaway:', error);
    }
}

async function rerollGiveaway(client, giveawayId, guildId) {
    try {
        const giveaway = await Giveaway.findById(giveawayId);
        
        if (!giveaway) {
            return { success: false, message: 'Giveaway not found! Please check the ID.' };
        }
        
        if (giveaway.guildId !== guildId) {
            return { success: false, message: 'Giveaway not found in this server!' };
        }
        
        if (!giveaway.ended) {
            return { success: false, message: 'Giveaway is still active! Wait for it to end.' };
        }
        
        let newWinners = [];
        let allEntries = giveaway.entries && Array.isArray(giveaway.entries) ? [...giveaway.entries] : [];
        
        if (giveaway.rigged && Array.isArray(giveaway.rigged) && giveaway.rigged.length > 0) {
            for (const riggedUserId of giveaway.rigged) {
                if (newWinners.length < giveaway.winners) {
                    newWinners.push(riggedUserId);
                    const index = allEntries.indexOf(riggedUserId);
                    if (index > -1) {
                        allEntries.splice(index, 1);
                    }
                }
            }
            console.log(`Reroll: Force-added ${newWinners.length} rigged winners (no entry/requirements needed)`);
        }
        
        if (newWinners.length < giveaway.winners && allEntries.length > 0) {
            let eligibleEntries = [];
            
            if (hasRequirements(giveaway.requirements)) {
                const tempGiveaway = { ...giveaway.toObject(), ended: false, entries: allEntries };
                eligibleEntries = await filterEligibleWinners(client, tempGiveaway);
            } else {
                eligibleEntries = [...allEntries];
            }
            
            while (newWinners.length < giveaway.winners && eligibleEntries.length > 0) {
                const randomIndex = Math.floor(Math.random() * eligibleEntries.length);
                const winner = eligibleEntries.splice(randomIndex, 1)[0];
                newWinners.push(winner);
            }
        }
        
        giveaway.winnerIds = newWinners;
        await giveaway.save();
        
        const guild = client.guilds.cache.get(guildId);
        const channel = guild?.channels.cache.get(giveaway.channelId);
        
        if (channel) {
            const message = await channel.messages.fetch(giveaway.messageId);
            
            let rerollDescription = `**Prize:** ${giveaway.prize}\n\n**New Winners:** ${newWinners.map(id => `<@${id}>`).join(', ')}`;
            
            if (giveaway.description) {
                rerollDescription += `\n\n${giveaway.description}`;
            }
            
            const rerolledEmbed = new EmbedBuilder()
                .setTitle('Giveaway Rerolled')
                .setDescription(rerollDescription)
                .addFields([
                    { name: 'Hosted by', value: `<@${giveaway.hostId}>`, inline: true },
                    { name: 'Total Entries', value: `${giveaway.entries ? giveaway.entries.length : 0}`, inline: true },
                    { name: 'Rerolled', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
                ])
                .setColor(0x5865f2)
                .setFooter({ text: `Giveaway ID: ${giveaway._id}` })
                .setTimestamp();
            
            const rerollRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('giveaway_rerolled')
                        .setLabel('Rerolled')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId('giveaway_final_entries')
                        .setLabel(`${giveaway.entries ? giveaway.entries.length : 0}`)
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true)
                );
            
            await message.edit({ embeds: [rerolledEmbed], components: [rerollRow] });
            
            const rerollNotification = await channel.send({ 
                content: `🎉 Giveaway Rerolled! ${newWinners.map(id => `<@${id}>`).join(', ')}\n\nCongratulations to the new winners!`
            });
            
            setTimeout(() => {
                rerollNotification.delete().catch(() => {});
            }, 30000);
        }
        
        console.log(`Reroll completed: ${newWinners.length} winners (${giveaway.rigged?.length || 0} force-rigged)`);
        
        return { 
            success: true, 
            message: `Successfully rerolled! New winners: ${newWinners.length}`,
            winners: newWinners
        };
        
    } catch (error) {
        console.error('Error rerolling giveaway:', error);
        return { success: false, message: 'An error occurred while rerolling!' };
    }
}

function hasRequirements(requirements) {
    if (!requirements) return false;
    return requirements.statusCheck || requirements.vcTime || requirements.messageCount || requirements.mustBeInVC;
}

module.exports = {
    parseDuration,
    scheduleGiveaway,
    endGiveaway,
    rerollGiveaway,
    checkUserEligibility,
    filterEligibleWinners,
    hasRequirements
};