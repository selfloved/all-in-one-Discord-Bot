const mongoose = require('mongoose');

const warningSchema = new mongoose.Schema({
    guildId: {
        type: String,
        required: true
    },
    userId: {
        type: String,
        required: true
    },
    userTag: {
        type: String,
        required: true
    },
    moderatorId: {
        type: String,
        required: true
    },
    moderatorTag: {
        type: String,
        required: true
    },
    reason: {
        type: String,
        required: true
    },
    warnNumber: {
        type: Number,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    messageContent: {
        type: String,
        default: null
    },
    messageUrl: {
        type: String,
        default: null
    },
    punishment: {
        type: String,
        default: null
    },
    active: {
        type: Boolean,
        default: true
    }
});

warningSchema.index({ guildId: 1, userId: 1, timestamp: -1 });
warningSchema.index({ guildId: 1, timestamp: -1 });

module.exports = mongoose.model('Warning', warningSchema);