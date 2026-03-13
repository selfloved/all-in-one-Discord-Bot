// commands/owner/restart.js
const { createEmbed } = require('../../utils/embedBuilder');

const OWNER_ID = '716042573772226580';

module.exports = {
    name: 'restart',
    description: 'Restart the bot (Bot owner only)',
    usage: '!restart',
    aliases: ['reboot', 'reload'],
    category: 'owner',
    
    async executePrefix(message) {
        if (message.author.id !== OWNER_ID) {
            return message.reply({
                embeds: [createEmbed('default', 'Access Denied', 'This command is restricted to the bot owner.')]
            });
        }

        console.log(`🔄 Bot restart initiated by ${message.author.username}`);
        
        const loadingEmoji = '<a:Loading_animated:1389025227979358208>';
        
        await message.reply({
            embeds: [createEmbed('default', `${loadingEmoji} Restarting`, '')]
        });

        console.log('🔄 Shutting down bot for restart...');
        
        setTimeout(() => {
            process.exit(1);
        }, 1000);
    }
};