const Guild = require('../../database/models/Guild');
const { createEmbed } = require('../../utils/embedBuilder');

module.exports = {
    name: 'antiinvite',
    description: 'Enable or disable anti-invite protection',
    usage: 'antiinvite [enable/disable/test]',
    category: 'utility',
    permissions: ['ManageGuild'],
    
    async executePrefix(message, args) {
        if (!message.member.permissions.has('ManageGuild')) {
            return message.reply({
                embeds: [createEmbed('default', 'Missing Permissions', 'You need `Manage Server` permission to use this command.')]
            });
        }

        let guild = await Guild.findOne({ guildId: message.guild.id });
        if (!guild) {
            guild = new Guild({
                guildId: message.guild.id,
                guildName: message.guild.name
            });
            await guild.save();
        }

        const action = args[0]?.toLowerCase();

        const checkEmoji = '<:Check:1393751996267368478>';
        const warningEmoji = '<:Warning:1393752109119176755>';
        const settingsEmoji = '<:Settings:1393752089884102677>';

        if (!action) {
            const status = guild.antiInviteEnabled ? 'Enabled' : 'Disabled';
            const emoji = guild.antiInviteEnabled ? checkEmoji : warningEmoji;
            
            return message.reply(`${emoji} **${status}**`);
        }

        if (action === 'enable') {
            if (guild.antiInviteEnabled) {
                return message.reply(`${checkEmoji} **Already Enabled**`);
            }
            
            guild.antiInviteEnabled = true;
            await guild.save();
            
            console.log(`✅ Anti-invite enabled in ${message.guild.name} (${message.guild.id}) by ${message.author.tag}`);
            return message.reply(`${checkEmoji} **Enabled**`);
        }

        if (action === 'disable') {
            if (!guild.antiInviteEnabled) {
                return message.reply(`${warningEmoji} **Already Disabled**`);
            }
            
            guild.antiInviteEnabled = false;
            await guild.save();
            
            console.log(`❌ Anti-invite disabled in ${message.guild.name} (${message.guild.id}) by ${message.author.tag}`);
            return message.reply(`${warningEmoji} **Disabled**`);
        }

        if (action === 'test') {
            const testMessages = [
                'discord.gg/test123',
                'https://discord.gg/test456',
                'www.discord.gg/test789',
                'discordapp.com/invite/test111'
            ];
            
            // Import the function to test regex
            function testExtractInviteLinks(content) {
                const patterns = [
                    /discord\.gg\/([a-zA-Z0-9\-_]+)/gi,
                    /www\.discord\.gg\/([a-zA-Z0-9\-_]+)/gi,
                    /https?:\/\/discord\.gg\/([a-zA-Z0-9\-_]+)/gi,
                    /https?:\/\/www\.discord\.gg\/([a-zA-Z0-9\-_]+)/gi,
                    /discordapp\.com\/invite\/([a-zA-Z0-9\-_]+)/gi,
                    /www\.discordapp\.com\/invite\/([a-zA-Z0-9\-_]+)/gi,
                    /https?:\/\/discordapp\.com\/invite\/([a-zA-Z0-9\-_]+)/gi,
                    /https?:\/\/www\.discordapp\.com\/invite\/([a-zA-Z0-9\-_]+)/gi,
                    /discord\.com\/invite\/([a-zA-Z0-9\-_]+)/gi,
                    /www\.discord\.com\/invite\/([a-zA-Z0-9\-_]+)/gi,
                    /https?:\/\/discord\.com\/invite\/([a-zA-Z0-9\-_]+)/gi,
                    /https?:\/\/www\.discord\.com\/invite\/([a-zA-Z0-9\-_]+)/gi,
                    /discord\.me\/([a-zA-Z0-9\-_]+)/gi,
                    /discords\.com\/invite\/([a-zA-Z0-9\-_]+)/gi
                ];
                
                const matches = [];
                
                for (const pattern of patterns) {
                    let match;
                    while ((match = pattern.exec(content)) !== null) {
                        matches.push({
                            fullMatch: match[0],
                            inviteCode: match[1]
                        });
                    }
                    pattern.lastIndex = 0;
                }
                
                return matches;
            }
            
            let testResults = `${settingsEmoji} **Test Results:**\n`;
            testResults += `Enabled: ${guild.antiInviteEnabled}\n\n`;
            
            for (const testMsg of testMessages) {
                const links = testExtractInviteLinks(testMsg);
                testResults += `\`${testMsg}\` → ${links.length} links found\n`;
            }
            
            return message.reply(testResults);
        }

        // Invalid argument
        return message.reply(`${settingsEmoji} **Usage:** \`antiinvite [enable/disable/test]\``);
    }
};