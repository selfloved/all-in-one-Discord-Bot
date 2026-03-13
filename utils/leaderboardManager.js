const Guild = require('../database/models/Guild');
const MonthlyStats = require('../database/models/MonthlyStats');
const LeaderboardHistory = require('../database/models/LeaderboardHistory');
const { generateLeaderboardEmbed, getCurrentMonth } = require('../commands/utility/leaderboard');
const monthlyTracker = require('./monthlyTracker');
const { EmbedBuilder } = require('discord.js');

class LeaderboardManager {
    constructor(client) {
        this.client = client;
        this.refreshIntervals = new Map();
        this.isInitialized = false;
    }

    async initialize() {
        if (this.isInitialized) return;
        
        console.log('🔄 Initializing Leaderboard Manager...');
        
        try {
            const guilds = await Guild.find({
                'leaderboard.enabled': true,
                'leaderboard.autoRefresh': true
            });

            console.log(`📋 Found ${guilds.length} guilds with auto-refresh enabled`);

            for (const guild of guilds) {
                await this.startAutoRefresh(guild);
            }

            this.isInitialized = true;
            console.log(`✅ Leaderboard Manager initialized for ${guilds.length} guilds`);
        } catch (error) {
            console.error('❌ Error initializing Leaderboard Manager:', error);
        }
    }

    async startAutoRefresh(guildConfig) {
        const guildId = guildConfig.guildId;
        const refreshInterval = (guildConfig.leaderboard.refreshInterval || 3) * 60 * 1000;
        
        if (this.refreshIntervals.has(guildId)) {
            clearInterval(this.refreshIntervals.get(guildId));
        }

        const intervalId = setInterval(async () => {
            console.log(`🔄 Auto-refreshing leaderboard for guild ${guildConfig.guildName} at ${new Date().toLocaleTimeString()}`);
            await this.refreshLeaderboard(guildConfig);
        }, refreshInterval);

        this.refreshIntervals.set(guildId, intervalId);
        
        console.log(`🔄 Auto-refresh started for guild ${guildConfig.guildName} (${guildId}) every ${guildConfig.leaderboard.refreshInterval || 3} minutes`);
        
        await this.refreshLeaderboard(guildConfig);
    }

    async stopAutoRefresh(guildId) {
        if (this.refreshIntervals.has(guildId)) {
            clearInterval(this.refreshIntervals.get(guildId));
            this.refreshIntervals.delete(guildId);
            console.log(`⏹️ Auto-refresh stopped for guild ${guildId}`);
        }
    }

    async refreshLeaderboard(guildConfig) {
        try {
            const guild = this.client.guilds.cache.get(guildConfig.guildId);
            if (!guild) {
                console.log(`⚠️ Guild ${guildConfig.guildId} not found, stopping auto-refresh`);
                this.stopAutoRefresh(guildConfig.guildId);
                return;
            }

            const channel = guild.channels.cache.get(guildConfig.leaderboard.channelId);
            if (!channel) {
                console.log(`⚠️ Leaderboard channel not found for guild ${guild.name}`);
                return;
            }

            let message = null;
            if (guildConfig.leaderboard.messageId) {
                try {
                    message = await channel.messages.fetch(guildConfig.leaderboard.messageId);
                } catch (error) {
                    console.log(`⚠️ Leaderboard message not found for guild ${guild.name}, creating new one`);
                }
            }

            const { embed, components, topMessageSenders, topVoiceUsers } = await generateLeaderboardEmbed(
                guildConfig.guildId, 
                guild
            );

            if (message) {
                await message.edit({ embeds: [embed], components });
                console.log(`✅ Updated existing leaderboard message for ${guild.name}`);
            } else {
                const newMessage = await channel.send({ embeds: [embed], components });
                
                await Guild.findOneAndUpdate(
                    { guildId: guildConfig.guildId },
                    { 
                        $set: { 
                            'leaderboard.messageId': newMessage.id,
                            'leaderboard.lastRefresh': new Date()
                        }
                    }
                );
                
                guildConfig.leaderboard.messageId = newMessage.id;
                console.log(`✅ Created new leaderboard message for ${guild.name}`);
            }

            await Guild.findOneAndUpdate(
                { guildId: guildConfig.guildId },
                { $set: { 'leaderboard.lastRefresh': new Date() } }
            );

            await this.checkAndAssignRewards(guildConfig, topMessageSenders, topVoiceUsers);

        } catch (error) {
            console.error(`❌ Error refreshing leaderboard for guild ${guildConfig.guildId}:`, error);
        }
    }

    async checkAndAssignRewards(guildConfig, topMessageSenders, topVoiceUsers) {
        try {
            const guild = this.client.guilds.cache.get(guildConfig.guildId);
            if (!guild) return;

            const currentMonth = getCurrentMonth();
            const lastMonth = guildConfig.leaderboard.currentMonth;

            if (currentMonth !== lastMonth) {
                console.log(`🎁 New month detected for guild ${guild.name}, processing month change from ${lastMonth} to ${currentMonth}`);
                
                await this.handleMonthlyTransition(guildConfig, lastMonth, currentMonth);
            } else {
                await this.assignCurrentRewards(guild, guildConfig, topMessageSenders, topVoiceUsers);
            }

        } catch (error) {
            console.error('❌ Error checking and assigning rewards:', error);
        }
    }

    async handleMonthlyTransition(guildConfig, lastMonth, currentMonth) {
        try {
            const guild = this.client.guilds.cache.get(guildConfig.guildId);
            if (!guild) return;

            console.log(`🔄 Processing monthly transition for ${guild.name}: ${lastMonth} → ${currentMonth}`);

            const lastMonthTopMessages = await MonthlyStats.find({
                guildId: guildConfig.guildId,
                month: lastMonth,
                messageCount: { $gt: 0 }
            }).sort({ messageCount: -1 }).limit(10);

            const lastMonthTopVoice = await MonthlyStats.find({
                guildId: guildConfig.guildId,
                month: lastMonth,
                vcTimeMinutes: { $gt: 0 }
            }).sort({ vcTimeMinutes: -1 }).limit(10);

            if (lastMonthTopMessages.length > 0 || lastMonthTopVoice.length > 0) {
                await this.saveMonthlyHistory(guildConfig.guildId, lastMonth, lastMonthTopMessages, lastMonthTopVoice);
                await this.assignFinalMonthlyRewards(guild, guildConfig, lastMonthTopMessages, lastMonthTopVoice, lastMonth);
                await this.sendMonthlyAnnouncement(guild, guildConfig, lastMonth, lastMonthTopMessages, lastMonthTopVoice);
            }

            await monthlyTracker.resetMonthlyStats(guildConfig.guildId);

            await Guild.findOneAndUpdate(
                { guildId: guildConfig.guildId },
                { $set: { 'leaderboard.currentMonth': currentMonth } }
            );
            
            guildConfig.leaderboard.currentMonth = currentMonth;

            console.log(`✅ Monthly transition completed for ${guild.name}`);

        } catch (error) {
            console.error('❌ Error handling monthly transition:', error);
        }
    }

    async saveMonthlyHistory(guildId, month, topMessages, topVoice) {
        try {
            const historyData = {
                guildId,
                month,
                topMessageSenders: topMessages.slice(0, 3).map(user => ({
                    userId: user.userId,
                    username: user.username || 'Unknown',
                    messageCount: user.messageCount
                })),
                topVoiceUsers: topVoice.slice(0, 3).map(user => ({
                    userId: user.userId,
                    username: user.username || 'Unknown',
                    vcTimeMinutes: user.vcTimeMinutes
                })),
                fullLeaderboard: {
                    messages: topMessages.slice(0, 10),
                    voice: topVoice.slice(0, 10)
                }
            };

            await LeaderboardHistory.findOneAndUpdate(
                { guildId, month },
                historyData,
                { upsert: true }
            );

            console.log(`📊 Saved history for ${month} in guild ${guildId}`);

        } catch (error) {
            console.error('❌ Error saving monthly history:', error);
        }
    }

    async assignCurrentRewards(guild, guildConfig, topMessageSenders, topVoiceUsers) {
        try {
            if (guildConfig.leaderboard.messageRewards?.enabled && topMessageSenders.length > 0) {
                await this.assignRoleRewards(guild, topMessageSenders, guildConfig.leaderboard.messageRewards, 'message');
            }

            if (guildConfig.leaderboard.vcRewards?.enabled && topVoiceUsers.length > 0) {
                await this.assignRoleRewards(guild, topVoiceUsers, guildConfig.leaderboard.vcRewards, 'voice');
            }

        } catch (error) {
            console.error('❌ Error assigning current rewards:', error);
        }
    }

    async assignFinalMonthlyRewards(guild, guildConfig, topMessages, topVoice, month) {
        try {
            if (guildConfig.leaderboard.messageRewards?.enabled && topMessages.length > 0) {
                await this.assignRoleRewards(guild, topMessages, guildConfig.leaderboard.messageRewards, 'message', true);
            }

            if (guildConfig.leaderboard.vcRewards?.enabled && topVoice.length > 0) {
                await this.assignRoleRewards(guild, topVoice, guildConfig.leaderboard.vcRewards, 'voice', true);
            }

        } catch (error) {
            console.error('❌ Error assigning final monthly rewards:', error);
        }
    }

    async assignRoleRewards(guild, topUsers, rewardsConfig, type, isFinal = false) {
        try {
            const roles = rewardsConfig.roles;
            if (!roles) return;

            const positionRoles = [
                roles.first || [],
                roles.second || [],
                roles.third || []
            ];

            const allTop3Roles = roles.allTop3 || [];

            for (let position = 0; position < 3 && position < topUsers.length; position++) {
                const user = topUsers[position];
                const member = guild.members.cache.get(user.userId);
                
                if (!member) continue;

                const positionRoleIds = positionRoles[position];
                for (const roleId of positionRoleIds) {
                    const role = guild.roles.cache.get(roleId);
                    if (role && !member.roles.cache.has(roleId)) {
                        try {
                            await member.roles.add(role);
                            console.log(`🏆 Added ${type} reward role (${position + 1}. place) to ${member.user.tag}${isFinal ? ' [FINAL]' : ''}`);
                        } catch (error) {
                            console.error(`❌ Error adding role to ${member.user.tag}:`, error);
                        }
                    }
                }

                for (const roleId of allTop3Roles) {
                    const role = guild.roles.cache.get(roleId);
                    if (role && !member.roles.cache.has(roleId)) {
                        try {
                            await member.roles.add(role);
                            console.log(`🏆 Added ${type} top3 reward role to ${member.user.tag}${isFinal ? ' [FINAL]' : ''}`);
                        } catch (error) {
                            console.error(`❌ Error adding top3 role to ${member.user.tag}:`, error);
                        }
                    }
                }
            }

        } catch (error) {
            console.error('❌ Error assigning role rewards:', error);
        }
    }

    async sendMonthlyAnnouncement(guild, guildConfig, previousMonth, topMessages, topVoice) {
        try {
            const channel = guild.channels.cache.get(guildConfig.leaderboard.channelId);
            if (!channel) return;

            const monthName = this.formatMonthName(previousMonth);
            const currentMonthName = this.formatMonthName(getCurrentMonth());
            
            let winnersText = '';

            if (topMessages.length > 0) {
                const topMsgUser = guild.members.cache.get(topMessages[0].userId);
                if (topMsgUser) {
                    winnersText += `📱 **Nachrichten Champion:** ${topMsgUser} (${topMessages[0].messageCount.toLocaleString()} Nachrichten)\n`;
                }
            }

            if (topVoice.length > 0) {
                const topVcUser = guild.members.cache.get(topVoice[0].userId);
                if (topVcUser) {
                    const hours = Math.floor(topVoice[0].vcTimeMinutes / 60);
                    const minutes = topVoice[0].vcTimeMinutes % 60;
                    winnersText += `🎤 **Voice Champion:** ${topVcUser} (${hours}h ${minutes}m)\n`;
                }
            }
            
            const embed = new EmbedBuilder()
                .setTitle('🎉 Monatliche Sieger!')
                .setDescription(`**${monthName}** ist vorbei!\n\n${winnersText}\n**${currentMonthName}** hat begonnen - viel Erfolg!`)
                .setColor('#FFD700')
                .setTimestamp()
                .setThumbnail(guild.iconURL({ dynamic: true }));

            await channel.send({ embeds: [embed] });

        } catch (error) {
            console.error('❌ Error sending monthly announcement:', error);
        }
    }

    formatMonthName(monthString) {
        const [year, month] = monthString.split('-');
        const monthNames = [
            'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
            'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
        ];
        return `${monthNames[parseInt(month) - 1]} ${year}`;
    }

    async updateGuildConfig(guildId) {
        try {
            const guildConfig = await Guild.findOne({ guildId });
            if (!guildConfig) return;

            if (guildConfig.leaderboard.enabled && guildConfig.leaderboard.autoRefresh) {
                await this.startAutoRefresh(guildConfig);
                console.log(`🔄 Restarted auto-refresh for guild ${guildId}`);
            } else {
                await this.stopAutoRefresh(guildId);
                console.log(`⏹️ Stopped auto-refresh for guild ${guildId}`);
            }

        } catch (error) {
            console.error('❌ Error updating guild config:', error);
        }
    }

    async forceRefresh(guildId) {
        try {
            const guildConfig = await Guild.findOne({ guildId });
            if (!guildConfig) return false;

            await this.refreshLeaderboard(guildConfig);
            console.log(`🔄 Force refreshed leaderboard for guild ${guildId}`);
            return true;

        } catch (error) {
            console.error('❌ Error forcing refresh:', error);
            return false;
        }
    }

    getStatus() {
        return {
            isInitialized: this.isInitialized,
            activeRefreshes: this.refreshIntervals.size,
            guilds: Array.from(this.refreshIntervals.keys())
        };
    }

    shutdown() {
        console.log('🔄 Shutting down Leaderboard Manager...');
        
        for (const [guildId, intervalId] of this.refreshIntervals) {
            clearInterval(intervalId);
            console.log(`⏹️ Stopped interval for guild ${guildId}`);
        }
        
        this.refreshIntervals.clear();
        this.isInitialized = false;
        
        console.log('✅ Leaderboard Manager shutdown complete');
    }
}

module.exports = LeaderboardManager;