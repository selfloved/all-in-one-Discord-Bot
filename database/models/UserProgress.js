const mongoose = require('mongoose');

const userProgressSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true
    },
    guildId: {
        type: String,
        required: true
    },
    giveawayId: {
        type: String,
        required: true
    },
    entryTime: {
        type: Date,
        required: true
    },
    messagesAtEntry: {
        type: Number,
        default: 0
    },
    voiceTimeAtEntry: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

userProgressSchema.index({ userId: 1, guildId: 1, giveawayId: 1 });

module.exports = mongoose.model('UserProgress', userProgressSchema);