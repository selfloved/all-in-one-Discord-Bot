const Giveaway = require('../database/models/Giveaway');

class GiveawayTracker {
    constructor(client) {
        this.client = client;
        this.statusCheckInterval = null;
        this.startTracking();
    }

    startTracking() {
        this.statusCheckInterval = setInterval(() => {
            this.checkAllUserStatuses();
        }, 5000);

        console.log('Giveaway tracking system started - Status checks every 5 seconds');
    }

    stopTracking() {
        if (this.statusCheckInterval) {
            clearInterval(this.statusCheckInterval);
            this.statusCheckInterval = null;
        }
    }

    async checkAllUserStatuses() {
        try {
            const activeGiveaways = await Giveaway.find({ 
                ended: false,
                'requirements.statusCheck': true,
                'trackingData.0': { $exists: true }
            });

            for (const giveaway of activeGiveaways) {
                if (!giveaway.trackingData || giveaway.trackingData.length === 0) continue;

                const guild = this.client.guilds.cache.get(giveaway.guildId);
                if (!guild) continue;

                let updated = false;

                for (const userData of giveaway.trackingData) {
                    try {
                        const member = await guild.members.fetch(userData.userId);
                        if (!member) continue;

                        const statusActivity = member.presence?.activities?.find(activity => activity.type === 4);
                        const currentStatus = statusActivity?.state || 'No custom status';
                        
                        if (userData.currentStatus !== currentStatus) {
                            userData.currentStatus = currentStatus;
                            userData.lastStatusCheck = new Date();
                            updated = true;
                        }

                        const inVoice = !!member.voice?.channel;
                        if (userData.inVoiceChat !== inVoice) {
                            userData.inVoiceChat = inVoice;
                            updated = true;
                        }

                    } catch (error) {
                    }
                }

                if (updated) {
                    await giveaway.save();
                }
            }

        } catch (error) {
            console.error('Error in status tracking:', error);
        }
    }
}

module.exports = GiveawayTracker;