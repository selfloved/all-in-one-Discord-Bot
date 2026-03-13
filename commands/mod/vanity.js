const Guild = require('../../database/models/Guild');
const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

const emojis = {
    check: '<:Check:1393751996267368478>',
    warning: '<:Warning:1393752109119176755>',
    settings: '<:Settings:1393752089884102677>',
    user: '<:User:1393752101687136269>'
};

module.exports = {
    name: 'vanity',
    description: 'Manage vanity status role system',
    usage: '!vanity <setup/toggle/status>',
    aliases: ['v'],
    category: 'moderation',
    
    async executePrefix(message) {
        const args = message.content.split(' ').slice(1);
        const guildData = await getOrCreateGuild(message.guild.id, message.guild.name);
        const subCommand = args[0]?.toLowerCase();

        try {
            if (subCommand === 'setup') {
                return await handleSetup(message, args, guildData);
            } else if (subCommand === 'toggle') {
                return await handleToggle(message, args, guildData);
            } else if (subCommand === 'status') {
                return await handleStatus(message, guildData);
            } else {
                return await showHelp(message);
            }
        } catch (error) {
            console.error('Vanity command error:', error);
            return message.reply(`${emojis.warning} An error occurred`);
        }
    }
};

async function getOrCreateGuild(guildId, guildName) {
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

async function handleSetup(message, args, guildData) {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
        return message.reply(`${emojis.warning} You need Manage Roles permission`);
    }

    const roleId = args[1]?.replace(/[<@&>]/g, '');
    const channelId = args[2]?.replace(/[<#>]/g, '');
    const vanityText = args.slice(3).join(' ') || '/vanity';
    
    if (!roleId) {
        return message.reply(`Usage: \`!vanity setup <role> [channel] [vanity text]\``);
    }
    
    const role = message.guild.roles.cache.get(roleId);
    if (!role) {
        return message.reply(`${emojis.warning} Role not found`);
    }
    
    const channel = channelId ? message.guild.channels.cache.get(channelId) : null;
    
    guildData.vanity.roleId = role.id;
    guildData.vanity.vanityText = vanityText;
    guildData.vanity.enabled = true;
    
    if (channel) {
        guildData.vanity.channelId = channel.id;
    }
    
    await guildData.save();
    
    const embed = new EmbedBuilder()
        .setDescription(`${emojis.check} Vanity system configured!\n**Role:** ${role}\n**Text:** ${vanityText}${channel ? `\n**Channel:** ${channel}` : ''}`)
        .setColor(0x000000);
    
    return message.reply({ embeds: [embed] });
}

async function handleToggle(message, args, guildData) {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
        return message.reply(`${emojis.warning} You need Manage Roles permission`);
    }
    
    const enabled = args[1]?.toLowerCase();
    if (!enabled || !['true', 'false', 'on', 'off', 'enable', 'disable'].includes(enabled)) {
        return message.reply(`Usage: \`!vanity toggle <true/false>\``);
    }
    
    const newState = ['true', 'on', 'enable'].includes(enabled);
    guildData.vanity.enabled = newState;
    await guildData.save();
    
    const embed = new EmbedBuilder()
        .setDescription(`${emojis.check} Vanity system ${newState ? 'enabled' : 'disabled'}`)
        .setColor(0x000000);
    
    return message.reply({ embeds: [embed] });
}

async function handleStatus(message, guildData) {
    const role = guildData.vanity.roleId ? message.guild.roles.cache.get(guildData.vanity.roleId) : null;
    const channel = guildData.vanity.channelId ? message.guild.channels.cache.get(guildData.vanity.channelId) : null;
    
    let description = `**Status:** ${guildData.vanity.enabled ? 'Enabled' : 'Disabled'}\n`;
    description += `**Role:** ${role || 'Not set'}\n`;
    description += `**Text:** ${guildData.vanity.vanityText}\n`;
    description += `**Channel:** ${channel || 'Not set'}\n`;
    description += `**Current Users:** ${guildData.vanity.currentUsers.length}`;
    
    if (guildData.vanity.currentUsers.length > 0 && guildData.vanity.currentUsers.length <= 10) {
        description += '\n\n**Users with vanity:**\n';
        for (const user of guildData.vanity.currentUsers) {
            const member = message.guild.members.cache.get(user.userId);
            if (member) {
                description += `${emojis.user} ${member.displayName}\n`;
            }
        }
    }
    
    const embed = new EmbedBuilder()
        .setDescription(description)
        .setColor(0x000000);
    
    return message.reply({ embeds: [embed] });
}

async function showHelp(message) {
    const helpEmbed = new EmbedBuilder()
        .setDescription(`${emojis.settings} **Vanity Commands:**\n\n\`!vanity setup <role> [channel] [text]\` - Setup vanity system\n\`!vanity toggle <true/false>\` - Enable/disable system\n\`!vanity status\` - View current settings\n\n**Example:**\n\`!vanity setup @VanityRole #announcements /vanity\``)
        .setColor(0x000000);
    
    return message.reply({ embeds: [helpEmbed] });
}