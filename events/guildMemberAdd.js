const { Events, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const Guild = require('../database/models/Guild');
const { createEmbed } = require('../utils/embedBuilder');

const emojis = {
    mic: '<:Mic:1393752063707578460>'
};

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member) {
        try {
            const guildConfig = await Guild.findOne({ guildId: member.guild.id });
            
            if (!guildConfig || !guildConfig.greeting || !guildConfig.greeting.enabled) {
                return;
            }

            const greetingConfig = guildConfig.greeting;

            let needsUpdate = false;
            if (greetingConfig.mentionUser === undefined) {
                greetingConfig.mentionUser = true;
                needsUpdate = true;
            }
            if (greetingConfig.buttonEnabled === undefined) {
                greetingConfig.buttonEnabled = false;
                needsUpdate = true;
            }
            if (greetingConfig.totalGreetings === undefined) {
                greetingConfig.totalGreetings = 0;
                needsUpdate = true;
            }
            if (greetingConfig.buttonText === undefined) {
                greetingConfig.buttonText = 'VC Beitreten';
                needsUpdate = true;
            }
            if (greetingConfig.buttonChannelId === undefined) {
                greetingConfig.buttonChannelId = null;
                needsUpdate = true;
            }

            if (needsUpdate) {
                await Guild.findOneAndUpdate(
                    { guildId: member.guild.id },
                    { 
                        $set: { 
                            'greeting.mentionUser': greetingConfig.mentionUser,
                            'greeting.buttonEnabled': greetingConfig.buttonEnabled,
                            'greeting.totalGreetings': greetingConfig.totalGreetings,
                            'greeting.buttonText': greetingConfig.buttonText,
                            'greeting.buttonChannelId': greetingConfig.buttonChannelId
                        } 
                    }
                );
                console.log(`✅ Begrüßungsfelder für ${member.guild.name} automatisch aktualisiert`);
            }

            if (!greetingConfig.channelId) {
                console.log(`⚠️ Begrüßung aktiviert aber kein Kanal für ${member.guild.name} gesetzt`);
                return;
            }

            const greetingChannel = member.guild.channels.cache.get(greetingConfig.channelId);
            if (!greetingChannel) {
                console.log(`⚠️ Begrüßungskanal für ${member.guild.name} nicht gefunden`);
                return;
            }

            const embed = createEmbed('default', 'Willkommen!', '');
            embed.setColor(greetingConfig.embedColor || '#2f3136');

            let description = greetingConfig.message
                .replace(/\$user/g, `${member}`)
                .replace(/\$username/g, member.user.username)
                .replace(/\$server/g, member.guild.name)
                .replace(/\$membercount/g, member.guild.memberCount.toString());

            embed.setDescription(description);

            if (greetingConfig.showAvatar) {
                embed.setThumbnail(member.user.displayAvatarURL({ dynamic: true }));
            }

            if (greetingConfig.showMemberCount) {
                embed.setFooter({ 
                    text: `Mitglied #${member.guild.memberCount}`,
                    iconURL: member.guild.iconURL({ dynamic: true })
                });
            }

            const components = [];
            
            let content = '';
            if (greetingConfig.mentionUser) {
                content = `${member}`;
            }

            if (greetingConfig.buttonEnabled && greetingConfig.buttonChannelId) {
                const buttonChannel = member.guild.channels.cache.get(greetingConfig.buttonChannelId);
                
                if (buttonChannel) {
                    const button = new ButtonBuilder()
                        .setCustomId(`greeting_button_${greetingConfig.buttonChannelId}`)
                        .setLabel(greetingConfig.buttonText || 'VC Beitreten')
                        .setEmoji(emojis.mic)
                        .setStyle(ButtonStyle.Secondary);

                    const row = new ActionRowBuilder().addComponents(button);
                    components.push(row);
                }
            }

            const sentMessage = await greetingChannel.send({
                content: content,
                embeds: [embed],
                components: components
            });

            if (sentMessage) {
                try {
                    const updatedGuild = await Guild.findOneAndUpdate(
                        { guildId: member.guild.id },
                        { $inc: { 'greeting.totalGreetings': 1 } },
                        { new: true }
                    );
                    
                    const newTotal = updatedGuild?.greeting?.totalGreetings || 1;
                    console.log(`✅ Begrüßung für ${member.user.tag} in ${member.guild.name} gesendet (Gesamt: ${newTotal})`);
                } catch (counterError) {
                    console.error('❌ Fehler beim Aktualisieren des Begrüßungszählers:', counterError);
                    console.log(`✅ Begrüßung für ${member.user.tag} in ${member.guild.name} gesendet (Zähler-Update fehlgeschlagen)`);
                }
            }

        } catch (error) {
            console.error('❌ Fehler beim Senden der Begrüßung:', error);
        }
    }
};