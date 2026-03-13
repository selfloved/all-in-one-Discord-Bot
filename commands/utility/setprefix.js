const { PermissionFlagsBits } = require('discord.js');
const Guild = require('../../database/models/Guild');
const { createEmbed } = require('../../utils/embedBuilder');

module.exports = {
    name: 'setprefix',
    description: 'Change the bot\'s prefix for this server',
    usage: '!setprefix <new_prefix>',
    aliases: ['prefix', 'changeprefix'],
    category: 'utility',
    
    async executePrefix(message, args) {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return message.reply({
                embeds: [createEmbed('default', 'Access Denied', 'You need **Manage Server** permission to change the prefix.')]
            });
        }

        const newPrefix = args[0];
        if (!newPrefix) {
            let guild = await Guild.findOne({ guildId: message.guild.id });
            const currentPrefix = guild?.prefix || '!';
            
            return message.reply({
                embeds: [createEmbed('default', 'Current Prefix', 
                    `Current prefix: \`${currentPrefix}\`\n\n**Usage:** \`${currentPrefix}setprefix <new_prefix>\`\n**Example:** \`${currentPrefix}setprefix ?\``
                )]
            });
        }

        if (newPrefix.length > 5) {
            return message.reply({
                embeds: [createEmbed('default', 'Invalid Prefix', 'Prefix must be 5 characters or less.')]
            });
        }

        if (newPrefix.includes(' ')) {
            return message.reply({
                embeds: [createEmbed('default', 'Invalid Prefix', 'Prefix cannot contain spaces.')]
            });
        }

        let guild = await Guild.findOne({ guildId: message.guild.id });
        if (!guild) {
            guild = new Guild({
                guildId: message.guild.id,
                guildName: message.guild.name
            });
        }

        const oldPrefix = guild.prefix;
        guild.prefix = newPrefix;
        await guild.save();

        const embed = createEmbed('default', 'Prefix Updated', 
            `Successfully changed prefix from \`${oldPrefix}\` to \`${newPrefix}\`\n\nYou can now use: \`${newPrefix}help\``
        );

        await message.reply({ embeds: [embed] });
    }
};