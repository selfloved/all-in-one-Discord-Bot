const mongoose = require('mongoose');

const vcTimeSchema = new mongoose.Schema({
    userId: String,
    guildId: String,
    totalTime: { type: Number, default: 0 },
    currentSession: {
        channelId: String,
        startTime: Date
    }
}, {
    timestamps: true
});

vcTimeSchema.index({ userId: 1, guildId: 1 });

module.exports = mongoose.model('VCTime', vcTimeSchema);