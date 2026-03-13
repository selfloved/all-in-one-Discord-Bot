const mongoose = require('mongoose');

const voicemasterSchema = new mongoose.Schema({
    guildId: {
        type: String,
        required: true,
        unique: true
    },
    channelId: {
        type: String,
        required: true
    },
    categoryId: {
        type: String,
        required: true
    },
    interfaceChannelId: {
        type: String,
        required: true
    },
    interfaceMessageId: {
        type: String,
        default: null
    },
    voiceCategoryId: {
        type: String,
        required: true
    },
    logChannelId: {
        type: String,
        default: null
    }
}, {
    timestamps: true
});

const tempChannelSchema = new mongoose.Schema({
    guildId: {
        type: String,
        required: true
    },
    channelId: {
        type: String,
        required: true,
        unique: true
    },
    ownerId: {
        type: String,
        required: true
    }
}, {
    timestamps: true
});

const voicePermitSchema = new mongoose.Schema({
    channelId: {
        type: String,
        required: true
    },
    userId: {
        type: String,
        required: true
    }
}, {
    timestamps: true
});

const voiceBanSchema = new mongoose.Schema({
    channelId: {
        type: String,
        required: true
    },
    userId: {
        type: String,
        required: true
    }
}, {
    timestamps: true
});

voicePermitSchema.index({ channelId: 1, userId: 1 }, { unique: true });
voiceBanSchema.index({ channelId: 1, userId: 1 }, { unique: true });

module.exports = {
    Voicemaster: mongoose.model('Voicemaster', voicemasterSchema),
    TempChannel: mongoose.model('TempChannel', tempChannelSchema),
    VoicePermit: mongoose.model('VoicePermit', voicePermitSchema),
    VoiceBan: mongoose.model('VoiceBan', voiceBanSchema)
};