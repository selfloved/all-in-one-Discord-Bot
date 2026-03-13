const mongoose = require('mongoose');

const leaderboardHistorySchema = new mongoose.Schema({
    guildId: {
        type: String,
        required: true
    },
    month: {
        type: String,
        required: true
    },
    topMessageSenders: [{
        userId: String,
        username: String,
        messageCount: Number
    }],
    topVoiceUsers: [{
        userId: String,
        username: String,
        vcTimeMinutes: Number
    }],
    fullLeaderboard: {
        messages: [{
            userId: String,
            username: String,
            messageCount: Number
        }],
        voice: [{
            userId: String,
            username: String,
            vcTimeMinutes: Number
        }]
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

leaderboardHistorySchema.index({ guildId: 1, month: -1 });
leaderboardHistorySchema.index({ guildId: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('LeaderboardHistory', leaderboardHistorySchema);