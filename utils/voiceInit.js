const VCTime = require('../database/models/VCTime');

async function initializeVoiceTracking(client) {
    console.log('🎤 Initializing voice tracking for existing voice channel members...');
    
    let totalInitialized = 0;
    
    try {
        for (const [guildId, guild] of client.guilds.cache) {
            let guildInitialized = 0;
            
            for (const [channelId, channel] of guild.channels.cache) {
                if (channel.isVoiceBased() && channel.members.size > 0) {
                    for (const [memberId, member] of channel.members) {
                        if (member.user.bot) continue;
                        
                        try {
                            let vcData = await VCTime.findOne({ 
                                userId: memberId, 
                                guildId: guildId 
                            });
                            
                            if (!vcData) {
                                vcData = new VCTime({
                                    userId: memberId,
                                    guildId: guildId,
                                    totalTime: 0,
                                    currentSession: {}
                                });
                            }
                            
                            if (!vcData.currentSession || !vcData.currentSession.startTime) {
                                vcData.currentSession = {
                                    channelId: channelId,
                                    startTime: new Date()
                                };
                                
                                await vcData.save();
                                guildInitialized++;
                                totalInitialized++;
                                
                                console.log(`📊 Initialized tracking for ${member.user.username} in ${channel.name} (${guild.name})`);
                            }
                            
                        } catch (error) {
                            console.error(`Error initializing voice tracking for ${member.user.username}:`, error);
                        }
                    }
                }
            }
            
            if (guildInitialized > 0) {
                console.log(`✅ Initialized ${guildInitialized} voice members in ${guild.name}`);
            }
        }
        
        console.log(`🎤 Voice tracking initialization complete: ${totalInitialized} members initialized`);
        
    } catch (error) {
        console.error('Error during voice tracking initialization:', error);
    }
}

module.exports = { initializeVoiceTracking };