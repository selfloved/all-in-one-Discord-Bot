const { EmbedBuilder } = require('discord.js');

const colors = {
    success: 0x00ff00,
    error: 0xff0000,
    warning: 0xffff00,
    info: 0x5865F2,
    default: 0x2f3136
};

function createEmbed(type = 'default', title = '', description = '') {
    const embed = new EmbedBuilder()
        .setColor(colors[type] || colors.default)
        .setTimestamp();

    if (title) embed.setTitle(title);
    if (description) embed.setDescription(description);

    return embed;
}

function createErrorEmbed(title, description) {
    return createEmbed('error', title, description);
}

function createSuccessEmbed(title, description) {
    return createEmbed('success', title, description);
}

function createInfoEmbed(title, description) {
    return createEmbed('info', title, description);
}

function createLoadingEmbed(title, description) {
    return createEmbed('info', title, description);
}

function createWarningEmbed(title, description) {
    return createEmbed('warning', title, description);
}

module.exports = {
    createEmbed,
    createErrorEmbed,
    createSuccessEmbed,
    createInfoEmbed,
    createLoadingEmbed,
    createWarningEmbed,
    colors
};