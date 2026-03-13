const Guild = require('../database/models/Guild');

module.exports = {
    name: 'guildCreate',
    async execute(guild) {
        try {
            const existingGuild = await Guild.findOne({ guildId: guild.id });
            
            if (!existingGuild) {
                const newGuild = new Guild({
                    guildId: guild.id,
                    guildName: guild.name
                });
                
                await newGuild.save();
                console.log(`✅ Added new guild to database: ${guild.name}`);
            }
        } catch (error) {
            console.error('Error adding guild to database:', error);
        }
    }
};