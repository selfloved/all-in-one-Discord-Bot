const { PermissionFlagsBits } = require('discord.js');
const Warning = require('../../database/models/Warning');

module.exports = {
    name: 'unwarn',
    description: 'Clear all warnings for a user',
    usage: '!unwarn <user>',
    aliases: ['clearwarns'],
    category: 'mod',
    
    async executePrefix(message) {
        if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            return message.reply('<:Deny:1393752012054728784> You need Moderate Members permission');
        }

        const args = message.content.slice(message.content.indexOf(' ') + 1).split(' ');
        
        if (!args[0] || args[0] === message.content) {
            return message.reply('<:Warning:1393752109119176755> Please provide a user mention or ID');
        }

        let user;
        let userId;

        const userMention = args[0].match(/^<@!?(\d+)>$/);
        if (userMention) {
            userId = userMention[1];
        } else if (/^\d{17,19}$/.test(args[0])) {
            userId = args[0];
        } else {
            return message.reply('<:Warning:1393752109119176755> Please provide a valid user mention or ID');
        }

        try {
            user = await message.client.users.fetch(userId);
        } catch {
            return message.reply('<:Deny:1393752012054728784> Could not find user with that ID');
        }

        try {
            const result = await Warning.updateMany(
                { guildId: message.guild.id, userId: userId, active: true },
                { active: false }
            );

            if (result.modifiedCount === 0) {
                return message.reply(`${user.tag} has no active warnings to clear`);
            }

            message.reply(`Cleared ${result.modifiedCount} warning(s) for ${user.tag}`);

        } catch (error) {
            console.error(error);
            message.reply('<:Deny:1393752012054728784> Failed to clear warnings');
        }
    },
};