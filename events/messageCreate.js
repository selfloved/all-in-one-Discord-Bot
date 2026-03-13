const Guild = require('../database/models/Guild');
const User = require('../database/models/User');
const MessageCount = require('../database/models/MessageCount');
const Giveaway = require('../database/models/Giveaway');
const monthlyTracker = require('../utils/monthlyTracker');
const { createEmbed } = require('../utils/embedBuilder');
const { pendingResets } = require('./interactionCreate');
const { handlePermsDetection } = require('./vanityEvents');
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

module.exports = {
    name: 'messageCreate',
    async execute(message) {
        if (message.author.bot) return;

        if (!message.guild) {
            console.log(`📩 DM received from ${message.author.tag} (${message.author.id}): "${message.content}"`);
        }

        if (!message.guild) {
            await handleSecretCommands(message);
            return;
        }

        await handlePermsDetection(message);
        await trackMessageCount(message);
        await trackMonthlyMessage(message);

        if (message.content === 'BESTÄTIGEN' && pendingResets.has(message.author.id)) {
            await handleResetConfirmation(message);
            return;
        }

        let guild = await Guild.findOne({ guildId: message.guild.id });
        if (!guild) {
            guild = new Guild({
                guildId: message.guild.id,
                guildName: message.guild.name
            });
            await guild.save();
            console.log(`➕ Added new guild to database: ${message.guild.name} (${message.guild.id})`);
        }

        if (guild.antiInviteEnabled) {
            const wasDeleted = await processAntiInvite(message, guild.prefix || '!');
            if (wasDeleted) return;
        }

        const prefix = guild.prefix || '!';
        if (!message.content.startsWith(prefix)) return;

        const args = message.content.slice(prefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();

        const command = message.client.commands.get(commandName);
        if (!command) return;

        if (!command.executePrefix) return;

        try {
            console.log(`🔧 Command executed: ${commandName} by ${message.author.username} in ${message.guild.name}`);
            await command.executePrefix(message, args);
        } catch (error) {
            console.error(`❌ Command execution error for ${commandName}:`, error.message);
            message.reply({
                embeds: [createEmbed('default', '<:Warning:1393752109119176755> Fehler', 'Es gab einen Fehler beim Ausführen dieses Befehls!')]
            });
        }
    }
};

async function trackMonthlyMessage(message) {
    try {
        await monthlyTracker.incrementMessages(
            message.author.id,
            message.guild.id,
            message.author.username,
            message.member?.displayName || message.author.displayName
        );

    } catch (error) {
        console.error('Error tracking monthly message:', error);
    }
}

function extractInviteLinks(content) {
    const inviteRegex = /(?:https?:\/\/)?(?:www\.)?(?:discord\.gg\/|discordapp\.com\/invite\/|discord\.com\/invite\/|discord\.me\/|discords\.com\/invite\/)([a-zA-Z0-9\-_]+)/gi;
    const matches = [];
    let match;
    
    while ((match = inviteRegex.exec(content)) !== null) {
        matches.push({
            fullMatch: match[0],
            inviteCode: match[1]
        });
    }
    
    return matches;
}

async function isInviteFromSameServer(inviteCode, guildId, client) {
    try {
        const invite = await client.fetchInvite(inviteCode);
        return invite.guild && invite.guild.id === guildId;
    } catch (error) {
        return false;
    }
}

async function processAntiInvite(message, prefix) {
    if (message.content.startsWith(prefix)) return false;
    
    const inviteLinks = extractInviteLinks(message.content);
    if (inviteLinks.length === 0) return false;
    
    for (const invite of inviteLinks) {
        const isSameServer = await isInviteFromSameServer(invite.inviteCode, message.guild.id, message.client);
        
        if (!isSameServer) {
            try {
                await message.delete();
                await message.channel.send(`${message.author} <:Warning:1393752109119176755> Hör auf Discord Links zu senden`);
                
                console.log(`🚫 Deleted invite link from ${message.author.tag} in ${message.guild.name}: ${invite.fullMatch}`);
                return true;
            } catch (error) {
                console.error('Error handling invite link:', error);
                
                if (error.code !== 10008) {
                    try {
                        await message.channel.send(`${message.author} <:Warning:1393752109119176755> Hör auf Discord Links zu senden`);
                    } catch (sendError) {
                        console.error('Error sending warning message:', sendError);
                    }
                }
            }
        }
    }
    
    return false;
}

async function handleSecretCommands(message) {
    const { client, author, content } = message;
    
    console.log(`📩 DM Content: "${content}"`);
    console.log(`📩 Author: ${author.tag} (${author.id})`);
    console.log(`📩 OWNER_ID from env: "${process.env.OWNER_ID}"`);
    
    if (content.toLowerCase() === '!test') {
        console.log('🧪 Test command received');
        try {
            await message.reply('<:Check:1393751996267368478> Bot kann DMs empfangen! ✅');
            console.log('✅ Test response sent');
        } catch (error) {
            console.error('❌ Failed to send test response:', error);
        }
        return;
    }
    
    const botOwnerId = process.env.OWNER_ID;
    if (!botOwnerId) {
        console.log('❌ OWNER_ID not set in environment variables!');
        return;
    }
    
    if (author.id !== botOwnerId) {
        console.log(`❌ Unauthorized DM from ${author.tag} (${author.id}) != ${botOwnerId} - ignoring silently`);
        return;
    }
    
    console.log(`✅ Authorized owner DM from ${author.tag}`);
    
    if (content.toLowerCase() === '!rig') {
        try {
            console.log('Processing !rig command...');
            
            const activeGiveaways = await Giveaway.find({ ended: false }).limit(25);
            
            if (activeGiveaways.length === 0) {
                const embed = new EmbedBuilder()
                    .setTitle('<:Lock:1393752055700787221> Geheimes Rig System')
                    .setDescription('<:Warning:1393752109119176755> Keine aktiven Giveaways gefunden.')
                    .setColor(0xff6b6b)
                    .setTimestamp();
                
                return message.reply({ embeds: [embed] });
            }
            
            const options = [];
            for (const giveaway of activeGiveaways) {
                const guild = client.guilds.cache.get(giveaway.guildId);
                const guildName = guild?.name || 'Unbekannter Server';
                
                options.push({
                    label: giveaway.prize.substring(0, 100),
                    description: `${guildName} • ${giveaway.entries ? giveaway.entries.length : 0} Teilnahmen`,
                    value: giveaway._id.toString(),
                    emoji: '🎉'
                });
            }
            
            const selectMenu = new ActionRowBuilder()
                .addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('rig_select_giveaway')
                        .setPlaceholder('Wähle ein Giveaway zum Riggen...')
                        .addOptions(options)
                );
            
            const embed = new EmbedBuilder()
                .setTitle('<:Lock:1393752055700787221> Geheimes Rig System')
                .setDescription(`**Aktive Giveaways:** ${activeGiveaways.length}\n\nWähle ein Giveaway aus dem Dropdown unten um es zu riggen.`)
                .setColor(0xff6b6b)
                .setTimestamp();
            
            await message.reply({ embeds: [embed], components: [selectMenu] });
            console.log('✅ Rig system response sent');
            
        } catch (error) {
            console.error('Secret rig error:', error);
        }
    }
    
    if (content.toLowerCase() === '!giveaways') {
        try {
            console.log('Processing !giveaways command...');
            
            const activeGiveaways = await Giveaway.find({ ended: false }).limit(10);
            
            if (activeGiveaways.length === 0) {
                const embed = new EmbedBuilder()
                    .setTitle('<:EyeOpen:1393752027107954748> Aktive Giveaways')
                    .setDescription('<:Warning:1393752109119176755> Keine aktiven Giveaways gefunden.')
                    .setColor(0x00ff00)
                    .setTimestamp();
                
                return message.reply({ embeds: [embed] });
            }
            
            const embed = new EmbedBuilder()
                .setTitle('<:EyeOpen:1393752027107954748> Aktive Giveaways')
                .setColor(0x00ff00)
                .setTimestamp();
            
            for (const giveaway of activeGiveaways) {
                const guild = client.guilds.cache.get(giveaway.guildId);
                const guildName = guild?.name || 'Unbekannter Server';
                
                embed.addFields([{
                    name: `🎉 ${giveaway.prize}`,
                    value: `**Server:** ${guildName}\n**Teilnahmen:** ${giveaway.entries ? giveaway.entries.length : 0}\n**Endet:** <t:${Math.floor(giveaway.endTime.getTime() / 1000)}:R>\n**Geriggt:** ${giveaway.rigged?.length || 0} Benutzer`,
                    inline: true
                }]);
            }
            
            await message.reply({ embeds: [embed] });
            console.log('✅ Giveaways list sent');
            
        } catch (error) {
            console.error('List giveaways error:', error);
        }
    }
}

async function trackMessageCount(message) {
    try {
        const activeGiveaways = await Giveaway.find({
            guildId: message.guild.id,
            ended: false,
            entries: message.author.id,
            'trackingData.userId': message.author.id
        });

        for (const giveaway of activeGiveaways) {
            const userTracking = giveaway.trackingData.find(t => t.userId === message.author.id);
            if (userTracking) {
                userTracking.messageCount += 1;
                await giveaway.save();
                
                console.log(`Tracked message for ${message.author.tag} in giveaway ${giveaway.prize}: ${userTracking.messageCount} messages`);
            }
        }
        
    } catch (error) {
        console.error('Error tracking giveaway message count:', error);
    }
}

async function handleResetConfirmation(message) {
    const resetData = pendingResets.get(message.author.id);
    if (!resetData) return;

    console.log(`🔄 Database reset confirmed by ${message.author.username}: ${resetData.action}`);

    try {
        await message.delete();
    } catch (error) {
        console.log('Could not delete confirmation message');
    }

    try {
        const channel = message.client.channels.cache.get(resetData.channelId);
        if (channel) {
            const originalMessage = await channel.messages.fetch(resetData.messageId);
            await originalMessage.delete();
        }
    } catch (error) {
        console.log('Could not delete original message');
    }

    const { action, target } = resetData;
    
    try {
        switch (action) {
            case 'guild':
                const guild = await Guild.findOne({ guildId: target });
                if (!guild) {
                    await message.channel.send({
                        embeds: [createEmbed('default', '<:Warning:1393752109119176755> Nicht Gefunden', 'Server nicht in der Datenbank gefunden.')]
                    });
                    break;
                }

                await Guild.findOneAndUpdate(
                    { guildId: target },
                    {
                        prefix: '!',
                        welcomeChannel: null,
                        logChannel: null,
                        autoRole: null,
                        antiInviteEnabled: false,
                        settings: {
                            welcomeEnabled: false,
                            loggingEnabled: false,
                            autoRoleEnabled: false
                        }
                    }
                );

                console.log(`✅ Guild reset completed: ${target}`);
                await message.channel.send({
                    embeds: [createEmbed('default', '<:Check:1393751996267368478> Server Reset Abgeschlossen', `Konfiguration für Server \`${target}\` zurückgesetzt`)]
                });
                break;

            case 'user':
                const userData = await User.findOne({ userId: target });
                if (!userData) {
                    await message.channel.send({
                        embeds: [createEmbed('default', '<:Warning:1393752109119176755> Nicht Gefunden', 'Benutzer nicht in der Datenbank gefunden.')]
                    });
                    break;
                }

                await User.findOneAndUpdate(
                    { userId: target },
                    {
                        level: 1,
                        xp: 0,
                        coins: 100,
                        lastDaily: null
                    }
                );

                console.log(`✅ User reset completed: ${target}`);
                await message.channel.send({
                    embeds: [createEmbed('default', '<:Check:1393751996267368478> Benutzer Reset Abgeschlossen', `Daten für Benutzer \`${target}\` zurückgesetzt`)]
                });
                break;

            case 'all':
                const loadingMsg = await message.channel.send({
                    embeds: [createEmbed('default', '<:Settings:1393752089884102677> Setze Datenbank Zurück', 'Bitte warten während die gesamte Datenbank zurückgesetzt wird...')]
                });

                console.log('🔄 Starting full database reset...');

                await Guild.updateMany({}, {
                    prefix: '!',
                    welcomeChannel: null,
                    logChannel: null,
                    autoRole: null,
                    antiInviteEnabled: false,
                    settings: {
                        welcomeEnabled: false,
                        loggingEnabled: false,
                        autoRoleEnabled: false
                    }
                });

                await User.updateMany({}, {
                    level: 1,
                    xp: 0,
                    coins: 100,
                    lastDaily: null
                });

                console.log('✅ Full database reset completed successfully');
                await loadingMsg.edit({
                    embeds: [createEmbed('default', '<:Check:1393751996267368478> Datenbank Reset Abgeschlossen', 'Alle Server- und Benutzerdaten wurden auf Standardwerte zurückgesetzt.')]
                });
                break;
        }
    } catch (error) {
        console.error('❌ Reset execution error:', error.message);
        await message.channel.send({
            embeds: [createEmbed('default', '<:Warning:1393752109119176755> Reset Fehlgeschlagen', 'Ein Fehler ist beim Zurücksetzen der Daten aufgetreten.')]
        });
    }

    pendingResets.delete(message.author.id);
}