const MonthlyStats = require('../database/models/MonthlyStats');

class MonthlyTracker {
    constructor() {
        this.userSessions = new Map();
    }

    getCurrentMonth() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    async incrementMessages(userId, guildId, username = null, displayName = null) {
        try {
            const month = this.getCurrentMonth();
            const today = new Date().getDate();
            
            await MonthlyStats.findOneAndUpdate(
                { userId, guildId, month },
                {
                    $inc: { messageCount: 1 },
                    $set: { 
                        lastMessageUpdate: new Date(),
                        username: username || undefined,
                        displayName: displayName || undefined,
                        year: new Date().getFullYear(),
                        monthNumber: new Date().getMonth() + 1
                    },
                    $push: {
                        dailyMessages: {
                            $each: [{ day: today, count: 1 }],
                            $slice: -31
                        }
                    }
                },
                { 
                    upsert: true, 
                    new: true,
                    setDefaultsOnInsert: true
                }
            );

            await this.consolidateDailyMessages(userId, guildId, month);

        } catch (error) {
            console.error('Error incrementing messages:', error);
        }
    }

    async startVoiceSession(userId, guildId, channelId, username = null, displayName = null) {
        try {
            const sessionKey = `${userId}-${guildId}`;
            const now = new Date();
            
            this.userSessions.set(sessionKey, {
                userId,
                guildId,
                channelId,
                startTime: now,
                lastUpdate: now
            });

            const month = this.getCurrentMonth();
            
            await MonthlyStats.findOneAndUpdate(
                { userId, guildId, month },
                {
                    $set: { 
                        lastVcUpdate: now,
                        username: username || undefined,
                        displayName: displayName || undefined,
                        year: new Date().getFullYear(),
                        monthNumber: new Date().getMonth() + 1
                    }
                },
                { 
                    upsert: true, 
                    new: true,
                    setDefaultsOnInsert: true
                }
            );

        } catch (error) {
            console.error('Error starting voice session:', error);
        }
    }

    async endVoiceSession(userId, guildId) {
        try {
            const sessionKey = `${userId}-${guildId}`;
            const session = this.userSessions.get(sessionKey);
            
            if (!session) return;

            const sessionDuration = Math.floor((Date.now() - session.startTime.getTime()) / 60000);
            
            if (sessionDuration > 0) {
                await this.addVoiceTime(userId, guildId, sessionDuration);
            }

            this.userSessions.delete(sessionKey);

        } catch (error) {
            console.error('Error ending voice session:', error);
        }
    }

    async addVoiceTime(userId, guildId, minutes) {
        try {
            const month = this.getCurrentMonth();
            const today = new Date().getDate();
            
            await MonthlyStats.findOneAndUpdate(
                { userId, guildId, month },
                {
                    $inc: { vcTimeMinutes: minutes },
                    $set: { 
                        lastVcUpdate: new Date(),
                        year: new Date().getFullYear(),
                        monthNumber: new Date().getMonth() + 1
                    },
                    $push: {
                        dailyVcTime: {
                            $each: [{ day: today, minutes: minutes }],
                            $slice: -31
                        }
                    }
                },
                { 
                    upsert: true, 
                    new: true,
                    setDefaultsOnInsert: true
                }
            );

            await this.consolidateDailyVcTime(userId, guildId, month);

        } catch (error) {
            console.error('Error adding voice time:', error);
        }
    }

    async consolidateDailyMessages(userId, guildId, month) {
        try {
            const user = await MonthlyStats.findOne({ userId, guildId, month });
            if (!user || !user.dailyMessages) return;

            const consolidated = new Map();
            
            for (const entry of user.dailyMessages) {
                const existing = consolidated.get(entry.day) || 0;
                consolidated.set(entry.day, existing + entry.count);
            }

            const newDailyMessages = Array.from(consolidated.entries()).map(([day, count]) => ({
                day,
                count
            }));

            await MonthlyStats.findOneAndUpdate(
                { userId, guildId, month },
                { $set: { dailyMessages: newDailyMessages } }
            );

        } catch (error) {
            console.error('Error consolidating daily messages:', error);
        }
    }

    async consolidateDailyVcTime(userId, guildId, month) {
        try {
            const user = await MonthlyStats.findOne({ userId, guildId, month });
            if (!user || !user.dailyVcTime) return;

            const consolidated = new Map();
            
            for (const entry of user.dailyVcTime) {
                const existing = consolidated.get(entry.day) || 0;
                consolidated.set(entry.day, existing + entry.minutes);
            }

            const newDailyVcTime = Array.from(consolidated.entries()).map(([day, minutes]) => ({
                day,
                minutes
            }));

            await MonthlyStats.findOneAndUpdate(
                { userId, guildId, month },
                { $set: { dailyVcTime: newDailyVcTime } }
            );

        } catch (error) {
            console.error('Error consolidating daily vc time:', error);
        }
    }

    async getTopUsers(guildId, type, limit = 10, month = null) {
        try {
            const currentMonth = month || this.getCurrentMonth();
            const sortField = type === 'messages' ? { messageCount: -1 } : { vcTimeMinutes: -1 };
            const filterField = type === 'messages' ? { messageCount: { $gt: 0 } } : { vcTimeMinutes: { $gt: 0 } };

            const topUsers = await MonthlyStats.find({
                guildId,
                month: currentMonth,
                ...filterField
            })
            .sort(sortField)
            .limit(limit);

            return topUsers;

        } catch (error) {
            console.error('Error getting top users:', error);
            return [];
        }
    }

    async getMonthlyStats(userId, guildId, month = null) {
        try {
            const currentMonth = month || this.getCurrentMonth();
            
            let stats = await MonthlyStats.findOne({
                userId,
                guildId,
                month: currentMonth
            });

            if (!stats) {
                stats = {
                    userId,
                    guildId,
                    month: currentMonth,
                    messageCount: 0,
                    vcTimeMinutes: 0,
                    dailyMessages: [],
                    dailyVcTime: []
                };
            }

            const sessionKey = `${userId}-${guildId}`;
            const currentSession = this.userSessions.get(sessionKey);
            
            if (currentSession) {
                const currentSessionMinutes = Math.floor((Date.now() - currentSession.startTime.getTime()) / 60000);
                stats.currentSession = {
                    isInVc: true,
                    channelId: currentSession.channelId,
                    currentSessionMinutes
                };
            }

            return stats;

        } catch (error) {
            console.error('Error getting monthly stats:', error);
            return {
                userId,
                guildId,
                month: month || this.getCurrentMonth(),
                messageCount: 0,
                vcTimeMinutes: 0,
                dailyMessages: [],
                dailyVcTime: []
            };
        }
    }

    async resetMonthlyStats(guildId) {
        try {
            console.log(`🔄 Resetting monthly stats for guild ${guildId}`);
            
            const result = await MonthlyStats.deleteMany({ guildId });
            
            console.log(`✅ Deleted ${result.deletedCount} monthly stat records for guild ${guildId}`);
            
            this.clearGuildSessions(guildId);
            
            return result.deletedCount;

        } catch (error) {
            console.error('Error resetting monthly stats:', error);
            throw error;
        }
    }

    clearGuildSessions(guildId) {
        const keysToDelete = [];
        
        for (const [key, session] of this.userSessions.entries()) {
            if (session.guildId === guildId) {
                keysToDelete.push(key);
            }
        }
        
        for (const key of keysToDelete) {
            this.userSessions.delete(key);
        }
        
        console.log(`🧹 Cleared ${keysToDelete.length} voice sessions for guild ${guildId}`);
    }

    async getGuildStats(guildId, month = null) {
        try {
            const currentMonth = month || this.getCurrentMonth();
            
            const totalStats = await MonthlyStats.aggregate([
                { $match: { guildId, month: currentMonth } },
                {
                    $group: {
                        _id: null,
                        totalMessages: { $sum: '$messageCount' },
                        totalVcTime: { $sum: '$vcTimeMinutes' },
                        activeUsers: { $sum: 1 }
                    }
                }
            ]);

            if (totalStats.length === 0) {
                return {
                    totalMessages: 0,
                    totalVcTime: 0,
                    activeUsers: 0
                };
            }

            return totalStats[0];

        } catch (error) {
            console.error('Error getting guild stats:', error);
            return {
                totalMessages: 0,
                totalVcTime: 0,
                activeUsers: 0
            };
        }
    }

    async cleanupOldSessions() {
        try {
            const now = Date.now();
            const sessionsToDelete = [];

            for (const [key, session] of this.userSessions.entries()) {
                const sessionAge = now - session.lastUpdate.getTime();
                
                if (sessionAge > 30 * 60 * 1000) {
                    const sessionDuration = Math.floor((now - session.startTime.getTime()) / 60000);
                    
                    if (sessionDuration > 0) {
                        await this.addVoiceTime(session.userId, session.guildId, sessionDuration);
                    }
                    
                    sessionsToDelete.push(key);
                }
            }

            for (const key of sessionsToDelete) {
                this.userSessions.delete(key);
            }

            if (sessionsToDelete.length > 0) {
                console.log(`🧹 Cleaned up ${sessionsToDelete.length} old voice sessions`);
            }

        } catch (error) {
            console.error('Error cleaning up old sessions:', error);
        }
    }

    getActiveSessions() {
        return {
            total: this.userSessions.size,
            sessions: Array.from(this.userSessions.entries()).map(([key, session]) => ({
                key,
                userId: session.userId,
                guildId: session.guildId,
                channelId: session.channelId,
                duration: Math.floor((Date.now() - session.startTime.getTime()) / 60000)
            }))
        };
    }
}

const monthlyTracker = new MonthlyTracker();

setInterval(() => {
    monthlyTracker.cleanupOldSessions();
}, 5 * 60 * 1000);

module.exports = monthlyTracker;