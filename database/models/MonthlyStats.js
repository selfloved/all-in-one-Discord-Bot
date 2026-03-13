const mongoose = require('mongoose');

const monthlyStatsSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true
    },
    guildId: {
        type: String,
        required: true
    },
    month: {
        type: String,
        required: true
    },
    year: {
        type: Number,
        required: true
    },
    monthNumber: {
        type: Number,
        required: true
    },
    
    messageCount: {
        type: Number,
        default: 0
    },
    
    vcTimeMinutes: {
        type: Number,
        default: 0
    },
    
    dailyMessages: [{
        day: Number,
        count: Number
    }],
    
    dailyVcTime: [{
        day: Number,
        minutes: Number
    }],
    
    username: String,
    displayName: String,
    
    lastMessageUpdate: {
        type: Date,
        default: Date.now
    },
    lastVcUpdate: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

monthlyStatsSchema.index({ guildId: 1, month: 1, messageCount: -1 });
monthlyStatsSchema.index({ guildId: 1, month: 1, vcTimeMinutes: -1 });
monthlyStatsSchema.index({ userId: 1, guildId: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('MonthlyStats', monthlyStatsSchema);