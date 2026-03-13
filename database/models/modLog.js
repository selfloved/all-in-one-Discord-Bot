const mongoose = require('mongoose');

const modLogSchema = new mongoose.Schema({
    guildId: {
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
    targetId: {
        type: String,
        required: true
    },
    targetTag: {
        type: String,
        required: true
    },
    action: {
        type: String,
        required: true,
        enum: ['ban', 'unban', 'kick', 'timeout', 'untimeout', 'hardban', 'unhardban', 'nuke', 'roleall', 'lock', 'unlock', 'warn']
    },
    reason: {
        type: String,
        required: true
    },
    duration: {
        type: Number,
        default: null
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    isHardban: {
        type: Boolean,
        default: false
    }
});

modLogSchema.index({ guildId: 1, timestamp: -1 });
modLogSchema.index({ targetId: 1, guildId: 1 });
modLogSchema.index({ moderatorId: 1, guildId: 1 });

module.exports = mongoose.model('ModLog', modLogSchema);