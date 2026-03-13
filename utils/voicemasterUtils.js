const { TempChannel, VoicePermit, VoiceBan } = require('../database/models/Voicemaster');

async function isChannelOwner(channelId, userId) {
    try {
        const tempChannel = await TempChannel.findOne({ channelId, ownerId: userId });
        return !!tempChannel;
    } catch (error) {
        console.error('Error checking channel owner:', error);
        return false;
    }
}

function hasVanityInBio(member) {
    return member.presence?.activities?.some(activity => 
        activity.type === 4 && activity.state?.includes('/')
    ) || false;
}

async function getUserFromString(guild, userString) {
    const cleanId = userString.replace(/[<@!>]/g, '');
    
    try {
        return await guild.members.fetch(cleanId);
    } catch {
        const lowerInput = userString.toLowerCase();
        return guild.members.cache.find(member => 
            member.user.username.toLowerCase() === lowerInput ||
            member.displayName.toLowerCase() === lowerInput ||
            member.user.globalName?.toLowerCase() === lowerInput
        );
    }
}

async function addPermit(channelId, userId) {
    try {
        await VoicePermit.findOneAndUpdate(
            { channelId, userId },
            { channelId, userId },
            { upsert: true, new: true }
        );
        return true;
    } catch (error) {
        console.error('Error adding permit:', error);
        return false;
    }
}

async function addBan(channelId, userId) {
    try {
        await VoiceBan.findOneAndUpdate(
            { channelId, userId },
            { channelId, userId },
            { upsert: true, new: true }
        );
        return true;
    } catch (error) {
        console.error('Error adding ban:', error);
        return false;
    }
}

async function isPermitted(channelId, userId) {
    try {
        const permit = await VoicePermit.findOne({ channelId, userId });
        return !!permit;
    } catch (error) {
        console.error('Error checking permit:', error);
        return false;
    }
}

module.exports = {
    isChannelOwner,
    hasVanityInBio,
    getUserFromString,
    addPermit,
    addBan,
    isPermitted
};