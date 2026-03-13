const { createEmbed } = require('../../utils/embedBuilder');
const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const emojis = {
    check: '<:Check:1393751996267368478>',
    warning: '<:Warning:1393752109119176755>',
    user: '<:User:1393752101687136269>',
    settings: '<:Settings:1393752089884102677>',
    deny: '<:Deny:1393752012054728784>',
    eyeOpen: '<:EyeOpen:1393752027107954748>'
};

module.exports = {
    name: 'help',
    description: 'Zeige alle verfügbaren Befehle an',
    usage: '!help [befehl]',
    aliases: ['commands', 'cmd', 'hilfe', 'befehle'],
    category: 'general',
    
    async executePrefix(message, args) {
        const Guild = require('../../database/models/Guild');
        
        let guild = await Guild.findOne({ guildId: message.guild.id });
        const prefix = guild?.prefix || '!';
        
        if (args[0]) {
            const commandName = args[0].toLowerCase();
            const command = message.client.commands.get(commandName);
            
            if (!command) {
                return message.reply({
                    embeds: [createEmbed('default', `${emojis.deny} Befehl Nicht Gefunden`, `Befehl \`${commandName}\` existiert nicht.`)]
                });
            }
            
            const embed = createEmbed('default', `${emojis.settings} Befehl: ${command.name}`, '');
            embed.addFields(
                { name: 'Beschreibung', value: command.description || 'Keine Beschreibung', inline: false },
                { name: 'Verwendung', value: command.usage?.replace('!', prefix) || `${prefix}${command.name}`, inline: true },
                { name: 'Kategorie', value: command.category || 'Unbekannt', inline: true }
            );
            
            if (command.aliases && command.aliases.length > 0) {
                embed.addFields({ name: 'Aliase', value: command.aliases.map(alias => `\`${alias}\``).join(', '), inline: true });
            }
            
            return message.reply({ embeds: [embed] });
        }
        
        const { embed, components } = buildMainHelp(message.client, message.guild, prefix);
        await message.reply({ embeds: [embed], components });
    }
};

function buildMainHelp(client, guild, prefix) {
    const embed = createEmbed('default', `${emojis.settings} Bot Befehle`, '');
    
    if (guild.iconURL()) {
        embed.setThumbnail(guild.iconURL({ dynamic: true, size: 256 }));
    }
    
    const commandsPath = path.join(__dirname, '../..');
    const commandsDir = path.join(commandsPath, 'commands');
    
    let commandFolders = [];
    try {
        if (fs.existsSync(commandsDir)) {
            commandFolders = fs.readdirSync(commandsDir)
                .filter(item => {
                    const itemPath = path.join(commandsDir, item);
                    return fs.lstatSync(itemPath).isDirectory();
                });
        }
    } catch (error) {
        console.log('Error reading commands directory:', error.message);
    }
    
    let totalCommands = 0;
    commandFolders.forEach(folder => {
        try {
            const folderPath = path.join(commandsDir, folder);
            if (fs.existsSync(folderPath)) {
                const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
                totalCommands += commandFiles.length;
            }
        } catch (error) {
            console.log(`Error reading folder ${folder}:`, error.message);
        }
    });
    
    embed.addFields(
        {
            name: `${emojis.settings} Bot Informationen`,
            value: [
                `**Server:** ${client.guilds.cache.size}`,
                `**${emojis.user} Benutzer:** ${client.users.cache.size}`,
                `**Befehle:** ${totalCommands}`,
                `**Prefix:** \`${prefix}\``
            ].join('\n'),
            inline: true
        },
        {
            name: `${emojis.eyeOpen} Server Informationen`,
            value: [
                `**Mitglieder:** ${guild.memberCount}`,
                `**Kanäle:** ${guild.channels.cache.size}`,
                `**Rollen:** ${guild.roles.cache.size}`,
                `**Uptime:** <t:${Math.floor((Date.now() - client.uptime) / 1000)}:R>`
            ].join('\n'),
            inline: true
        },
        {
            name: 'Verwendung',
            value: [
                `\`${prefix}help <befehl>\` - Befehl Details`,
                `\`${prefix}setprefix <prefix>\` - Prefix ändern`,
                `Wähle eine Kategorie unten um Befehle anzuzeigen`
            ].join('\n'),
            inline: false
        }
    );
    
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('help_category_select')
        .setPlaceholder('Wähle eine Kategorie um Befehle anzuzeigen');
    
    commandFolders.forEach(folder => {
        const categoryTitle = folder.charAt(0).toUpperCase() + folder.slice(1);
        let germanTitle = categoryTitle;
        
        switch (folder.toLowerCase()) {
            case 'general':
                germanTitle = 'Allgemein';
                break;
            case 'utility':
                germanTitle = 'Nützlich';
                break;
            case 'giveaway':
                germanTitle = 'Giveaway';
                break;
            case 'moderation':
                germanTitle = 'Moderation';
                break;
            case 'fun':
                germanTitle = 'Spaß';
                break;
            case 'economy':
                germanTitle = 'Wirtschaft';
                break;
            case 'music':
                germanTitle = 'Musik';
                break;
            case 'admin':
                germanTitle = 'Admin';
                break;
            case 'owner':
                germanTitle = 'Besitzer';
                break;
            case 'voicemaster':
                germanTitle = 'Voicemaster';
                break;
            default:
                germanTitle = categoryTitle;
        }
        
        selectMenu.addOptions({
            label: germanTitle,
            value: folder
        });
    });
    
    const components = [new ActionRowBuilder().addComponents(selectMenu)];
    
    return { embed, components };
}

module.exports.buildMainHelp = buildMainHelp;