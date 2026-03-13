const { EmbedBuilder } = require('discord.js');
const Guild = require('../models/Guild');

// Custom Emojis
const emojis = {
    check: '<:Check:1393751996267368478>',
    warning: '<:Warning:1393752109119176755>',
    settings: '<:Settings:1393752089884102677>',
    user: '<:User:1393752101687136269>'
};

async function getGuild(guildId, guildName) {
    let guild = await Guild.findOne({ guildId });
    if (!guild) {
        guild = new Guild({ 
            guildId, 
            guildName,
            vanity: {
                enabled: false,
                roleId: null,
                channelId: null,
                vanityText: '/vanity',
                embedEnabled: true,
                embedTitle: '🌟 Community Support Recognition',
                embedDescription: 'Thank you for representing our community! Your dedication to showing {vanity} in your status demonstrates your commitment to our values. As a token of our appreciation, you now have access to enhanced permissions including image sharing and streaming capabilities.\n\n**Remember:** Keep {vanity} in your status and stay online to maintain these privileges.',
                embedColor: '#000000',
                embedFooter: 'Stay active, stay connected',
                autoReplyMessage: 'put {vanity} in your status, put yourself online (not offline), and keep it there to keep your perms',
                currentUsers: []
            }
        });
        await guild.save();
    }
    return guild;
}

async function addVanityUser(guildId, userId) {
    await Guild.updateOne(
        { guildId },
        { 
            $addToSet: { 
                'vanity.currentUsers': { 
                    userId, 
                    addedAt: new Date() 
                } 
            } 
        }
    );
}

async function removeVanityUser(guildId, userId) {
    await Guild.updateOne(
        { guildId },
        { 
            $pull: { 
                'vanity.currentUsers': { userId } 
            } 
        }
    );
}

function hasVanityInStatus(member, vanityText) {
    if (!member.presence) return false;
    
    const activities = member.presence.activities;
    if (!activities) return false;
    
    const customStatus = activities.find(activity => activity.type === 4);
    if (customStatus && customStatus.state && customStatus.state.toLowerCase().includes(vanityText.toLowerCase())) {
        return true;
    }
    
    return false;
}

function replacePlaceholders(text, vanityText) {
    return text.replace(/{vanity}/g, vanityText);
}

async function giveVanityRole(member, guildData) {
    try {
        if (!guildData.vanity.roleId) return false;
        
        const role = member.guild.roles.cache.get(guildData.vanity.roleId);
        if (!role) return false;
        
        if (member.roles.cache.has(guildData.vanity.roleId)) return false;
        
        await member.roles.add(role);
        await addVanityUser(member.guild.id, member.id);
        
        if (guildData.vanity.channelId) {
            const channel = member.guild.channels.cache.get(guildData.vanity.channelId);
            if (channel) {
                await channel.send(`${member} is now repping ${guildData.vanity.vanityText}`);
            }
        }
        
        return true;
    } catch (error) {
        console.error('Error giving vanity role:', error);
        return false;
    }
}

async function removeVanityRole(member, guildData) {
    try {
        if (!guildData.vanity.roleId) return false;
        
        const role = member.guild.roles.cache.get(guildData.vanity.roleId);
        if (!role) return false;
        
        if (!member.roles.cache.has(guildData.vanity.roleId)) return false;
        
        await member.roles.remove(role);
        await removeVanityUser(member.guild.id, member.id);
        
        if (guildData.vanity.channelId) {
            const channel = member.guild.channels.cache.get(guildData.vanity.channelId);
            if (channel) {
                await channel.send(`${member} is not repping ${guildData.vanity.vanityText} anymore`);
            }
        }
        
        return true;
    } catch (error) {
        console.error('Error removing vanity role:', error);
        return false;
    }
}

module.exports = {
    emojis,
    getGuild,
    addVanityUser,
    removeVanityUser,
    hasVanityInStatus,
    replacePlaceholders,
    giveVanityRole,
    removeVanityRole
};