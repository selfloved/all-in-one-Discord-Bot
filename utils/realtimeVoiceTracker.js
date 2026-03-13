const VCTime = require('../database/models/VCTime');
const monthlyTracker = require('./monthlyTracker');

class RealtimeVoiceTracker {
    constructor() {
        this.activeUsers = new Map();
        this.updateInterval = null;
        this.intervalMinutes = 1;
        this.isRunning = false;
    }

    start() {
        if (this.isRunning) return;
        
        console.log('🎤 Starting real-time voice tracker...');
        this.isRunning = true;
        
        this.updateInterval = setInterval(async () => {
            await this.updateAllActiveSessions();
        }, this.intervalMinutes * 60 * 1000);
        
        console.log(`✅ Real-time voice tracker started (updates every ${this.intervalMinutes} minute(s))`);
    }

    stop() {
        if (!this.isRunning) return;
        
        console.log('🛑 Stopping real-time voice tracker...');
        
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        
        this.isRunning = false;
        console.log('✅ Real-time voice tracker stopped');
    }

    async addUser(userId, guildId, channelId, username, displayName) {
        const key = `${guildId}-${userId}`;
        
        this.activeUsers.set(key, {
            userId,
            guildId,
            channelId,
            username,
            displayName,
            startTime: new Date(),
            lastUpdate: new Date()
        });

        try {
            let vcData = await VCTime.findOne({ userId, guildId });
            if (!vcData) {
                vcData = new VCTime({
                    userId,
                    guildId,
                    totalTime: 0,
                    currentSession: {}
                });
            }

            vcData.currentSession = {
                channelId: channelId,
                startTime: new Date()
            };

            await vcData.save();
            
            await monthlyTracker.startVoiceSession(userId, guildId, channelId, username, displayName);
            
            console.log(`📊 REALTIME: Added ${username} to tracking (${guildId})`);
        } catch (error) {
            console.error('Error adding user to realtime tracking:', error);
        }
    }

    async removeUser(userId, guildId, username) {
        const key = `${guildId}-${userId}`;
        const userData = this.activeUsers.get(key);
        
        if (userData) {
            const sessionMinutes = Math.floor((new Date() - userData.startTime) / 60000);
            
            if (sessionMinutes > 0) {
                try {
                    await monthlyTracker.addVoiceTime(userId, guildId, sessionMinutes);
                    console.log(`📊 REALTIME: Tracked final ${sessionMinutes} minutes for ${username}`);
                } catch (error) {
                    console.error('Error tracking final session time:', error);
                }
            }
            
            this.activeUsers.delete(key);
        }

        try {
            let vcData = await VCTime.findOne({ userId, guildId });
            if (vcData && vcData.currentSession && vcData.currentSession.startTime) {
                const totalSessionMinutes = Math.floor((new Date() - vcData.currentSession.startTime) / 60000);
                if (totalSessionMinutes > 0) {
                    vcData.totalTime += totalSessionMinutes;
                }
                vcData.currentSession = {};
                await vcData.save();
            }
            
            await monthlyTracker.endVoiceSession(userId, guildId);
            
        } catch (error) {
            console.error('Error updating database on user remove:', error);
        }

        console.log(`📊 REALTIME: Removed ${username} from tracking (${guildId})`);
    }

    async updateUser(userId, guildId, newChannelId, username, displayName) {
        const key = `${guildId}-${userId}`;
        const userData = this.activeUsers.get(key);
        
        if (userData) {
            userData.channelId = newChannelId;
            userData.username = username;
            userData.displayName = displayName;
            
            try {
                await VCTime.findOneAndUpdate(
                    { userId, guildId },
                    { $set: { 'currentSession.channelId': newChannelId } }
                );
                console.log(`📊 REALTIME: Updated ${username} channel to ${newChannelId}`);
            } catch (error) {
                console.error('Error updating user channel:', error);
            }
        }
    }

    async updateAllActiveSessions() {
        if (this.activeUsers.size === 0) return;
        
        const now = new Date();
        const updates = [];
        
        for (const [key, userData] of this.activeUsers) {
            const timeSinceLastUpdate = Math.floor((now - userData.lastUpdate) / 60000);
            
            if (timeSinceLastUpdate >= this.intervalMinutes) {
                const sessionMinutes = Math.floor((now - userData.startTime) / 60000);
                const minutesToAdd = Math.floor((now - userData.lastUpdate) / 60000);
                
                if (minutesToAdd > 0) {
                    updates.push({
                        userId: userData.userId,
                        guildId: userData.guildId,
                        minutes: minutesToAdd,
                        username: userData.username,
                        displayName: userData.displayName
                    });
                    
                    userData.lastUpdate = now;
                }
            }
        }

        if (updates.length > 0) {
            console.log(`📊 REALTIME: Processing ${updates.length} voice time updates...`);
            
            for (const update of updates) {
                try {
                    await monthlyTracker.addVoiceTime(
                        update.userId, 
                        update.guildId, 
                        update.minutes
                    );
                } catch (error) {
                    console.error(`Error updating voice time for ${update.username}:`, error);
                }
            }
        }
    }

    async initializeFromGuilds(client) {
        console.log('🔄 Initializing real-time voice tracker from existing voice members...');
        let totalInitialized = 0;
        
        try {
            for (const [guildId, guild] of client.guilds.cache) {
                for (const [channelId, channel] of guild.channels.cache) {
                    if (channel.isVoiceBased() && channel.members.size > 0) {
                        for (const [memberId, member] of channel.members) {
                            if (member.user.bot) continue;
                            
                            await this.addUser(
                                memberId,
                                guildId,
                                channelId,
                                member.user.username,
                                member.displayName
                            );
                            totalInitialized++;
                        }
                    }
                }
            }
            
            console.log(`✅ Initialized ${totalInitialized} users in real-time voice tracker`);
        } catch (error) {
            console.error('Error initializing real-time voice tracker:', error);
        }
    }

    getActiveUsers() {
        return Array.from(this.activeUsers.values());
    }

    getStatus() {
        return {
            isRunning: this.isRunning,
            activeUsers: this.activeUsers.size,
            intervalMinutes: this.intervalMinutes,
            users: this.getActiveUsers()
        };
    }

    async forceUpdateAll() {
        console.log('🔄 Force updating all active voice sessions...');
        
        for (const [key, userData] of this.activeUsers) {
            const now = new Date();
            const minutesToAdd = Math.floor((now - userData.lastUpdate) / 60000);
            
            if (minutesToAdd > 0) {
                try {
                    await monthlyTracker.addVoiceTime(
                        userData.userId,
                        userData.guildId,
                        minutesToAdd
                    );
                    userData.lastUpdate = now;
                    console.log(`📊 Force updated ${minutesToAdd} minutes for ${userData.username}`);
                } catch (error) {
                    console.error(`Error force updating ${userData.username}:`, error);
                }
            }
        }
        
        console.log(`✅ Force update completed for ${this.activeUsers.size} users`);
    }
}

module.exports = new RealtimeVoiceTracker();