const { PermissionFlagsBits } = require('discord.js');

const LOCK_ROLE_ID = '';

module.exports = {
    name: 'perms',
    description: 'Debug channel permissions',
    usage: '!perms',
    aliases: [],
    category: 'mod',
    
    async executePrefix(message) {
        const channel = message.channel;
        const everyoneRole = message.guild.roles.everyone;
        const lockRole = message.guild.roles.cache.get(LOCK_ROLE_ID);
        
        console.log('=== CHANNEL PERMISSION DEBUG ===');
        console.log(`Channel: ${channel.name}`);
        
        const everyoneOverwrite = channel.permissionOverwrites.cache.get(everyoneRole.id);
        console.log('Everyone overwrites:', {
            exists: !!everyoneOverwrite,
            deny: everyoneOverwrite?.deny.toArray() || 'none',
            allow: everyoneOverwrite?.allow.toArray() || 'none'
        });
        
        const lockRoleOverwrite = channel.permissionOverwrites.cache.get(LOCK_ROLE_ID);
        console.log('Lock role overwrites:', {
            exists: !!lockRoleOverwrite,
            deny: lockRoleOverwrite?.deny.toArray() || 'none',
            allow: lockRoleOverwrite?.allow.toArray() || 'none'
        });
        
        const userCanSend = channel.permissionsFor(message.member).has(PermissionFlagsBits.SendMessages);
        console.log(`User ${message.author.tag} can send messages: ${userCanSend}`);
        
        const everyoneCanSend = channel.permissionsFor(everyoneRole).has(PermissionFlagsBits.SendMessages);
        console.log(`@everyone can send messages: ${everyoneCanSend}`);
        
        console.log('All channel overwrites:');
        channel.permissionOverwrites.cache.forEach((overwrite, id) => {
            const target = message.guild.roles.cache.get(id) || message.guild.members.cache.get(id);
            console.log(`  ${target?.name || target?.user?.tag || id}:`, {
                deny: overwrite.deny.toArray(),
                allow: overwrite.allow.toArray()
            });
        });
        
        message.reply(`Check console for detailed permission debug info for #${channel.name}`);
    },
};