const Guild = require('../database/models/Guild');

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
                autoReplyMessage: 'put {vanity} in your status, put yourself online (not offline), and keep it there to keep your perms',
                currentUsers: []
            }
        });
        await guild.save();
    }
    return guild;
}

function hasVanityInStatus(member, vanityText) {
    if (!member.presence) {
        console.log(`[VANITY] ${member.user.tag} - No presence data`);
        return false;
    }
    
    if (member.presence.status === 'offline') {
        console.log(`[VANITY] ${member.user.tag} - Status: offline`);
        return false;
    }
    
    const activities = member.presence.activities || [];
    const customStatus = activities.find(activity => activity.type === 4);
    
    if (!customStatus || !customStatus.state) {
        console.log(`[VANITY] ${member.user.tag} - No custom status`);
        return false;
    }
    
    const hasVanity = customStatus.state.toLowerCase().includes(vanityText.toLowerCase());
    console.log(`[VANITY] ${member.user.tag} - Status: ${member.presence.status}, Custom: "${customStatus.state}", HasVanity: ${hasVanity}`);
    
    return hasVanity;
}

async function addVanityUser(guildId, userId) {
    await Guild.updateOne(
        { guildId },
        { $addToSet: { 'vanity.currentUsers': { userId, addedAt: new Date() } } }
    );
}

async function removeVanityUser(guildId, userId) {
    await Guild.updateOne(
        { guildId },
        { $pull: { 'vanity.currentUsers': { userId } } }
    );
}

async function giveVanityRole(member, guildData) {
    try {
        if (!guildData.vanity.roleId) return false;
        
        const role = member.guild.roles.cache.get(guildData.vanity.roleId);
        if (!role) {
            console.log(`[VANITY] Role not found: ${guildData.vanity.roleId}`);
            return false;
        }
        
        if (member.roles.cache.has(guildData.vanity.roleId)) {
            console.log(`[VANITY] ${member.user.tag} already has role`);
            return false;
        }
        
        await member.roles.add(role);
        await addVanityUser(member.guild.id, member.id);
        
        if (guildData.vanity.channelId) {
            const channel = member.guild.channels.cache.get(guildData.vanity.channelId);
            if (channel) {
                await channel.send(`${member} is now repping ${guildData.vanity.vanityText}`);
            }
        }
        
        console.log(`[VANITY] ✅ Gave role to ${member.user.tag}`);
        return true;
    } catch (error) {
        console.error(`[VANITY] Error giving role to ${member.user.tag}:`, error);
        return false;
    }
}

async function removeVanityRole(member, guildData) {
    try {
        if (!guildData.vanity.roleId) return false;
        
        const role = member.guild.roles.cache.get(guildData.vanity.roleId);
        if (!role) {
            console.log(`[VANITY] Role not found: ${guildData.vanity.roleId}`);
            return false;
        }
        
        if (!member.roles.cache.has(guildData.vanity.roleId)) {
            console.log(`[VANITY] ${member.user.tag} doesn't have role`);
            return false;
        }
        
        await member.roles.remove(role);
        await removeVanityUser(member.guild.id, member.id);
        
        if (guildData.vanity.channelId) {
            const channel = member.guild.channels.cache.get(guildData.vanity.channelId);
            if (channel) {
                await channel.send(`${member} is not repping ${guildData.vanity.vanityText} anymore`);
            }
        }
        
        console.log(`[VANITY] ❌ Removed role from ${member.user.tag}`);
        return true;
    } catch (error) {
        console.error(`[VANITY] Error removing role from ${member.user.tag}:`, error);
        return false;
    }
}

async function handlePresenceUpdate(oldPresence, newPresence) {
    if (!newPresence?.member || newPresence.member.user.bot) return;
    
    try {
        const guildData = await getGuild(newPresence.guild.id, newPresence.guild.name);
        
        if (!guildData.vanity.enabled || !guildData.vanity.roleId) return;
        
        const member = newPresence.member;
        const hasRole = member.roles.cache.has(guildData.vanity.roleId);
        const hasVanity = hasVanityInStatus(member, guildData.vanity.vanityText);
        
        console.log(`[VANITY] Processing ${member.user.tag} - HasRole: ${hasRole}, HasVanity: ${hasVanity}`);
        
        if (hasVanity && !hasRole) {
            await giveVanityRole(member, guildData);
        }
        else if (!hasVanity && hasRole) {
            await removeVanityRole(member, guildData);
        }
        
    } catch (error) {
        console.error('[VANITY] Presence update error:', error);
    }
}

async function handlePermsDetection(message) {
    if (message.author.bot || !message.guild) return;
    
    const messageContent = message.content.toLowerCase();
    if (messageContent.includes('pic perms') || messageContent.includes('stream perms')) {
        try {
            const guildData = await getGuild(message.guild.id, message.guild.name);
            const response = guildData.vanity.autoReplyMessage.replace(/{vanity}/g, guildData.vanity.vanityText);
            await message.reply(response);
            console.log(`[VANITY] Auto-replied to ${message.author.tag} about perms`);
        } catch (error) {
            console.error('[VANITY] Perms detection error:', error);
        }
    }
}

module.exports = {
    handlePresenceUpdate,
    handlePermsDetection
};