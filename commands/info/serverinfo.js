// serverinfo
const Guild = require('../../database/models/Guild');
const { createEmbed } = require('../../utils/embedBuilder');

module.exports = {
    name: 'serverinfo',
    description: 'Display detailed server information',
    usage: '!serverinfo',
    aliases: ['server', 'guildinfo', 'si'],
    category: 'info',
    
    async executePrefix(message) {
        const embed = await buildServerInfoEmbed(message.guild, message.client, message.author);
        await message.reply({ embeds: [embed] });
    }
};

async function buildServerInfoEmbed(guild, client, author) {
    const embed = createEmbed('info', '', '');

    const totalMembers = guild.memberCount;
    const botCount = guild.members.cache.filter(member => member.user.bot).size;
    const humanCount = totalMembers - botCount;

    const textChannels = guild.channels.cache.filter(c => c.type === 0).size;
    const voiceChannels = guild.channels.cache.filter(c => c.type === 2).size;
    const categoryChannels = guild.channels.cache.filter(c => c.type === 4).size;
    const totalChannels = guild.channels.cache.size;

    const verificationLevels = ['None', 'Low', 'Medium', 'High', 'Very High'];
    const verification = verificationLevels[guild.verificationLevel] || 'Unknown';

    const createdDate = new Date(guild.createdTimestamp);
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                      'July', 'August', 'September', 'October', 'November', 'December'];
    const createdString = `${createdDate.getDate().toString().padStart(2, '0')} ${monthNames[createdDate.getMonth()]} ${createdDate.getFullYear()}`;
    const daysAgo = Math.floor((Date.now() - guild.createdTimestamp) / (1000 * 60 * 60 * 24));

    const shardId = guild.shardId || 0;
    const totalShards = client.ws.shards.size || 1;

    embed.setAuthor({
        name: `${author.displayName}`,
        iconURL: author.displayAvatarURL({ dynamic: true })
    });

    embed.setTitle(`${guild.name}`);
    if (guild.iconURL()) {
        embed.setThumbnail(guild.iconURL({ dynamic: true, size: 256 }));
    }

    embed.addFields(
        {
            name: 'Server Info',
            value: [
                `**Created:** ${createdString}`,
                `**Days Ago:** ${daysAgo.toLocaleString()}`,
                `**Owner:** <@${guild.ownerId}>`,
                `**Region:** Auto`,
                `**Verification:** ${verification}`
            ].join('\n'),
            inline: true
        },
        {
            name: 'Statistics',
            value: [
                `**Total Members:** ${totalMembers.toLocaleString()}`,
                `**Humans:** ${humanCount.toLocaleString()}`,
                `**Bots:** ${botCount.toLocaleString()}`,
                `**Roles:** ${guild.roles.cache.size}`,
                `**Emojis:** ${guild.emojis.cache.size}`
            ].join('\n'),
            inline: true
        },
        {
            name: 'Channels',
            value: [
                `**Total:** ${totalChannels}`,
                `**Text:** ${textChannels}`,
                `**Voice:** ${voiceChannels}`,
                `**Categories:** ${categoryChannels}`,
                `**AFK Timeout:** ${guild.afkTimeout ? `${guild.afkTimeout / 60}m` : 'None'}`
            ].join('\n'),
            inline: true
        },
        {
            name: 'Boost Status',
            value: [
                `**Level:** ${guild.premiumTier}`,
                `**Boosts:** ${guild.premiumSubscriptionCount || 0}`,
                `**Boosters:** ${guild.premiumSubscriptionCount || 0}`,
                `**Max File Size:** ${guild.premiumTier === 0 ? '8MB' : guild.premiumTier === 1 ? '8MB' : guild.premiumTier === 2 ? '50MB' : '100MB'}`,
                `**Max Emoji:** ${guild.premiumTier === 0 ? '50' : guild.premiumTier === 1 ? '100' : guild.premiumTier === 2 ? '150' : '250'}`
            ].join('\n'),
            inline: true
        },
        {
            name: 'Features',
            value: [
                guild.features.includes('COMMUNITY') ? '✅ Community' : '❌ Community',
                guild.features.includes('PARTNERED') ? '✅ Partnered' : '❌ Partnered',
                guild.features.includes('VERIFIED') ? '✅ Verified' : '❌ Verified',
                guild.features.includes('VANITY_URL') ? '✅ Vanity URL' : '❌ Vanity URL',
                guild.features.includes('DISCOVERABLE') ? '✅ Discoverable' : '❌ Discoverable'
            ].join('\n'),
            inline: true
        },
        {
            name: 'Technical',
            value: [
                `**Guild ID:** \`${guild.id}\``,
                `**Shard ID:** ${shardId}/${totalShards}`,
                `**Large Guild:** ${guild.large ? 'Yes' : 'No'}`,
                `**NSFW Level:** ${guild.nsfwLevel}`,
                `**Premium Tier:** ${guild.premiumTier}`
            ].join('\n'),
            inline: true
        }
    );

    if (guild.bannerURL()) {
        embed.setImage(guild.bannerURL({ dynamic: true, size: 1024 }));
    }

    embed.setFooter({ 
        text: `Requested at ${new Date().toLocaleTimeString()}`,
        iconURL: client.user.displayAvatarURL()
    });

    return embed;
}