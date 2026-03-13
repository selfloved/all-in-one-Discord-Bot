const mongoose = require('mongoose');

const giveawaySchema = new mongoose.Schema({
    messageId: {
        type: String,
        required: true,
        unique: true
    },
    channelId: {
        type: String,
        required: true
    },
    guildId: {
        type: String,
        required: true
    },
    hostId: {
        type: String,
        required: true
    },
    title: {
        type: String,
        required: true
    },
    prize: {
        type: String,
        required: true
    },
    description: {
        type: String,
        default: ''
    },
    winners: {
        type: Number,
        required: true,
        default: 1
    },
    endTime: {
        type: Date,
        required: true
    },
    ended: {
        type: Boolean,
        default: false
    },
    entries: [{
        type: String
    }],
    winnerIds: [{
        type: String
    }],
    rigged: [{
        type: String
    }],
    requirements: {
        statusCheck: {
            type: Boolean,
            default: false
        },
        statusText: {
            type: String,
            default: null
        },
        vcTime: {
            type: Number,
            default: null
        },
        messageCount: {
            type: Number,
            default: null
        },
        mustBeInVC: {
            type: Boolean,
            default: false
        }
    },
    trackingData: [{
        userId: {
            type: String,
            required: true
        },
        startTime: {
            type: Date,
            required: true,
            default: Date.now
        },
        messageCount: {
            type: Number,
            default: 0
        },
        lastStatusCheck: {
            type: Date,
            default: Date.now
        },
        currentStatus: {
            type: String,
            default: 'No custom status'
        },
        inVoiceChat: {
            type: Boolean,
            default: false
        },
        lastVCJoin: {
            type: Date,
            default: null
        },
        vcChannelId: {
            type: String,
            default: null
        }
    }]
}, {
    timestamps: true
});

giveawaySchema.index({ guildId: 1, ended: 1 });
giveawaySchema.index({ messageId: 1, guildId: 1 });
giveawaySchema.index({ endTime: 1 });
giveawaySchema.index({ 'trackingData.userId': 1 });
giveawaySchema.index({ 'requirements.statusCheck': 1, ended: 1 });

giveawaySchema.pre('save', function(next) {
    if (this.ended && this.trackingData && this.trackingData.length > 0) {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        if (this.updatedAt < oneDayAgo) {
            this.trackingData = [];
        }
    }
    next();
});

giveawaySchema.methods.getUserTracking = function(userId) {
    return this.trackingData ? this.trackingData.find(t => t.userId === userId) : null;
};

giveawaySchema.methods.updateUserTracking = function(userId, updateData) {
    const userTracking = this.getUserTracking(userId);
    if (userTracking) {
        Object.assign(userTracking, updateData);
    }
    return userTracking;
};

giveawaySchema.methods.incrementUserMessages = function(userId) {
    const userTracking = this.getUserTracking(userId);
    if (userTracking) {
        userTracking.messageCount += 1;
        return userTracking.messageCount;
    }
    return 0;
};

giveawaySchema.statics.findActiveWithRequirements = function() {
    return this.find({
        ended: false,
        $or: [
            { 'requirements.statusCheck': true },
            { 'requirements.vcTime': { $gt: 0 } },
            { 'requirements.messageCount': { $gt: 0 } },
            { 'requirements.mustBeInVC': true }
        ]
    });
};

giveawaySchema.statics.findByUserEntry = function(userId, guildId = null) {
    const query = {
        entries: userId,
        ended: false
    };
    
    if (guildId) {
        query.guildId = guildId;
    }
    
    return this.find(query);
};

module.exports = mongoose.model('Giveaway', giveawaySchema);