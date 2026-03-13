require('dotenv').config();

require('./utils/logSystem');

const { Client, GatewayIntentBits, Collection, Partials } = require('discord.js');
const { connectDB } = require('./database/connection');
const { loadCommands } = require('./handlers/commandHandler');
const { loadEvents } = require('./handlers/eventHandler');
const LeaderboardManager = require('./utils/leaderboardManager');
const { initializeVoiceTracking } = require('./utils/voiceInit');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageReactions
    ],
    partials: [
        Partials.Channel,
        Partials.Message
    ]
});

client.commands = new Collection();
client.leaderboardManager = new LeaderboardManager(client);

try {
    const voicemasterHandler = require('./handlers/voicemasterHandler.js');
    console.log('✅ Voicemaster handler loaded successfully');
} catch (error) {
    console.error('❌ Error loading voicemaster handler:', error);
}

async function startBot() {
    try {
        console.log('🚀 Starting bot initialization...');
        console.log(`🔑 Bot Owner ID: ${process.env.OWNER_ID}`);
        
        await connectDB();
        await loadCommands(client);
        await loadEvents(client);
        
        console.log('🔑 Logging into Discord...');
        await client.login(process.env.DISCORD_TOKEN);
        
    } catch (error) {
        console.error('Failed to start bot:', error);
    }
}

client.once('ready', async () => {
    console.log(`✅ ${client.user.tag} is online!`);
    
    await initializeVoiceTracking(client);
    
    if (client.leaderboardManager) {
        await client.leaderboardManager.initialize();
    }
});

startBot();