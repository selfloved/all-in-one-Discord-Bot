const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { sendMassDM } = require('../commands/giveaway/massdm');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        if (interaction.isStringSelectMenu() && interaction.customId === 'massdm_giveaway_select') {
            await handleMassDMSelection(interaction, client);
        }
        
        if (interaction.isButton() && interaction.customId.startsWith('massdm_')) {
            await handleMassDMConfirmation(interaction, client);
        }
    },
};

async function handleMassDMSelection(interaction, client) {
    try {
        await interaction.deferReply({ ephemeral: true });
        
        const pendingData = client.pendingMassDM?.get(interaction.message.id);
        if (!pendingData) {
            return interaction.editReply('This mass DM session has expired. Please run the command again.');
        }
        
        const member = await interaction.guild.members.fetch(interaction.user.id);
        const botOwnerId = process.env.OWNER_ID || client.application?.owner?.id;
        if (member.id !== interaction.guild.ownerId && member.id !== botOwnerId) {
            return interaction.editReply('Only the server owner or bot owner can use this feature.');
        }
        
        const selectedGiveawayId = interaction.values[0];
        const selectedGiveaway = pendingData.giveaways.find(g => g._id.toString() === selectedGiveawayId);
        
        if (!selectedGiveaway) {
            return interaction.editReply('Selected giveaway not found.');
        }
        
        const confirmEmbed = new EmbedBuilder()
            .setTitle('⚠️ Mass DM Confirmation')
            .setDescription(`Are you sure you want to send DMs to **${pendingData.targetMembers.size}** members about this giveaway?`)
            .addFields([
                { name: '🎁 Giveaway Prize', value: selectedGiveaway.prize, inline: false },
                { name: '👥 Target Members', value: `${pendingData.targetMembers.size} members`, inline: true },
                { name: '⏱️ Estimated Time', value: `~${Math.ceil(pendingData.targetMembers.size * 2 / 60)} minutes`, inline: true },
                { name: '📝 Note', value: 'Users with DMs disabled will be automatically skipped.', inline: false }
            ])
            .setColor(0xff9900)
            .setTimestamp();
        
        const confirmRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`massdm_confirm_${selectedGiveawayId}`)
                    .setLabel('Start Mass DM')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('📨'),
                new ButtonBuilder()
                    .setCustomId('massdm_cancel')
                    .setLabel('Cancel')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('❌')
            );
        
        await interaction.editReply({ embeds: [confirmEmbed], components: [confirmRow] });
        
    } catch (error) {
        console.error('Mass DM selection error:', error);
        await interaction.editReply('An error occurred while processing your selection.');
    }
}

async function handleMassDMConfirmation(interaction, client) {
    try {
        await interaction.deferReply({ ephemeral: true });
        
        if (interaction.customId === 'massdm_cancel') {
            return interaction.editReply('Mass DM cancelled.');
        }
        
        const messageId = interaction.message.reference?.messageId || interaction.message.id;
        const pendingData = client.pendingMassDM?.get(messageId);
        if (!pendingData) {
            return interaction.editReply('This mass DM session has expired. Please run the command again.');
        }
        
        const giveawayId = interaction.customId.split('_')[2];
        const selectedGiveaway = pendingData.giveaways.find(g => g._id.toString() === giveawayId);
        
        if (!selectedGiveaway) {
            return interaction.editReply('Selected giveaway not found.');
        }
        
        const member = await interaction.guild.members.fetch(interaction.user.id);
        const botOwnerId = process.env.OWNER_ID || client.application?.owner?.id;
        if (member.id !== interaction.guild.ownerId && member.id !== botOwnerId) {
            return interaction.editReply('Only the server owner or bot owner can use this feature.');
        }
        
        await interaction.editReply('🚀 Starting mass DM process... This may take a while.');
        
        const progressEmbed = new EmbedBuilder()
            .setTitle('📨 Mass DM in Progress')
            .setDescription(`Sending DMs about: **${selectedGiveaway.prize}**`)
            .addFields([
                { name: '📊 Progress', value: '0%', inline: true },
                { name: '✅ Successful', value: '0', inline: true },
                { name: '❌ Failed', value: '0', inline: true },
                { name: '🔒 DMs Closed', value: '0', inline: true },
                { name: '📝 Status', value: 'Starting...', inline: false }
            ])
            .setColor(0x00ff00)
            .setTimestamp();
        
        const progressMessage = await interaction.followUp({ embeds: [progressEmbed] });
        
        const updateProgress = async (results, processed) => {
            const percentage = Math.floor((processed / results.total) * 100);
            
            const updatedEmbed = new EmbedBuilder()
                .setTitle('📨 Mass DM in Progress')
                .setDescription(`Sending DMs about: **${selectedGiveaway.prize}**`)
                .addFields([
                    { name: '📊 Progress', value: `${percentage}% (${processed}/${results.total})`, inline: true },
                    { name: '✅ Successful', value: results.success.toString(), inline: true },
                    { name: '❌ Failed', value: results.failed.toString(), inline: true },
                    { name: '🔒 DMs Closed', value: results.dmsClosed.toString(), inline: true },
                    { name: '📝 Status', value: processed === results.total ? 'Completed!' : 'Sending DMs...', inline: false }
                ])
                .setColor(processed === results.total ? 0x00ff00 : 0xffaa00)
                .setTimestamp();
            
            try {
                await progressMessage.edit({ embeds: [updatedEmbed] });
            } catch (error) {
                console.error('Failed to update progress message:', error);
            }
        };
        
        const finalResults = await sendMassDM(client, selectedGiveaway, pendingData.targetMembers, updateProgress);
        
        const resultsEmbed = new EmbedBuilder()
            .setTitle('✅ Mass DM Complete')
            .setDescription(`Mass DM campaign finished for: **${selectedGiveaway.prize}**`)
            .addFields([
                { name: '📊 Total Attempted', value: finalResults.total.toString(), inline: true },
                { name: '✅ Successfully Sent', value: finalResults.success.toString(), inline: true },
                { name: '❌ Failed', value: finalResults.failed.toString(), inline: true },
                { name: '🔒 DMs Disabled', value: finalResults.dmsClosed.toString(), inline: true },
                { name: '📈 Success Rate', value: `${Math.floor((finalResults.success / finalResults.total) * 100)}%`, inline: true }
            ])
            .setColor(0x00ff00)
            .setTimestamp();
        
        await interaction.followUp({ embeds: [resultsEmbed] });
        
        if (client.pendingMassDM) {
            client.pendingMassDM.delete(messageId);
        }
        
    } catch (error) {
        console.error('Mass DM confirmation error:', error);
        await interaction.editReply('An error occurred while starting the mass DM process.');
    }
}