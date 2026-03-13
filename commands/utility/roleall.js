const { createEmbed } = require('../../utils/embedBuilder');
const { PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const ModLog = require('../../database/models/modLog');

module.exports = {
    name: 'roleall',
    description: 'Give a role to all members in the server',
    usage: '!roleall <role_name/id> [--exclude-bots]',
    aliases: ['addroleall', 'massrole'],
    category: 'mod',
    
    async executePrefix(message) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('<:Deny:1393752012054728784> You need Administrator permission');
        }

        const args = message.content.slice(message.content.indexOf(' ') + 1).split(' ');
        
        if (!args[0] || args[0] === message.content) {
            return message.reply('<:Deny:1393752012054728784> Please provide a role name or ID');
        }

        const excludeBots = args.includes('--exclude-bots');
        const roleQuery = args.filter(arg => arg !== '--exclude-bots').join(' ');

        let role;
        const roleId = roleQuery.match(/^<@&(\d+)>$/) ? roleQuery.match(/^<@&(\d+)>$/)[1] : roleQuery;
        
        if (/^\d{17,19}$/.test(roleId)) {
            role = message.guild.roles.cache.get(roleId);
        } else {
            role = message.guild.roles.cache.find(r => 
                r.name.toLowerCase() === roleQuery.toLowerCase()
            );
        }

        if (!role) {
            return message.reply('<:Deny:1393752012054728784> Role not found');
        }

        const botMember = message.guild.members.me;
        if (role.position >= botMember.roles.highest.position) {
            return message.reply('<:Deny:1393752012054728784> Cannot assign role higher than or equal to bot\'s highest role');
        }

        if (role.position >= message.member.roles.highest.position) {
            return message.reply('<:Deny:1393752012054728784> Cannot assign role higher than or equal to your highest role');
        }

        const dangerousPerms = [
            PermissionFlagsBits.Administrator,
            PermissionFlagsBits.ManageGuild,
            PermissionFlagsBits.ManageRoles,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.BanMembers,
            PermissionFlagsBits.KickMembers
        ];

        const hasDangerousPerms = dangerousPerms.some(perm => role.permissions.has(perm));
        
        if (hasDangerousPerms) {
            return message.reply('<:Deny:1393752012054728784> Cannot mass assign roles with dangerous permissions (Administrator, Manage roles, etc.)');
        }

        await message.guild.members.fetch();
        const members = message.guild.members.cache.filter(member => {
            if (member.roles.cache.has(role.id)) return false;
            if (excludeBots && member.user.bot) return false;
            return true;
        });

        if (members.size === 0) {
            return message.reply('No members found to give this role to (all eligible members already have it).');
        }

        const confirmEmbed = createEmbed('default', 'Role All Confirmation', 
            `**Role:** ${role.name}\n` +
            `**Members to affect:** ${members.size}\n` +
            `**Exclude bots:** ${excludeBots ? 'Yes' : 'No'}\n\n` +
            `Are you sure you want to give this role to ${members.size} members?`
        );

        const confirmRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('roleall_confirm')
                    .setLabel('Confirm')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('roleall_cancel')
                    .setLabel('Cancel')
                    .setStyle(ButtonStyle.Secondary)
            );

        const confirmMsg = await message.reply({ 
            embeds: [confirmEmbed], 
            components: [confirmRow] 
        });

        try {
            const interaction = await confirmMsg.awaitMessageComponent({
                filter: (i) => i.user.id === message.author.id,
                time: 30000
            });

            if (interaction.customId === 'roleall_cancel') {
                await interaction.update({ 
                    content: 'Role assignment cancelled.', 
                    embeds: [], 
                    components: [] 
                });
                return;
            }

            await interaction.update({ 
                content: `<:Check:1393751996267368478> Starting role assignment for ${members.size} members...`, 
                embeds: [], 
                components: [] 
            });

            let successCount = 0;
            let errorCount = 0;
            const batchSize = 5;
            const memberArray = Array.from(members.values());

            for (let i = 0; i < memberArray.length; i += batchSize) {
                const batch = memberArray.slice(i, i + batchSize);
                
                const promises = batch.map(async (member) => {
                    try {
                        await member.roles.add(role, `Mass role assignment by ${message.author.tag}`);
                        successCount++;
                    } catch (error) {
                        console.error(`Failed to add role to ${member.user.tag}:`, error);
                        errorCount++;
                    }
                });

                await Promise.all(promises);
                
                if ((i + batchSize) % 25 === 0 || i + batchSize >= memberArray.length) {
                    const progress = Math.min(i + batchSize, memberArray.length);
                    await confirmMsg.edit({ 
                        content: `<:Check:1393751996267368478> Progress: ${progress}/${memberArray.length} members processed...`
                    });
                }

                if (i + batchSize < memberArray.length) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            await ModLog.create({
                guildId: message.guild.id,
                moderatorId: message.author.id,
                moderatorTag: message.author.tag,
                targetId: role.id,
                targetTag: role.name,
                action: 'roleall',
                reason: `Mass role assignment: ${successCount} successful, ${errorCount} failed${excludeBots ? ' (bots excluded)' : ''}`
            });

            const resultEmbed = createEmbed('default', 'Role Assignment Complete',
                `**Role:** ${role.name}\n` +
                `**Successfully added:** ${successCount}\n` +
                `**Failed:** ${errorCount}\n` +
                `**Total processed:** ${successCount + errorCount}`
            );

            await confirmMsg.edit({ 
                content: null,
                embeds: [resultEmbed]
            });

        } catch (error) {
            if (error.code === 'InteractionCollectorError') {
                await confirmMsg.edit({ 
                    content: 'Confirmation timed out. Role assignment cancelled.', 
                    embeds: [], 
                    components: [] 
                });
            } else {
                console.error('Error in roleall command:', error);
                await confirmMsg.edit({ 
                    content: '<:Deny:1393752012054728784> An error occurred during role assignment.', 
                    embeds: [], 
                    components: [] 
                });
            }
        }
    },
};