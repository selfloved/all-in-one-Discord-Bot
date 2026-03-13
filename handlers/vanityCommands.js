const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { emojis, getGuild, hasVanityInStatus, giveVanityRole, removeVanityRole, replacePlaceholders } = require('../utils/vanityUtils');
const { syncAllUsers } = require('../events/vanityEvents');

async function handleVanityCommands(message, command, args) {
    const guildData = await getGuild(message.guild.id, message.guild.name);
    const prefix = guildData.prefix;

    try {
        if (command === 'vanity-setup' || command === 'vanitysetup') {
            if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
                return message.reply(`${emojis.warning} You need Manage Roles permission`);
            }
            
            const roleId = args[0]?.replace(/[<@&>]/g, '');
            const channelId = args[1]?.replace(/[<#>]/g, '');
            const vanityText = args.slice(2).join(' ') || '/vanity';
            
            if (!roleId) {
                return message.reply(`Usage: \`${prefix}vanity-setup <role> [channel] [vanity text]\``);
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

        } else if (command === 'vanity-toggle' || command === 'vanitytoggle') {
            if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
                return message.reply(`${emojis.warning} You need Manage Roles permission`);
            }
            
            const enabled = args[0]?.toLowerCase();
            if (!enabled || !['true', 'false', 'on', 'off', 'enable', 'disable'].includes(enabled)) {
                return message.reply(`Usage: \`${prefix}vanity-toggle <true/false>\``);
            }
            
            const newState = ['true', 'on', 'enable'].includes(enabled);
            guildData.vanity.enabled = newState;
            await guildData.save();
            
            const embed = new EmbedBuilder()
                .setDescription(`${emojis.check} Vanity system ${newState ? 'enabled' : 'disabled'}`)
                .setColor(0x000000);
            
            return message.reply({ embeds: [embed] });

        } else if (command === 'vanity-status' || command === 'vanitystatus') {
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
            } else if (guildData.vanity.currentUsers.length > 10) {
                description += ` (showing first 10)\n\n**Users with vanity:**\n`;
                for (let i = 0; i < 10; i++) {
                    const member = message.guild.members.cache.get(guildData.vanity.currentUsers[i].userId);
                    if (member) {
                        description += `${emojis.user} ${member.displayName}\n`;
                    }
                }
            }
            
            const embed = new EmbedBuilder()
                .setDescription(description)
                .setColor(0x000000);
            
            return message.reply({ embeds: [embed] });

        } else if (command === 'vanity-sync' || command === 'vanitysync') {
            if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
                return message.reply(`${emojis.warning} You need Manage Roles permission`);
            }
            
            if (!guildData.vanity.enabled || !guildData.vanity.roleId) {
                return message.reply(`${emojis.warning} Vanity system is not properly configured`);
            }
            
            const loadingMsg = await message.reply('Syncing...');
            
            const result = await syncAllUsers(message.guild);
            
            const embed = new EmbedBuilder()
                .setDescription(`${emojis.check} Sync complete!\n**Added:** ${result.added}\n**Removed:** ${result.removed}`)
                .setColor(0x000000);
            
            return loadingMsg.edit({ embeds: [embed] });
        }

    } catch (error) {
        console.error(`Error handling vanity command ${command}:`, error);
        return message.reply(`${emojis.warning} An error occurred`);
    }
}

module.exports = { handleVanityCommands };