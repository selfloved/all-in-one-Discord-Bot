const { Events, ChannelType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { Voicemaster, TempChannel, VoicePermit, VoiceBan } = require('../database/models/Voicemaster');
const realtimeVoiceTracker = require('../utils/realtimeVoiceTracker');

module.exports = {
    name: Events.VoiceStateUpdate,
    async execute(oldState, newState) {
        await handleRealtimeVoiceTracking(oldState, newState);
        await logVoiceStateChange(oldState, newState);

        if (newState.channelId && !oldState.channelId) {
            await handleJoinVoicemaster(newState);
        }

        if (oldState.channelId && !newState.channelId) {
            await handleLeaveTempChannel(oldState);
        }

        if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
            await handleLeaveTempChannel(oldState);
            await handleJoinVoicemaster(newState);
        }

        if (newState.channelId) {
            await handleBannedUser(newState);
        }
    }
};

async function handleRealtimeVoiceTracking(oldState, newState) {
    if (newState.member.user.bot) return;
    
    const userId = newState.member.id;
    const guildId = newState.guild.id;
    const username = newState.member.user.username;
    const displayName = newState.member.displayName;
    
    if (!oldState.channelId && newState.channelId) {
        await realtimeVoiceTracker.addUser(userId, guildId, newState.channelId, username, displayName);
        console.log(`📊 REALTIME: ${username} joined ${newState.channel.name} - real-time tracking started`);
    }
    
    else if (oldState.channelId && !newState.channelId) {
        await realtimeVoiceTracker.removeUser(userId, guildId, username);
        console.log(`📊 REALTIME: ${username} left voice - real-time tracking stopped`);
    }
    
    else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
        await realtimeVoiceTracker.updateUser(userId, guildId, newState.channelId, username, displayName);
        console.log(`📊 REALTIME: ${username} moved from ${oldState.channel.name} to ${newState.channel.name} - tracking continues`);
    }
}

async function logVoiceStateChange(oldState, newState) {
    try {
        const member = newState.member || oldState.member;
        const guild = newState.guild || oldState.guild;
        
        const voicemaster = await Voicemaster.findOne({ guildId: guild.id });
        if (!voicemaster || !voicemaster.logChannelId) return;

        const logChannel = guild.channels.cache.get(voicemaster.logChannelId);
        if (!logChannel) return;

        if (!oldState.channelId && newState.channelId) {
            await logVoiceEvent(guild.id, member, 'VOICE_JOIN', {
                action: '<:Mic:1393752063707578460> Mit Voice verbunden',
                channel: newState.channel,
                description: `Zu **${newState.channel.name}** verbunden`,
                color: 0x57F287
            });
        }
        else if (oldState.channelId && !newState.channelId) {
            await logVoiceEvent(guild.id, member, 'VOICE_LEAVE', {
                action: '<:Mic:1393752063707578460> Von Voice getrennt',
                channel: oldState.channel,
                description: `Von **${oldState.channel.name}** getrennt`,
                color: 0xED4245
            });
        }
        else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
            await logVoiceEvent(guild.id, member, 'VOICE_MOVE', {
                action: '<:Settings:1393752089884102677> Voice-Kanal gewechselt',
                channel: newState.channel,
                description: `Von **${oldState.channel.name}** zu **${newState.channel.name}** gewechselt`,
                color: 0xFEE75C
            });
        }
        else if (oldState.selfMute !== newState.selfMute) {
            await logVoiceEvent(guild.id, member, newState.selfMute ? 'SELF_MUTE' : 'SELF_UNMUTE', {
                action: newState.selfMute ? '<:Mic:1393752063707578460> Selbst stumm geschaltet' : '<:Mic:1393752063707578460> Selbst entstummt',
                channel: newState.channel,
                description: `Hat sich ${newState.selfMute ? 'stumm geschaltet' : 'entstummt'} in **${newState.channel?.name || 'Unbekannt'}**`,
                color: newState.selfMute ? 0xF38BA8 : 0xA6E3A1
            });
        }
        else if (oldState.selfDeaf !== newState.selfDeaf) {
            await logVoiceEvent(guild.id, member, newState.selfDeaf ? 'SELF_DEAFEN' : 'SELF_UNDEAFEN', {
                action: newState.selfDeaf ? '<:EyeClosed:1393752018346049639> Selbst taub geschaltet' : '<:EyeOpen:1393752027107954748> Selbst entaub',
                channel: newState.channel,
                description: `Hat sich ${newState.selfDeaf ? 'taub geschaltet' : 'entaubt'} in **${newState.channel?.name || 'Unbekannt'}**`,
                color: newState.selfDeaf ? 0xF38BA8 : 0xA6E3A1
            });
        }
        else if (oldState.serverMute !== newState.serverMute) {
            await logVoiceEvent(guild.id, member, newState.serverMute ? 'SERVER_MUTE' : 'SERVER_UNMUTE', {
                action: newState.serverMute ? '<:Warning:1393752109119176755> Server stumm geschaltet' : '<:Check:1393751996267368478> Server entstummt',
                channel: newState.channel,
                description: `Wurde ${newState.serverMute ? 'vom Server stumm geschaltet' : 'vom Server entstummt'} in **${newState.channel?.name || 'Unbekannt'}**`,
                color: newState.serverMute ? 0xED4245 : 0x57F287
            });
        }
        else if (oldState.serverDeaf !== newState.serverDeaf) {
            await logVoiceEvent(guild.id, member, newState.serverDeaf ? 'SERVER_DEAFEN' : 'SERVER_UNDEAFEN', {
                action: newState.serverDeaf ? '<:Warning:1393752109119176755> Server taub geschaltet' : '<:Check:1393751996267368478> Server entaubt',
                channel: newState.channel,
                description: `Wurde ${newState.serverDeaf ? 'vom Server taub geschaltet' : 'vom Server entaubt'} in **${newState.channel?.name || 'Unbekannt'}**`,
                color: newState.serverDeaf ? 0xED4245 : 0x57F287
            });
        }
        else if (oldState.streaming !== newState.streaming) {
            await logVoiceEvent(guild.id, member, newState.streaming ? 'STREAM_START' : 'STREAM_STOP', {
                action: newState.streaming ? '<:Plus:1393752077670416414> Stream gestartet' : '<:Minus:1393752071450136697> Stream beendet',
                channel: newState.channel,
                description: `Hat ${newState.streaming ? 'Stream gestartet' : 'Stream beendet'} in **${newState.channel?.name || 'Unbekannt'}**`,
                color: newState.streaming ? 0x9B59B6 : 0x95A5A6
            });
        }
        else if (oldState.selfVideo !== newState.selfVideo) {
            await logVoiceEvent(guild.id, member, newState.selfVideo ? 'CAMERA_ON' : 'CAMERA_OFF', {
                action: newState.selfVideo ? '<:EyeOpen:1393752027107954748> Kamera aktiviert' : '<:EyeClosed:1393752018346049639> Kamera deaktiviert',
                channel: newState.channel,
                description: `Hat ${newState.selfVideo ? 'Kamera aktiviert' : 'Kamera deaktiviert'} in **${newState.channel?.name || 'Unbekannt'}**`,
                color: newState.selfVideo ? 0x3498DB : 0x95A5A6
            });
        }

    } catch (error) {
        console.error('Error logging voice state change:', error);
    }
}

async function logVoiceEvent(guildId, member, eventType, eventData) {
    try {
        const voicemaster = await Voicemaster.findOne({ guildId });
        if (!voicemaster || !voicemaster.logChannelId) return;

        const guild = member.guild;
        const logChannel = guild.channels.cache.get(voicemaster.logChannelId);
        if (!logChannel) return;

        const now = new Date();
        const timestamp = Math.floor(now.getTime() / 1000);
        
        const embed = new EmbedBuilder()
            .setAuthor({
                name: `${member.displayName} (${member.user.username})`,
                iconURL: member.displayAvatarURL({ dynamic: true, size: 512 })
            })
            .setThumbnail(member.displayAvatarURL({ dynamic: true, size: 256 }))
            .setTitle(eventData.action)
            .setDescription(eventData.description)
            .setColor(eventData.color)
            .addFields(
                {
                    name: '<:User:1393752101687136269> Benutzer',
                    value: `${member} (${member.id})`,
                    inline: true
                },
                {
                    name: 'Ereignis',
                    value: `\`${eventType}\``,
                    inline: true
                },
                {
                    name: 'Zeit',
                    value: `<t:${timestamp}:R>`,
                    inline: true
                }
            )
            .setFooter({
                text: `Voice Logger • ${guild.name}`,
                iconURL: guild.iconURL({ dynamic: true }) || undefined
            })
            .setTimestamp();

        if (eventData.channel) {
            embed.addFields({
                name: 'Kanal',
                value: `${eventData.channel} (${eventData.channel.id})`,
                inline: true
            });
        }

        if (eventData.channel && (eventType.includes('JOIN') || eventType.includes('LEAVE') || eventType.includes('MOVE'))) {
            const memberCount = eventData.channel.members?.size || 0;
            embed.addFields({
                name: 'Mitglieder im Kanal',
                value: `${memberCount} Mitglied${memberCount === 1 ? '' : 'er'}`,
                inline: true
            });
        }

        await logChannel.send({ embeds: [embed] });

    } catch (error) {
        console.error('Error logging voice event:', error);
    }
}

async function logChannelAction(guildId, member, channel, actionType, details = '') {
    try {
        const voicemaster = await Voicemaster.findOne({ guildId });
        if (!voicemaster || !voicemaster.logChannelId) return;

        const guild = member.guild;
        const logChannel = guild.channels.cache.get(voicemaster.logChannelId);
        if (!logChannel) return;

        const now = new Date();
        const timestamp = Math.floor(now.getTime() / 1000);

        let color = 0x5865F2;
        if (actionType.includes('LOCK') || actionType.includes('HIDE') || actionType.includes('BAN')) {
            color = 0xED4245;
        } else if (actionType.includes('UNLOCK') || actionType.includes('SHOW') || actionType.includes('PERMIT')) {
            color = 0x57F287;
        } else if (actionType.includes('RENAME') || actionType.includes('LIMIT')) {
            color = 0xFEE75C;
        } else if (actionType.includes('KICK')) {
            color = 0xFF6B35;
        }

        const embed = new EmbedBuilder()
            .setAuthor({
                name: `${member.displayName} (${member.user.username})`,
                iconURL: member.displayAvatarURL({ dynamic: true, size: 512 })
            })
            .setThumbnail(member.displayAvatarURL({ dynamic: true, size: 256 }))
            .setTitle('<:Settings:1393752089884102677> Kanal Verwaltung')
            .setDescription(details)
            .setColor(color)
            .addFields(
                {
                    name: '<:User:1393752101687136269> Benutzer',
                    value: `${member} (${member.id})`,
                    inline: true
                },
                {
                    name: 'Aktion',
                    value: `\`${actionType}\``,
                    inline: true
                },
                {
                    name: 'Zeit',
                    value: `<t:${timestamp}:R>`,
                    inline: true
                },
                {
                    name: 'Kanal',
                    value: `${channel} (${channel.id})`,
                    inline: true
                }
            )
            .setFooter({
                text: `Voice Logger • ${guild.name}`,
                iconURL: guild.iconURL({ dynamic: true }) || undefined
            })
            .setTimestamp();

        await logChannel.send({ embeds: [embed] });

    } catch (error) {
        console.error('Error logging channel action:', error);
    }
}

async function handleJoinVoicemaster(state) {
    try {
        const voicemaster = await Voicemaster.findOne({ 
            guildId: state.guild.id, 
            channelId: state.channelId 
        });

        if (voicemaster) {
            await createTempChannel(state);
        }
    } catch (error) {
        console.error('Error handling voicemaster join:', error);
    }
}

async function createTempChannel(state) {
    try {
        const member = state.member;
        const guild = state.guild;
        
        const hasVanity = member.presence?.activities?.some(activity => 
            activity.type === 4 && activity.state?.includes('/')
        ) || false;
        
        const voicemasterConfig = await Voicemaster.findOne({ 
            guildId: guild.id, 
            channelId: state.channelId 
        });
        
        const channel = await guild.channels.create({
            name: `${member.displayName}'s Kanal`,
            type: ChannelType.GuildVoice,
            parent: voicemasterConfig?.voiceCategoryId || state.channel.parentId,
            permissionOverwrites: [
                {
                    id: guild.id,
                    allow: [
                        PermissionFlagsBits.ViewChannel, 
                        PermissionFlagsBits.Connect,
                        PermissionFlagsBits.Speak 
                    ],
                },
                {
                    id: member.id,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.Connect,
                        PermissionFlagsBits.Speak,
                        PermissionFlagsBits.MoveMembers,
                        ...(hasVanity ? [PermissionFlagsBits.Stream, PermissionFlagsBits.UseVAD] : [])
                    ],
                }
            ]
        });

        await member.voice.setChannel(channel);

        await TempChannel.create({
            guildId: guild.id,
            channelId: channel.id,
            ownerId: member.id
        });

        await logVoiceEvent(guild.id, member, 'TEMP_CHANNEL_CREATE', {
            action: '<:Plus:1393752077670416414> Voice-Kanal erstellt',
            channel: channel,
            description: `Temporären Voice-Kanal **${channel.name}** erstellt${hasVanity ? ' mit Streaming-Berechtigungen' : ''}`,
            color: 0x00D166
        });

    } catch (error) {
        console.error('Error creating temp channel:', error);
    }
}

async function handleLeaveTempChannel(state) {
    try {
        const tempChannel = await TempChannel.findOne({ channelId: state.channelId });
        
        if (tempChannel) {
            const channel = state.guild.channels.cache.get(state.channelId);
            
            if (channel && channel.members.size === 0) {
                const channelName = channel.name;
                const channelId = channel.id;
                
                await channel.delete();
                await TempChannel.deleteOne({ channelId: state.channelId });
                await VoicePermit.deleteMany({ channelId: state.channelId });
                await VoiceBan.deleteMany({ channelId: state.channelId });
                
                await logVoiceEvent(state.guild.id, state.member, 'TEMP_CHANNEL_DELETE', {
                    action: '<:Minus:1393752071450136697> Voice-Kanal gelöscht',
                    channel: null,
                    description: `Temporären Voice-Kanal **${channelName}** \`(${channelId})\` automatisch gelöscht - Keine Mitglieder verbleiben`,
                    color: 0xFF6B35
                });
            }
        }
    } catch (error) {
        console.error('Error handling temp channel leave:', error);
    }
}

async function handleBannedUser(state) {
    try {
        const ban = await VoiceBan.findOne({ 
            channelId: state.channelId, 
            userId: state.member.id 
        });

        if (ban) {
            const member = state.member;
            const channel = state.channel;
            const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);
            
            await member.voice.disconnect();
            
            const channelName = channel ? channel.name : 'Unbekannter Kanal';
            
            await logVoiceEvent(state.guild.id, member, 'AUTO_BAN_KICK', {
                action: '<:Deny:1393752012054728784> Auto-Kick (Gebannter Benutzer)',
                channel: channel,
                description: `${isAdmin ? '**Admin** ' : ''}Benutzer automatisch aus **${channelName}** gekickt - Benutzer ist von diesem Kanal gebannt`,
                color: 0xDC143C
            });

            if (!isAdmin) {
                try {
                    const dmEmbed = new EmbedBuilder()
                        .setTitle('<:Warning:1393752109119176755> Auto-Kick aus Voice-Kanal')
                        .setDescription(`Du wurdest automatisch aus **${channelName}** gekickt, weil du von diesem Voice-Kanal gebannt bist.`)
                        .addFields(
                            {
                                name: 'So löst du das Problem:',
                                value: '• Verwende den `vc unban` Befehl\n• Bitte den Kanal-Besitzer dich zu entbannen\n• Kontaktiere einen Server-Administrator',
                                inline: false
                            }
                        )
                        .setColor(0xED4245)
                        .setThumbnail(member.displayAvatarURL({ dynamic: true }))
                        .setTimestamp();

                    await member.send({ embeds: [dmEmbed] });
                } catch (error) {
                }
            }
        }
    } catch (error) {
        console.error('Error handling banned user:', error);
    }
}

module.exports.logVoiceEvent = logVoiceEvent;
module.exports.logChannelAction = logChannelAction;