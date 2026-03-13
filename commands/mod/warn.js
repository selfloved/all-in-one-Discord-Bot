const { createEmbed } = require('../../utils/embedBuilder');
const { PermissionFlagsBits } = require('discord.js');
const Warning = require('../../database/models/Warning');
const ModLog = require('../../database/models/modLog');

module.exports = {
    name: 'warn',
    description: 'Warning system with automatic punishments',
    usage: '!warn <user> <reason> | !warn help | !warn remove <id> | !warn edit <id> <reason>',
    aliases: ['warning'],
    category: 'mod',
    
    async executePrefix(message) {
        if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            return message.reply('<:Deny:1393752012054728784> You need Moderate Members permission');
        }

        const args = message.content.slice(message.content.indexOf(' ') + 1).split(' ');
        
        if (!args[0] || args[0] === message.content) {
            return message.reply('<:Warning:1393752109119176755> Usage: !warn <user> <reason> | !warn help');
        }

        const subcommand = args[0].toLowerCase();

        switch (subcommand) {
            case 'help':
                return this.showHelp(message);
            case 'remove':
                return this.removeWarn(message, args.slice(1));
            case 'edit':
                return this.editWarn(message, args.slice(1));
            case 'list':
                return this.listWarns(message, args.slice(1));
            default:
                return this.addWarn(message, args);
        }
    },

    async addWarn(message, args) {
        let user;
        let userId;

        const userMention = args[0].match(/^<@!?(\d+)>$/);
        if (userMention) {
            userId = userMention[1];
        } else if (/^\d{17,19}$/.test(args[0])) {
            userId = args[0];
        } else {
            return message.reply('<:Warning:1393752109119176755> Please provide a valid user mention or ID');
        }

        try {
            user = await message.client.users.fetch(userId);
        } catch {
            return message.reply('<:Deny:1393752012054728784> Could not find user with that ID');
        }

        const reason = args.slice(1).join(' ');
        if (!reason) {
            return message.reply('<:Warning:1393752109119176755> Please provide a reason for the warning');
        }

        try {
            const currentWarns = await Warning.countDocuments({ 
                guildId: message.guild.id, 
                userId: userId, 
                active: true 
            });
            const warnNumber = currentWarns + 1;

            let messageContent = null;
            let messageUrl = null;
            if (message.reference) {
                try {
                    const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
                    messageContent = repliedMessage.content || 'No text content';
                    messageUrl = repliedMessage.url;
                } catch (error) {
                    console.log('Could not fetch replied message');
                }
            }

            const punishment = this.getPunishment(warnNumber);

            const warning = await Warning.create({
                guildId: message.guild.id,
                userId: userId,
                userTag: user.tag,
                moderatorId: message.author.id,
                moderatorTag: message.author.tag,
                reason: reason,
                warnNumber: warnNumber,
                messageContent: messageContent,
                messageUrl: messageUrl,
                punishment: punishment
            });

            await this.applyPunishment(message, user, warnNumber, punishment, reason);

            const embed = createEmbed('default', `Warning #${warnNumber} - ${user.tag}`, '');
            
            let description = `**Moderator:** ${message.author.tag}\n`;
            description += `**Time:** <t:${Math.floor(Date.now() / 1000)}:R>\n`;
            description += `**Reason:** ${reason}\n`;
            if (punishment) {
                description += `**Punishment:** ${punishment}\n`;
            }
            if (messageContent) {
                description += `**Message:** ${messageContent.length > 100 ? messageContent.substring(0, 100) + '...' : messageContent}\n`;
            }

            embed.setDescription(description);
            embed.setFooter({ text: `Warning ID: ${warning._id}` });

            message.reply({ embeds: [embed] });

        } catch (error) {
            console.error(error);
            message.reply('<:Deny:1393752012054728784> Failed to create warning');
        }
    },

    async removeWarn(message, args) {
        if (!args[0]) {
            return message.reply('<:Warning:1393752109119176755> Please provide a warning ID');
        }

        const warnId = args[0];

        try {
            const warning = await Warning.findOneAndUpdate(
                { _id: warnId, guildId: message.guild.id },
                { active: false },
                { new: true }
            );

            if (!warning) {
                return message.reply('<:Deny:1393752012054728784> Warning not found');
            }

            message.reply(`Warning #${warning.warnNumber} removed for ${warning.userTag}`);

        } catch (error) {
            console.error(error);
            message.reply('<:Deny:1393752012054728784> Failed to remove warning');
        }
    },

    async editWarn(message, args) {
        if (!args[0] || !args[1]) {
            return message.reply('<:Warning:1393752109119176755> Usage: !warn edit <warning_id> <new_reason>');
        }

        const warnId = args[0];
        const newReason = args.slice(1).join(' ');

        try {
            const warning = await Warning.findOneAndUpdate(
                { _id: warnId, guildId: message.guild.id },
                { reason: newReason },
                { new: true }
            );

            if (!warning) {
                return message.reply('<:Deny:1393752012054728784> Warning not found');
            }

            message.reply(`Warning #${warning.warnNumber} updated for ${warning.userTag}`);

        } catch (error) {
            console.error(error);
            message.reply('<:Deny:1393752012054728784> Failed to edit warning');
        }
    },

    async listWarns(message, args) {
        let userId = null;

        if (args[0]) {
            const userMention = args[0].match(/^<@!?(\d+)>$/);
            if (userMention) {
                userId = userMention[1];
            } else if (/^\d{17,19}$/.test(args[0])) {
                userId = args[0];
            }
        }

        try {
            const query = { guildId: message.guild.id, active: true };
            if (userId) query.userId = userId;

            const warnings = await Warning.find(query)
                .sort({ timestamp: -1 })
                .limit(10);

            if (warnings.length === 0) {
                return message.reply('No active warnings found');
            }

            const embed = createEmbed('default', userId ? `Warnings for <@${userId}>` : 'Recent Warnings', '');

            const warningText = warnings.map(warn => {
                const timestamp = Math.floor(warn.timestamp.getTime() / 1000);
                return `**#${warn.warnNumber}** - ${warn.userTag}\nModerator: ${warn.moderatorTag}\nTime: <t:${timestamp}:R>\nReason: ${warn.reason.length > 50 ? warn.reason.substring(0, 50) + '...' : warn.reason}\nID: ${warn._id}`;
            }).join('\n\n');

            embed.setDescription(warningText);
            message.reply({ embeds: [embed] });

        } catch (error) {
            console.error(error);
            message.reply('<:Deny:1393752012054728784> Failed to fetch warnings');
        }
    },

    showHelp(message) {
        const embed = createEmbed('default', 'Warning System Commands', '');
        
        const helpText = [
            '**!warn <user> <reason>** - Warn a user',
            '**!warn list [user]** - List warnings',
            '**!warn remove <id>** - Remove a warning',
            '**!warn edit <id> <reason>** - Edit warning reason',
            '',
            '**Automatic Punishments:**',
            '1st Warn - 5 min timeout',
            '2nd Warn - 15 min timeout', 
            '3rd Warn - 30 min timeout',
            '4th Warn - Kick',
            '5th Warn - 24 hour ban',
            '6th Warn - 48 hour ban'
        ].join('\n');

        embed.setDescription(helpText);
        message.reply({ embeds: [embed] });
    },

    getPunishment(warnNumber) {
        switch (warnNumber) {
            case 1: return '5 minute timeout';
            case 2: return '15 minute timeout';
            case 3: return '30 minute timeout';
            case 4: return 'Kick';
            case 5: return '24 hour ban';
            case 6: return '48 hour ban';
            default: return '48 hour ban';
        }
    },

    async applyPunishment(message, user, warnNumber, punishment, reason) {
        try {
            const member = await message.guild.members.fetch(user.id).catch(() => null);
            if (!member) return;

            // Check role hierarchy
            const botMember = message.guild.members.me;
            if (member.roles.highest.position >= botMember.roles.highest.position) {
                return;
            }

            const logReason = `Auto-punishment for warn #${warnNumber}: ${reason}`;

            switch (warnNumber) {
                case 1: // 5 min timeout
                    await member.timeout(5 * 60 * 1000, logReason);
                    await ModLog.create({
                        guildId: message.guild.id,
                        moderatorId: message.client.user.id,
                        moderatorTag: 'AutoMod',
                        targetId: user.id,
                        targetTag: user.tag,
                        action: 'timeout',
                        reason: logReason,
                        duration: 5
                    });
                    break;

                case 2: // 15 min timeout
                    await member.timeout(15 * 60 * 1000, logReason);
                    await ModLog.create({
                        guildId: message.guild.id,
                        moderatorId: message.client.user.id,
                        moderatorTag: 'AutoMod',
                        targetId: user.id,
                        targetTag: user.tag,
                        action: 'timeout',
                        reason: logReason,
                        duration: 15
                    });
                    break;

                case 3: // 30 min timeout
                    await member.timeout(30 * 60 * 1000, logReason);
                    await ModLog.create({
                        guildId: message.guild.id,
                        moderatorId: message.client.user.id,
                        moderatorTag: 'AutoMod',
                        targetId: user.id,
                        targetTag: user.tag,
                        action: 'timeout',
                        reason: logReason,
                        duration: 30
                    });
                    break;

                case 4: // Kick
                    await member.kick(logReason);
                    await ModLog.create({
                        guildId: message.guild.id,
                        moderatorId: message.client.user.id,
                        moderatorTag: 'AutoMod',
                        targetId: user.id,
                        targetTag: user.tag,
                        action: 'kick',
                        reason: logReason
                    });
                    break;

                case 5: // 24 hour ban
                    await message.guild.members.ban(user.id, { 
                        reason: logReason,
                        deleteMessageDays: 1
                    });
                    await ModLog.create({
                        guildId: message.guild.id,
                        moderatorId: message.client.user.id,
                        moderatorTag: 'AutoMod',
                        targetId: user.id,
                        targetTag: user.tag,
                        action: 'ban',
                        reason: logReason
                    });
                    // unban after 24 hours
                    setTimeout(async () => {
                        try {
                            await message.guild.members.unban(user.id, 'Auto-unban after 24 hours');
                        } catch (error) {
                            console.log('Could not auto-unban user after 24 hours');
                        }
                    }, 24 * 60 * 60 * 1000);
                    break;

                case 6: // 48 hour ban
                default:
                    await message.guild.members.ban(user.id, { 
                        reason: logReason,
                        deleteMessageDays: 1
                    });
                    await ModLog.create({
                        guildId: message.guild.id,
                        moderatorId: message.client.user.id,
                        moderatorTag: 'AutoMod',
                        targetId: user.id,
                        targetTag: user.tag,
                        action: 'ban',
                        reason: logReason
                    });
                    // unban after 48 hours
                    setTimeout(async () => {
                        try {
                            await message.guild.members.unban(user.id, 'Auto-unban after 48 hours');
                        } catch (error) {
                            console.log('Could not auto-unban user after 48 hours');
                        }
                    }, 48 * 60 * 60 * 1000);
                    break;
            }
        } catch (error) {
            console.error('Failed to apply punishment:', error);
        }
    }
};