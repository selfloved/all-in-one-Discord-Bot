const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { Voicemaster } = require('../database/models/Voicemaster');
const GiveawayTracker = require('../utils/giveawayTracker');
const LeaderboardManager = require('../utils/leaderboardManager');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    console.log(`✅ Bot is ready! Logged in as ${client.user.tag}`);
    console.log(`🌐 Connected to ${client.guilds.cache.size} servers with ${client.users.cache.size} users`);
    console.log(`⚡ Bot latency: ${client.ws.ping}ms`);
    client.user.setActivity('with Discord.js', { type: 'PLAYING' });

    client.giveawayTracker = new GiveawayTracker(client);
    console.log('🎉 Giveaway tracking system initialized');

    client.leaderboardManager = new LeaderboardManager(client);
    await client.leaderboardManager.initialize();
    console.log('📊 Leaderboard manager initialized');

    await restoreVoicemasterInterfaces(client);
  }
};

async function restoreVoicemasterInterfaces(client) {
  try {
    console.log('🔄 Restoring voicemaster interfaces...');
    const voicemasters = await Voicemaster.find({});

    for (const voicemaster of voicemasters) {
      try {
        const guild = client.guilds.cache.get(voicemaster.guildId);
        if (!guild) continue;

        const interfaceChannel = guild.channels.cache.get(voicemaster.interfaceChannelId);
        if (!interfaceChannel) continue;

        let interfaceMessage = null;
        if (voicemaster.interfaceMessageId) {
          try {
            interfaceMessage = await interfaceChannel.messages.fetch(voicemaster.interfaceMessageId);
          } catch {}
        }

        const embed = new EmbedBuilder()
          .setDescription('**Voice-Kanal Steuerung**\n\n<:Settings:1393752089884102677> **Umbenennen** - Ändere deinen Kanalnamen\n<:Lock:1393752055700787221> **Sperren** - Verhindere, dass andere beitreten\n<:Unlock:1393752095911579699> **Entsperren** - Erlaube anderen beizutreten\n<:EyeClosed:1393752018346049639> **Verstecken** - Verstecke Kanal vor allen\n<:EyeOpen:1393752027107954748> **Anzeigen** - Mache Kanal sichtbar\n<:User:1393752101687136269> **Benutzer Limit** - Setze Kanal Benutzer Limit\n<:Deny:1393752012054728784> **Bannen** - Banne Benutzer von deinem Kanal\n<:Minus:1393752071450136697> **Kicken** - Kicke Benutzer aus deinem Kanal')
          .setColor(0x2f3136);

        const row1 = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('vc_rename').setEmoji({ id: '1393752089884102677', name: 'Settings' }).setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('vc_lock').setEmoji({ id: '1393752055700787221', name: 'Lock' }).setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('vc_unlock').setEmoji({ id: '1393752095911579699', name: 'Unlock' }).setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('vc_invisible').setEmoji({ id: '1393752018346049639', name: 'EyeClosed' }).setStyle(ButtonStyle.Secondary)
        );

        const row2 = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('vc_visible').setEmoji({ id: '1393752027107954748', name: 'EyeOpen' }).setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('vc_userlimit').setEmoji({ id: '1393752101687136269', name: 'User' }).setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('vc_ban').setEmoji({ id: '1393752012054728784', name: 'Deny' }).setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('vc_kick').setEmoji({ id: '1393752071450136697', name: 'Minus' }).setStyle(ButtonStyle.Secondary)
        );

        if (interfaceMessage) {
          await interfaceMessage.edit({ embeds: [embed], components: [row1, row2] });
        } else {
          const newMessage = await interfaceChannel.send({ embeds: [embed], components: [row1, row2] });
          await Voicemaster.findOneAndUpdate({ guildId: voicemaster.guildId }, { interfaceMessageId: newMessage.id });
        }
      } catch (error) {
        console.error(`❌ Error restoring voicemaster interface for guild ${voicemaster.guildId}:`, error);
      }
    }

    console.log('✅ Voicemaster interfaces restored');
  } catch (error) {
    console.error('❌ Error restoring voicemaster interfaces:', error);
  }
}