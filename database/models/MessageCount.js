const mongoose = require('mongoose');

const messageCountSchema = new mongoose.Schema({
    userId: String,
    guildId: String,
    messageCount: { type: Number, default: 0 },
    lastMessageTime: Date
}, {
    timestamps: true
});

messageCountSchema.index({ userId: 1, guildId: 1 });

module.exports = mongoose.model('MessageCount', messageCountSchema);