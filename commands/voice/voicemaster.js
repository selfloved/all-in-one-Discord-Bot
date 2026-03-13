const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ChannelType
} = require('discord.js');
const { Voicemaster } = require('../../database/models/Voicemaster');
const Guild = require('../../database/models/Guild');

module.exports = {
  name: 'voicemaster',
  aliases: ['vm', 'vcsetup'],
  description: 'Configure voicemaster system',
  usage: 'voicemaster <config/setup>',
  category: 'voice',

  async executePrefix(message, args) {
    let guildDoc = await Guild.findOne({ guildId: message.guild.id });
    const prefix = guildDoc?.prefix || '!';

    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply('You need Administrator permissions to use this command.');
    }

    const subcommand = args[0]?.toLowerCase();

    if (subcommand === 'config') {
      return message.reply(`Use the new comprehensive config system:\n\`${prefix}voicemaster config\`\n\nFor now, use \`${prefix}voicemaster setup\` for quick setup.`);
    } else if (subcommand === 'setup') {
      await handleQuickSetup(message);
    } else {
      return message.reply(`Usage: \`${prefix}voicemaster <config/setup>\`\n\n• \`config\` - Open configuration panel\n• \`setup\` - Quick setup (creates everything)`);
    }
  }
};

async function handleQuickSetup(message) {
  try {
    const existingVoicemaster = await Voicemaster.findOne({ guildId: message.guild.id });
    if (existingVoicemaster) {
      return message.reply('Voicemaster is already set up in this server. Use config to modify settings.');
    }

    const setupMessage = await message.reply('Setting up voicemaster system...');

    const category = await message.guild.channels.create({
      name: 'Voice Master',
      type: ChannelType.GuildCategory,
      permissionOverwrites: [{ id: message.guild.id, allow: [PermissionFlagsBits.ViewChannel] }]
    });

    const voiceCategory = await message.guild.channels.create({
      name: 'Voice Channels',
      type: ChannelType.GuildCategory,
      permissionOverwrites: [{ id: message.guild.id, allow: [PermissionFlagsBits.ViewChannel] }]
    });

    const joinChannel = await message.guild.channels.create({
      name: 'Join 2 Create',
      type: ChannelType.GuildVoice,
      parent: category.id,
      permissionOverwrites: [{ id: message.guild.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect] }]
    });

    const interfaceChannel = await message.guild.channels.create({
      name: 'interface',
      type: ChannelType.GuildText,
      parent: category.id,
      permissionOverwrites: [{ id: message.guild.id, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages] }]
    });

    const logChannel = await message.guild.channels.create({
      name: 'voice-logs',
      type: ChannelType.GuildText,
      parent: category.id,
      permissionOverwrites: [
        { 
          id: message.guild.id, 
          deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] 
        },
        {
          id: message.author.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory]
        }
      ]
    });

    const embed = new EmbedBuilder()
      .setDescription('**Voice Channel Controls**\n\n<:Settings:1389026472928481450> **Rename** - Change your channel name\n<:Lock:1389019766370467842> **Lock** - Prevent others from joining\n<:Unlock:1389019706543050832> **Unlock** - Allow others to join\n<:EyeClosed:1389023971172683886> **Hide** - Hide channel from everyone\n<:EyeOpen:1389023962859700274> **Show** - Make channel visible\n<:User:1389024819793756211> **User Limit** - Set channel user limit\n<:Deny:1389021084925431860> **Ban** - Ban user from your channel\n<:Minus:1389021587973345371> **Kick** - Kick user from your channel');

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('vc_rename').setEmoji({ id: '1389026472928481450', name: 'Settings' }).setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('vc_lock').setEmoji({ id: '1389019766370467842', name: 'Lock' }).setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('vc_unlock').setEmoji({ id: '1389019706543050832', name: 'Unlock' }).setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('vc_invisible').setEmoji({ id: '1389023971172683886', name: 'EyeClosed' }).setStyle(ButtonStyle.Secondary)
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('vc_visible').setEmoji({ id: '1389023962859700274', name: 'EyeOpen' }).setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('vc_userlimit').setEmoji({ id: '1389024819793756211', name: 'User' }).setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('vc_ban').setEmoji({ id: '1389021084925431860', name: 'Deny' }).setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('vc_kick').setEmoji({ id: '1389021587973345371', name: 'Minus' }).setStyle(ButtonStyle.Secondary)
    );

    const interfaceMessage = await interfaceChannel.send({
      embeds: [embed],
      components: [row1, row2]
    });

    await Voicemaster.create({
      guildId: message.guild.id,
      channelId: joinChannel.id,
      categoryId: category.id,
      interfaceChannelId: interfaceChannel.id,
      interfaceMessageId: interfaceMessage.id,
      voiceCategoryId: voiceCategory.id,
      logChannelId: logChannel.id
    });

    const successEmbed = new EmbedBuilder()
      .setDescription(`✅ Voicemaster setup complete:\n\n📁 Category: ${category}\n🎤 Join Channel: ${joinChannel}\n📋 Controls: ${interfaceChannel}\n📑 Logs: ${logChannel}`);

    await setupMessage.edit({ embeds: [successEmbed] });

  } catch (error) {
    console.error('❌ Error setting up voicemaster:', error);
    await message.reply('Failed to setup voicemaster.');
  }
}