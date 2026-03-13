const mongoose = require('mongoose');
const Guild = require('../database/models/Guild');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/your-database-name';

async function migrateGreetingSchema() {
    console.log('🔄 Starting greeting schema migration...');
    
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const result = await Guild.updateMany(
            {}, 
            {
                $set: {

                    "greeting.mentionUser": true,
                    "greeting.buttonEnabled": false,
                    "greeting.buttonText": "Join VC", 
                    "greeting.buttonChannelId": null,
                    "greeting.totalGreetings": 0
                }
            },
            {
                upsert: false
            }
        );

        console.log(`✅ Migration completed successfully!`);
        console.log(`📊 Modified ${result.modifiedCount} guild documents`);
        console.log(`📋 Matched ${result.matchedCount} total guild documents`);
        
        const sampleGuild = await Guild.findOne({});
        if (sampleGuild && sampleGuild.greeting) {
            console.log('🔍 Sample guild greeting config:');
            console.log({
                mentionUser: sampleGuild.greeting.mentionUser,
                buttonEnabled: sampleGuild.greeting.buttonEnabled,
                buttonText: sampleGuild.greeting.buttonText,
                buttonChannelId: sampleGuild.greeting.buttonChannelId,
                totalGreetings: sampleGuild.greeting.totalGreetings
            });
        }

        console.log('🎉 Greeting schema migration complete!');
        console.log('💡 You can now restart your bot and use the new greeting features.');
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
        console.log('🔌 Database connection closed');
        process.exit(0);
    }
}

migrateGreetingSchema();