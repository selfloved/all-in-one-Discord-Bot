const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        unique: true
    },
    username: {
        type: String,
        required: true
    },
    level: {
        type: Number,
        default: 1
    },
    xp: {
        type: Number,
        default: 0
    },
    coins: {
        type: Number,
        default: 100
    },
    lastDaily: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('User', userSchema);