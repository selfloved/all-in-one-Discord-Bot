const { ActionRowBuilder, StringSelectMenuBuilder, ChannelSelectMenuBuilder, ChannelType, ModalBuilder, TextInputBuilder, TextInputStyle, ButtonBuilder, ButtonStyle, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const Guild = require('../../database/models/Guild');
const { createEmbed } = require('../../utils/embedBuilder');

const emojis = {
    check: '<:Check:1393751996267368478>',
    deny: '<:Deny:1393752012054728784>',
    mic: '<:Mic:1393752063707578460>'
};

module.exports = {
    name: 'greet',
    description: 'Configure server greeting messages',
    usage: '!greet',
    aliases: ['greeting', 'welcome'],
    category: 'utility',
    
    async executePrefix(message, args) {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return message.reply({
                embeds: [createEmbed('default', 'Access Denied', 'You need Manage Server permission.')]
            });
        }

        let guild = await Guild.findOne({ guildId: message.guild.id });
        if (!guild) {
            guild = new Guild({
                guildId: message.guild.id,
                guildName: message.guild.name,
                greeting: {
                    enabled: false,
                    channelId: null,
                    message: 'Welcome to the server, $user!',
                    embedColor: '#2f3136',
                    showAvatar: true,
                    showMemberCount: true,
                    mentionUser: true,
                    buttonEnabled: false,
                    buttonText: 'Join VC',
                    buttonChannelId: null,
                    totalGreetings: 0
                }
            });
            await guild.save();
            console.log(`✅ Created new guild config with greeting for ${message.guild.name}`);
        }

        if (!guild.greeting) {
            guild.greeting = {
                enabled: false,
                channelId: null,
                message: 'Welcome to the server, $user!',
                embedColor: '#2f3136',
                showAvatar: true,
                showMemberCount: true,
                mentionUser: true,
                buttonEnabled: false,
                buttonText: 'Join VC',
                buttonChannelId: null,
                totalGreetings: 0
            };
            guild.markModified('greeting');
            await guild.save();
        }

        if (guild.greeting.mentionUser === undefined || guild.greeting.totalGreetings === undefined) {
            guild.greeting.mentionUser = guild.greeting.mentionUser !== undefined ? guild.greeting.mentionUser : true;
            guild.greeting.buttonEnabled = guild.greeting.buttonEnabled !== undefined ? guild.greeting.buttonEnabled : false;
            guild.greeting.buttonText = guild.greeting.buttonText || 'Join VC';
            guild.greeting.buttonChannelId = guild.greeting.buttonChannelId || null;
            guild.greeting.totalGreetings = guild.greeting.totalGreetings !== undefined ? guild.greeting.totalGreetings : 0;
            guild.markModified('greeting');
            await guild.save();
            console.log(`✅ Updated greeting config for ${message.guild.name}`);
        }

        const { embed, components } = createMainEmbed(guild.greeting, message.guild);
        
        const response = await message.reply({ 
            embeds: [embed], 
            components: components
        });

        const collector = response.createMessageComponentCollector({ 
            time: 300000
        });

        collector.on('collect', async (interaction) => {
            if (interaction.user.id !== message.author.id) {
                return interaction.reply({ 
                    content: 'Only the command user can use this menu!', 
                    flags: MessageFlags.Ephemeral
                });
            }

            await handleInteraction(interaction, guild, response);
        });

        collector.on('end', () => {
            const disabledComponents = components.map(row => {
                const newRow = ActionRowBuilder.from(row);
                newRow.components.forEach(component => component.setDisabled(true));
                return newRow;
            });
            response.edit({ components: disabledComponents }).catch(() => {});
        });
    }
};

function createMainEmbed(greetConfig, guildData) {
    const embed = createEmbed('default', 'Greeting System Configuration', '');
    embed.setThumbnail(guildData.iconURL({ dynamic: true, size: 256 }) || null);
    
    const statusValue = greetConfig.enabled ? 
        `${emojis.check} **Enabled**` : 
        `${emojis.deny} **Disabled**`;
    
    const channelValue = greetConfig.channelId ? 
        `<#${greetConfig.channelId}>` : 
        '`Not set`';
    
    const featuresValue = [
        `Avatar: ${greetConfig.showAvatar ? emojis.check : emojis.deny}`,
        `Member Count: ${greetConfig.showMemberCount ? emojis.check : emojis.deny}`,
        `Ping Outside: ${greetConfig.mentionUser ? emojis.check : emojis.deny}`,
        `Button: ${greetConfig.buttonEnabled ? `${emojis.check} ${emojis.mic}` : emojis.deny}`
    ].join('\n');

    embed.addFields(
        {
            name: 'Status',
            value: statusValue,
            inline: true
        },
        {
            name: 'Channel',
            value: channelValue,
            inline: true
        },
        {
            name: 'Total Greetings',
            value: `**${greetConfig.totalGreetings || 0}** sent`,
            inline: true
        },
        {
            name: 'Features',
            value: featuresValue,
            inline: false
        },
        {
            name: 'Message Preview',
            value: `\`\`\`${greetConfig.message.substring(0, 100)}${greetConfig.message.length > 100 ? '...' : ''}\`\`\``,
            inline: false
        }
    );

    const mainMenu = new StringSelectMenuBuilder()
        .setCustomId('greet_main_menu')
        .setPlaceholder('Select an option to configure')
        .addOptions([
            {
                label: 'Toggle System',
                value: 'toggle_system',
                description: 'Enable or disable the greeting system',
                emoji: greetConfig.enabled ? emojis.deny : emojis.check
            },
            {
                label: 'Set Channel',
                value: 'set_channel',
                description: 'Choose greeting channel'
            },
            {
                label: 'Edit Message',
                value: 'edit_message',
                description: 'Customize greeting message'
            },
            {
                label: 'Configure Features',
                value: 'configure_features',
                description: 'Toggle avatar, member count, ping outside, button'
            },
            {
                label: 'Test Greeting',
                value: 'test_greeting',
                description: 'Preview how greeting will look'
            },
            {
                label: 'Reset Counter',
                value: 'reset_counter',
                description: 'Reset total greetings counter to 0'
            },
            {
                label: 'Refresh Stats',
                value: 'refresh_stats',
                description: 'Update greeting statistics'
            },
            {
                label: 'Debug Info',
                value: 'debug_info',
                description: 'Show debug information'
            }
        ]);

    const helpMenu = new StringSelectMenuBuilder()
        .setCustomId('greet_help_menu')
        .setPlaceholder('Need help? Select a topic')
        .addOptions([
            {
                label: 'Variables Guide',
                value: 'help_variables',
                description: 'Learn about message variables'
            },
            {
                label: 'Setup Guide',
                value: 'help_setup',
                description: 'Step-by-step setup instructions'
            },
            {
                label: 'Troubleshooting',
                value: 'help_troubleshooting',
                description: 'Common issues and solutions'
            }
        ]);

    const row1 = new ActionRowBuilder().addComponents(mainMenu);
    const row2 = new ActionRowBuilder().addComponents(helpMenu);
    
    return { embed, components: [row1, row2] };
}

function createFeatureEmbed(greetConfig, guildData) {
    const embed = createEmbed('default', 'Feature Configuration', '');
    embed.setThumbnail(guildData.iconURL({ dynamic: true, size: 256 }) || null);
    
    embed.addFields(
        {
            name: 'Show Avatar',
            value: greetConfig.showAvatar ? `${emojis.check} Enabled` : `${emojis.deny} Disabled`,
            inline: true
        },
        {
            name: 'Show Member Count',
            value: greetConfig.showMemberCount ? `${emojis.check} Enabled` : `${emojis.deny} Disabled`,
            inline: true
        },
        {
            name: 'Ping Outside Embed',
            value: greetConfig.mentionUser ? `${emojis.check} Enabled` : `${emojis.deny} Disabled`,
            inline: true
        },
        {
            name: `Voice Channel Button`,
            value: greetConfig.buttonEnabled ? `${emojis.check} Enabled` : `${emojis.deny} Disabled`,
            inline: false
        }
    );

    if (greetConfig.buttonEnabled) {
        embed.addFields({
            name: 'Button Settings',
            value: [
                `Text: **${greetConfig.buttonText || 'Join VC'}**`,
                `Channel: ${greetConfig.buttonChannelId ? `<#${greetConfig.buttonChannelId}>` : '`Not set`'}`
            ].join('\n'),
            inline: false
        });
    }

    const toggleRow1 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('toggle_avatar')
                .setLabel('Avatar')
                .setStyle(greetConfig.showAvatar ? ButtonStyle.Success : ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('toggle_member_count')
                .setLabel('Member Count')
                .setStyle(greetConfig.showMemberCount ? ButtonStyle.Success : ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('toggle_mention')
                .setLabel('Ping Outside')
                .setStyle(greetConfig.mentionUser ? ButtonStyle.Success : ButtonStyle.Secondary)
        );

    const toggleRow2 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('toggle_button')
                .setLabel('VC Button')
                .setEmoji(emojis.mic)
                .setStyle(greetConfig.buttonEnabled ? ButtonStyle.Success : ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('set_button_text')
                .setLabel('Button Text')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(!greetConfig.buttonEnabled),
            new ButtonBuilder()
                .setCustomId('set_button_channel')
                .setLabel('Button Channel')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(!greetConfig.buttonEnabled)
        );

    const backRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('back_to_main')
                .setLabel('Back')
                .setStyle(ButtonStyle.Secondary)
        );

    return { embed, components: [toggleRow1, toggleRow2, backRow] };
}

async function handleInteraction(interaction, guildConfig, originalResponse) {
    try {
        if (interaction.isStringSelectMenu()) {
            if (interaction.customId === 'greet_main_menu') {
                await handleMainMenu(interaction, guildConfig, originalResponse);
            } else if (interaction.customId === 'greet_help_menu') {
                await handleHelpMenu(interaction, guildConfig, originalResponse);
            }
        } else if (interaction.isButton()) {
            await handleButtonClick(interaction, guildConfig, originalResponse);
        }
    } catch (error) {
        console.error('❌ Error handling interaction:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ 
                content: 'An error occurred.', 
                flags: MessageFlags.Ephemeral
            });
        }
    }
}

async function handleMainMenu(interaction, guildConfig, originalResponse) {
    const value = interaction.values[0];

    switch (value) {
        case 'toggle_system':
            await toggleSystem(interaction, guildConfig);
            await refreshMainEmbed(originalResponse, guildConfig, interaction.guild);
            break;
        case 'set_channel':
            await setChannel(interaction, guildConfig);
            setTimeout(async () => {
                await refreshMainEmbed(originalResponse, guildConfig, interaction.guild);
            }, 1000);
            break;
        case 'edit_message':
            await editMessage(interaction, guildConfig);
            setTimeout(async () => {
                await refreshMainEmbed(originalResponse, guildConfig, interaction.guild);
            }, 1000);
            break;
        case 'configure_features':
            await showFeatureConfig(interaction, guildConfig, originalResponse);
            break;
        case 'test_greeting':
            await testGreeting(interaction, guildConfig);
            break;
        case 'reset_counter':
            await resetGreetingsCounter(interaction, guildConfig);
            await refreshMainEmbed(originalResponse, guildConfig, interaction.guild);
            break;
        case 'refresh_stats':
            await refreshMainEmbed(originalResponse, guildConfig, interaction.guild);
            await interaction.reply({
                embeds: [createEmbed('default', 'Stats Refreshed', `${emojis.check} Greeting statistics have been updated.`)],
                flags: MessageFlags.Ephemeral
            });
            break;
        case 'debug_info':
            await showDebugInfo(interaction, guildConfig);
            break;
    }
}

async function handleHelpMenu(interaction, guildConfig, originalResponse) {
    const value = interaction.values[0];
    let helpEmbed;

    switch (value) {
        case 'help_variables':
            helpEmbed = createEmbed('default', 'Message Variables', '')
                .addFields(
                    {
                        name: 'Available Variables',
                        value: [
                            '`$user` - Mentions the user (@Username)',
                            '`$username` - User\'s display name (no mention)',
                            '`$server` - Server name',
                            '`$membercount` - Current member count'
                        ].join('\n'),
                        inline: false
                    },
                    {
                        name: 'How Mentions Work',
                        value: [
                            '• **$user in embed**: Creates mention inside embed text',
                            '• **$username in embed**: Shows username only (no ping)',
                            '• **Outside embed**: "Ping Outside" adds separate mention above embed',
                            '• **Double mentions**: Using $user + "Ping Outside" = 2 mentions'
                        ].join('\n'),
                        inline: false
                    },
                    {
                        name: 'Example Usage',
                        value: '```Welcome $user to $server!\nYou are member #$membercount```\n**Result**: "@Username" appears in embed text + optional mention outside.',
                        inline: false
                    }
                );
            break;
        case 'help_setup':
            helpEmbed = createEmbed('default', 'Setup Guide', '')
                .addFields(
                    {
                        name: 'Quick Setup Steps',
                        value: [
                            '1. **Set Channel** - Choose where greetings appear',
                            '2. **Edit Message** - Customize your welcome text',
                            '3. **Configure Features** - Toggle avatar, pings, etc.',
                            '4. **Test Greeting** - Preview before enabling',
                            '5. **Toggle System** - Enable when ready!'
                        ].join('\n'),
                        inline: false
                    }
                );
            break;
        case 'help_troubleshooting':
            helpEmbed = createEmbed('default', 'Troubleshooting', '')
                .addFields(
                    {
                        name: 'Common Issues',
                        value: [
                            '**Greetings not appearing** - Check if system is enabled and channel is set',
                            '**No permissions** - Bot needs Send Messages permission in greeting channel',
                            '**Button not working** - Ensure button channel is set and exists',
                            '**Variables not working** - Check spelling: `$user` not `$User`'
                        ].join('\n'),
                        inline: false
                    }
                );
            break;
    }

    const backButton = new ButtonBuilder()
        .setCustomId('back_to_main_from_help')
        .setLabel('Back')
        .setStyle(ButtonStyle.Secondary);

    const backRow = new ActionRowBuilder().addComponents(backButton);

    await interaction.update({ 
        embeds: [helpEmbed], 
        components: [backRow]
    });
}

async function showFeatureConfig(interaction, guildConfig, originalResponse) {
    const { embed, components } = createFeatureEmbed(guildConfig.greeting, interaction.guild);
    await interaction.update({ embeds: [embed], components });
}

async function handleButtonClick(interaction, guildConfig, originalResponse) {
    const customId = interaction.customId;

    switch (customId) {
        case 'back_to_main':
        case 'back_to_main_from_help':
            await refreshMainEmbed(originalResponse, guildConfig, interaction.guild, interaction);
            break;
        case 'toggle_avatar':
            await toggleFeature(interaction, guildConfig, 'showAvatar', originalResponse);
            break;
        case 'toggle_member_count':
            await toggleFeature(interaction, guildConfig, 'showMemberCount', originalResponse);
            break;
        case 'toggle_mention':
            await toggleFeature(interaction, guildConfig, 'mentionUser', originalResponse);
            break;
        case 'toggle_button':
            await toggleFeature(interaction, guildConfig, 'buttonEnabled', originalResponse);
            break;
        case 'set_button_text':
            await setButtonText(interaction, guildConfig);
            break;
        case 'set_button_channel':
            await setButtonChannel(interaction, guildConfig);
            break;
    }
}

async function toggleSystem(interaction, guildConfig) {
    const newState = !guildConfig.greeting.enabled;
    
    const updatedConfig = await Guild.findOneAndUpdate(
        { guildId: guildConfig.guildId },
        { $set: { 'greeting.enabled': newState } },
        { new: true }
    );

    if (updatedConfig) {
        guildConfig.greeting.enabled = newState;
    }

    await interaction.reply({ 
        embeds: [createEmbed('default', 'System Updated', `Greeting system ${newState ? `${emojis.check} **enabled**` : `${emojis.deny} **disabled**`}.`)],
        flags: MessageFlags.Ephemeral
    });
}

async function toggleFeature(interaction, guildConfig, feature, originalResponse) {
    const newState = !guildConfig.greeting[feature];
    
    await Guild.findOneAndUpdate(
        { guildId: guildConfig.guildId },
        { $set: { [`greeting.${feature}`]: newState } },
        { new: true }
    );

    guildConfig.greeting[feature] = newState;

    const { embed, components } = createFeatureEmbed(guildConfig.greeting, interaction.guild);
    await interaction.update({ embeds: [embed], components });
}

async function setChannel(interaction, guildConfig) {
    const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId('greet_channel_select')
        .setPlaceholder('Select greeting channel')
        .setChannelTypes(ChannelType.GuildText);

    const row = new ActionRowBuilder().addComponents(channelSelect);

    await interaction.reply({
        content: 'Select a channel for greetings:',
        components: [row],
        flags: MessageFlags.Ephemeral
    });

    try {
        const channelInteraction = await interaction.channel.awaitMessageComponent({
            filter: (i) => i.user.id === interaction.user.id && i.customId === 'greet_channel_select',
            time: 60000
        });

        const selectedChannel = channelInteraction.values[0];
        
        await Guild.findOneAndUpdate(
            { guildId: guildConfig.guildId },
            { $set: { 'greeting.channelId': selectedChannel } },
            { new: true }
        );

        guildConfig.greeting.channelId = selectedChannel;

        await channelInteraction.update({ 
            content: `${emojis.check} Greeting channel set to <#${selectedChannel}>.`,
            components: []
        });
    } catch (error) {
        if (error.code === 'InteractionCollectorError') {
            console.log('⏰ Channel selection timed out');
            await interaction.editReply({ 
                content: 'Selection timed out.',
                components: []
            }).catch(() => {});
        } else {
            console.error('❌ Error setting channel:', error);
        }
    }
}

async function editMessage(interaction, guildConfig) {
    const modal = new ModalBuilder()
        .setCustomId('greet_message_modal')
        .setTitle('Edit Greeting Message');

    const messageInput = new TextInputBuilder()
        .setCustomId('greeting_message')
        .setLabel('Greeting Message')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Welcome to the server, $user!')
        .setRequired(true)
        .setMaxLength(1500)
        .setValue(guildConfig.greeting.message);

    const row = new ActionRowBuilder().addComponents(messageInput);
    modal.addComponents(row);

    await interaction.showModal(modal);

    try {
        const modalInteraction = await interaction.awaitModalSubmit({ time: 300000 });
        const message = modalInteraction.fields.getTextInputValue('greeting_message');
        
        await Guild.findOneAndUpdate(
            { guildId: guildConfig.guildId },
            { $set: { 'greeting.message': message } },
            { new: true }
        );

        guildConfig.greeting.message = message;

        await modalInteraction.reply({ 
            embeds: [createEmbed('default', 'Message Updated', `${emojis.check} Greeting message has been updated.`)],
            flags: MessageFlags.Ephemeral
        });
    } catch (error) {
        if (error.code === 'InteractionCollectorError') {
            console.log('⏰ Modal timed out for greeting message edit');
        } else {
            console.error('❌ Error setting message:', error);
        }
    }
}

async function setButtonText(interaction, guildConfig) {
    const modal = new ModalBuilder()
        .setCustomId('button_text_modal')
        .setTitle('Set Button Text');

    const textInput = new TextInputBuilder()
        .setCustomId('button_text')
        .setLabel('Button Text')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Join VC')
        .setRequired(true)
        .setMaxLength(80)
        .setValue(guildConfig.greeting.buttonText || 'Join VC');

    const row = new ActionRowBuilder().addComponents(textInput);
    modal.addComponents(row);

    await interaction.showModal(modal);

    try {
        const modalInteraction = await interaction.awaitModalSubmit({ time: 300000 });
        const buttonText = modalInteraction.fields.getTextInputValue('button_text');
        
        await Guild.findOneAndUpdate(
            { guildId: guildConfig.guildId },
            { $set: { 'greeting.buttonText': buttonText } },
            { new: true }
        );

        guildConfig.greeting.buttonText = buttonText;

        await modalInteraction.reply({ 
            content: `${emojis.check} Button text set to: **${buttonText}**`,
            flags: MessageFlags.Ephemeral
        });
    } catch (error) {
        if (error.code === 'InteractionCollectorError') {
            console.log('⏰ Modal timed out for button text edit');
        } else {
            console.error('❌ Error setting button text:', error);
        }
    }
}

async function setButtonChannel(interaction, guildConfig) {
    const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId('button_channel_select')
        .setPlaceholder('Select channel for button')
        .setChannelTypes(ChannelType.GuildVoice, ChannelType.GuildText);

    const row = new ActionRowBuilder().addComponents(channelSelect);

    await interaction.reply({
        content: 'Select a channel for the button:',
        components: [row],
        flags: MessageFlags.Ephemeral
    });

    try {
        const channelInteraction = await interaction.channel.awaitMessageComponent({
            filter: (i) => i.user.id === interaction.user.id && i.customId === 'button_channel_select',
            time: 60000
        });

        const selectedChannel = channelInteraction.values[0];
        
        await Guild.findOneAndUpdate(
            { guildId: guildConfig.guildId },
            { $set: { 'greeting.buttonChannelId': selectedChannel } },
            { new: true }
        );

        guildConfig.greeting.buttonChannelId = selectedChannel;

        await channelInteraction.update({ 
            content: `${emojis.check} Button channel set to <#${selectedChannel}>.`,
            components: []
        });
    } catch (error) {
        if (error.code === 'InteractionCollectorError') {
            console.log('⏰ Button channel selection timed out');
            await interaction.editReply({ 
                content: 'Selection timed out.',
                components: []
            }).catch(() => {});
        } else {
            console.error('❌ Error setting button channel:', error);
        }
    }
}

async function testGreeting(interaction, guildConfig) {
    if (!guildConfig.greeting.enabled) {
        return interaction.reply({ 
            embeds: [createEmbed('default', 'System Disabled', `${emojis.deny} Enable the greeting system first.`)],
            flags: MessageFlags.Ephemeral
        });
    }

    const embed = createEmbed('default', 'Welcome!', '');
    embed.setColor(guildConfig.greeting.embedColor || '#2f3136');
    
    let description = guildConfig.greeting.message
        .replace(/\$user/g, `${interaction.user}`)
        .replace(/\$username/g, interaction.user.username)
        .replace(/\$server/g, interaction.guild.name)
        .replace(/\$membercount/g, interaction.guild.memberCount.toString());

    embed.setDescription(description);

    if (guildConfig.greeting.showAvatar) {
        embed.setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }));
    }

    if (guildConfig.greeting.showMemberCount) {
        embed.setFooter({ 
            text: `Member #${interaction.guild.memberCount}`,
            iconURL: interaction.guild.iconURL({ dynamic: true })
        });
    }

    const components = [];
    
    if (guildConfig.greeting.buttonEnabled && guildConfig.greeting.buttonChannelId) {
        const button = new ButtonBuilder()
            .setCustomId('test_button')
            .setLabel(guildConfig.greeting.buttonText || 'Join VC')
            .setEmoji(emojis.mic)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true);

        components.push(new ActionRowBuilder().addComponents(button));
    }

    let testContent = '🧪 **Test Preview:**';
    if (guildConfig.greeting.mentionUser) {
        testContent += `\n${interaction.user}`;
    }

    await interaction.reply({ 
        content: testContent,
        embeds: [embed], 
        components: components,
        flags: MessageFlags.Ephemeral
    });
}

async function showDebugInfo(interaction, guildConfig) {
    try {
        const dbConfig = await Guild.findOne({ guildId: guildConfig.guildId });
        
        const debugEmbed = createEmbed('default', 'Debug Information', '')
            .addFields(
                {
                    name: 'Database Values',
                    value: [
                        `Enabled: ${dbConfig?.greeting?.enabled || 'undefined'}`,
                        `Channel: ${dbConfig?.greeting?.channelId || 'null'}`,
                        `Total Greetings: ${dbConfig?.greeting?.totalGreetings || 'undefined'}`,
                        `Message Length: ${dbConfig?.greeting?.message?.length || 0} chars`
                    ].join('\n'),
                    inline: true
                },
                {
                    name: 'Local Cache Values',
                    value: [
                        `Enabled: ${guildConfig?.greeting?.enabled || 'undefined'}`,
                        `Channel: ${guildConfig?.greeting?.channelId || 'null'}`,
                        `Total Greetings: ${guildConfig?.greeting?.totalGreetings || 'undefined'}`,
                        `Message Length: ${guildConfig?.greeting?.message?.length || 0} chars`
                    ].join('\n'),
                    inline: true
                },
                {
                    name: 'Schema Check',
                    value: [
                        `totalGreetings field exists: ${dbConfig?.greeting?.hasOwnProperty('totalGreetings') ? '✅' : '❌'}`,
                        `mentionUser field exists: ${dbConfig?.greeting?.hasOwnProperty('mentionUser') ? '✅' : '❌'}`,
                        `buttonEnabled field exists: ${dbConfig?.greeting?.hasOwnProperty('buttonEnabled') ? '✅' : '❌'}`
                    ].join('\n'),
                    inline: false
                }
            );

        await interaction.reply({
            embeds: [debugEmbed],
            flags: MessageFlags.Ephemeral
        });
    } catch (error) {
        console.error('❌ Error showing debug info:', error);
        await interaction.reply({
            content: 'Error retrieving debug information.',
            flags: MessageFlags.Ephemeral
        });
    }
}

async function resetGreetingsCounter(interaction, guildConfig) {
    try {
        const updatedConfig = await Guild.findOneAndUpdate(
            { guildId: guildConfig.guildId },
            { $set: { 'greeting.totalGreetings': 0 } },
            { new: true }
        );

        if (updatedConfig) {
            guildConfig.greeting.totalGreetings = 0;
        }

        await interaction.reply({ 
            embeds: [createEmbed('default', 'Counter Reset', `${emojis.check} Total greetings counter has been reset to **0**.`)],
            flags: MessageFlags.Ephemeral
        });
    } catch (error) {
        console.error('❌ Error resetting counter:', error);
        await interaction.reply({ 
            embeds: [createEmbed('default', 'Error', 'Failed to reset greetings counter.')],
            flags: MessageFlags.Ephemeral
        });
    }
}

async function refreshMainEmbed(response, guildConfig, guildData, interaction = null) {
    try {
        const freshConfig = await Guild.findOne({ guildId: guildConfig.guildId });
        if (!freshConfig) return;

        Object.assign(guildConfig.greeting, freshConfig.greeting);

        const { embed, components } = createMainEmbed(freshConfig.greeting, guildData);

        if (interaction) {
            await interaction.update({ embeds: [embed], components });
        } else {
            await response.edit({ embeds: [embed], components });
        }
    } catch (error) {
        console.error('❌ Error refreshing embed:', error);
    }
}