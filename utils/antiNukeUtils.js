const { PermissionFlagsBits } = require('discord.js');
const AntiNuke = require('../database/models/AntiNuke');

/**
 * @param {string} guildId - Guild ID
 * @param {string} userId - User ID
 * @param {Guild} guild - Discord guild object
 * @returns {Promise<boolean>}
 */
async function isUserWhitelisted(guildId, userId, guild) {
    try {
        if (userId === guild.ownerId) return true;
        
        const config = await AntiNuke.findOne({ guildId });
        if (!config) return false;
        
        if (config.whitelistedUsers.includes(userId)) return true;
        
        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) return false;
        
        return member.roles.cache.some(role => config.whitelistedRoles.includes(role.id));
    } catch (error) {
        console.log('Error checking whitelist:', error.message);
        return false;
    }
}

/**
 * @param {string} guildId - Guild ID
 * @returns {Promise<Object|null>}
 */
async function getAntiNukeConfig(guildId) {
    try {
        return await AntiNuke.findOne({ guildId });
    } catch (error) {
        console.log('Error getting anti-nuke config:', error.message);
        return null;
    }
}

/**
 * @param {string} guildId - Guild ID
 * @returns {Promise<boolean>}
 */
async function isAntiNukeEnabled(guildId) {
    try {
        const config = await AntiNuke.findOne({ guildId });
        return config?.enabled || false;
    } catch (error) {
        return false;
    }
}

/**
 * @returns {Array<bigint>}
 */
function getDangerousPermissions() {
    return [
        PermissionFlagsBits.Administrator,
        PermissionFlagsBits.ManageGuild,
        PermissionFlagsBits.ManageRoles,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.BanMembers,
        PermissionFlagsBits.KickMembers,
        PermissionFlagsBits.ManageWebhooks,
        PermissionFlagsBits.ManageEmojisAndStickers
    ];
}

/**
 * @param {Role} role - Discord role object
 * @returns {boolean}
 */
function hasDangerousPermissions(role) {
    const dangerousPerms = getDangerousPermissions();
    return dangerousPerms.some(perm => role.permissions.has(perm));
}

/**
 * @param {Role} oldRole - Old role object
 * @param {Role} newRole - New role object
 * @returns {Array<string>}
 */
function getAddedPermissions(oldRole, newRole) {
    const added = [];
    const dangerousPerms = {
        [PermissionFlagsBits.Administrator]: 'Administrator',
        [PermissionFlagsBits.ManageGuild]: 'Manage Server',
        [PermissionFlagsBits.ManageRoles]: 'Manage Roles',
        [PermissionFlagsBits.ManageChannels]: 'Manage Channels',
        [PermissionFlagsBits.BanMembers]: 'Ban Members',
        [PermissionFlagsBits.KickMembers]: 'Kick Members',
        [PermissionFlagsBits.ManageWebhooks]: 'Manage Webhooks'
    };
    
    for (const [perm, name] of Object.entries(dangerousPerms)) {
        if (!oldRole.permissions.has(BigInt(perm)) && newRole.permissions.has(BigInt(perm))) {
            added.push(name);
        }
    }
    
    return added;
}

/**
 * @param {string} guildId - Guild ID
 * @returns {Object}
 */
function createDefaultConfig(guildId) {
    return {
        guildId,
        enabled: false,
        whitelistedUsers: [],
        whitelistedRoles: [],
        protection: {
            roleCreate: { enabled: true, limit: 3, timeWindow: 10 },
            roleDelete: { enabled: true, limit: 3, timeWindow: 10 },
            roleUpdate: { enabled: true, limit: 5, timeWindow: 10 },
            adminGrant: { enabled: true },
            channelCreate: { enabled: true, limit: 3, timeWindow: 10 },
            channelDelete: { enabled: true, limit: 3, timeWindow: 10 },
            channelUpdate: { enabled: true, limit: 5, timeWindow: 10 },
            memberBan: { enabled: true, limit: 3, timeWindow: 10 },
            memberKick: { enabled: true, limit: 5, timeWindow: 10 },
            botAdd: { enabled: true },
            webhookCreate: { enabled: true, limit: 2, timeWindow: 10 },
            webhookDelete: { enabled: true, limit: 3, timeWindow: 10 },
            guildUpdate: { enabled: true }
        },
        punishment: {
            type: 'strip',
            removeRoles: true,
            timeoutDuration: 3600000
        },
        logChannel: null
    };
}

/**
 * @param {string} action - Action type
 * @param {string} guildName - Guild name
 * @param {string} userTag - User tag
 * @param {string} details - Action details
 */
function logAntiNukeAction(action, guildName, userTag, details) {
    const timestamp = new Date().toISOString();
    console.log(`🛡️ [${timestamp}] ANTI-NUKE | ${guildName} | ${action} | ${userTag} | ${details}`);
}

/**
 * @param {string} type - Punishment type
 * @returns {string}
 */
function formatPunishmentType(type) {
    const types = {
        'kick': 'Kick from server',
        'ban': 'Ban from server',
        'strip': 'Remove dangerous roles',
        'timeout': 'Timeout user'
    };
    return types[type] || type;
}

/**
 * @param {GuildMember} member - Guild member
 * @param {Guild} guild - Discord guild
 * @returns {boolean}
 */
function canModifyAntiNuke(member, guild) {
    return member.id === guild.ownerId;
}

/**
 * @param {Object} config - Configuration object
 * @returns {Object} Validation result
 */
function validateConfig(config) {
    const errors = [];
    
    const protections = ['roleCreate', 'roleDelete', 'roleUpdate', 'channelCreate', 'channelDelete', 'channelUpdate', 'memberBan', 'memberKick', 'webhookCreate', 'webhookDelete'];
    
    for (const protection of protections) {
        if (config.protection[protection]) {
            const { limit, timeWindow } = config.protection[protection];
            if (limit && (limit < 1 || limit > 50)) {
                errors.push(`${protection} limit must be between 1 and 50`);
            }
            if (timeWindow && (timeWindow < 5 || timeWindow > 300)) {
                errors.push(`${protection} time window must be between 5 and 300 seconds`);
            }
        }
    }
    
    const validPunishments = ['kick', 'ban', 'strip', 'timeout'];
    if (config.punishment.type && !validPunishments.includes(config.punishment.type)) {
        errors.push('Invalid punishment type');
    }
    
    if (config.punishment.timeoutDuration && (config.punishment.timeoutDuration < 60000 || config.punishment.timeoutDuration > 2419200000)) {
        errors.push('Timeout duration must be between 1 minute and 28 days');
    }
    
    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * @param {Object} config - Anti-nuke configuration
 * @returns {Object}
 */
function getProtectionSummary(config) {
    if (!config || !config.enabled) {
        return { enabled: false, activeProtections: 0, totalProtections: 12 };
    }
    
    const protections = [
        'roleCreate', 'roleDelete', 'roleUpdate', 'adminGrant',
        'channelCreate', 'channelDelete', 'channelUpdate',
        'memberBan', 'memberKick', 'botAdd',
        'webhookCreate', 'guildUpdate'
    ];
    
    const activeProtections = protections.filter(p => config.protection[p]?.enabled).length;
    
    return {
        enabled: true,
        activeProtections,
        totalProtections: protections.length,
        whitelistedUsers: config.whitelistedUsers?.length || 0,
        whitelistedRoles: config.whitelistedRoles?.length || 0,
        punishmentType: config.punishment?.type || 'strip',
        hasLogChannel: !!config.logChannel
    };
}

module.exports = {
    isUserWhitelisted,
    getAntiNukeConfig,
    isAntiNukeEnabled,
    getDangerousPermissions,
    hasDangerousPermissions,
    getAddedPermissions,
    createDefaultConfig,
    logAntiNukeAction,
    formatPunishmentType,
    canModifyAntiNuke,
    validateConfig,
    getProtectionSummary
};