const mongoose = require('mongoose');

const guildSchema = new mongoose.Schema({
    guildId: {
        type: String,
        required: true,
        unique: true
    },
    guildName: {
        type: String,
        required: true
    },
    prefix: {
        type: String,
        default: '!'
    },
    welcomeChannel: {
        type: String,
        default: null
    },
    logChannel: {
        type: String,
        default: null
    },
    autoRole: {
        type: String,
        default: null
    },
    antiInviteEnabled: {
        type: Boolean,
        default: false
    },
    settings: {
        welcomeEnabled: {
            type: Boolean,
            default: false
        },
        loggingEnabled: {
            type: Boolean,
            default: false
        },
        autoRoleEnabled: {
            type: Boolean,
            default: false
        }
    },
    greeting: {
        enabled: {
            type: Boolean,
            default: false
        },
        channelId: {
            type: String,
            default: null
        },
        message: {
            type: String,
            default: 'Welcome to the server, $user!'
        },
        embedColor: {
            type: String,
            default: '#2f3136'
        },
        showAvatar: {
            type: Boolean,
            default: true
        },
        showMemberCount: {
            type: Boolean,
            default: true
        },
        mentionUser: {
            type: Boolean,
            default: true
        },
        buttonEnabled: {
            type: Boolean,
            default: false
        },
        buttonText: {
            type: String,
            default: 'Join VC'
        },
        buttonChannelId: {
            type: String,
            default: null
        },
        totalGreetings: {
            type: Number,
            default: 0
        }
    },
    vanity: {
        enabled: {
            type: Boolean,
            default: false
        },
        roleId: {
            type: String,
            default: null
        },
        channelId: {
            type: String,
            default: null
        },
        vanityText: {
            type: String,
            default: '/vanity'
        },
        autoReplyMessage: {
            type: String,
            default: 'put {vanity} in your status, put yourself online (not offline), and keep it there to keep your perms'
        },
        currentUsers: [{
            userId: String,
            addedAt: {
                type: Date,
                default: Date.now
            }
        }]
    },
    leaderboard: {
        enabled: {
            type: Boolean,
            default: false
        },
        channelId: {
            type: String,
            default: null
        },
        messageId: {
            type: String,
            default: null
        },
        
        messageRewards: {
            enabled: {
                type: Boolean,
                default: false
            },
            roles: {
                first: [{
                    type: String
                }],
                second: [{
                    type: String
                }],
                third: [{
                    type: String
                }],
                allTop3: [{
                    type: String
                }]
            }
        },
        
        vcRewards: {
            enabled: {
                type: Boolean,
                default: false
            },
            roles: {
                first: [{
                    type: String
                }],
                second: [{
                    type: String
                }],
                third: [{
                    type: String
                }],
                allTop3: [{
                    type: String
                }]
            }
        },
        
        autoRefresh: {
            type: Boolean,
            default: true
        },
        refreshInterval: {
            type: Number,
            default: 3
        },
        
        embedColor: {
            type: String,
            default: '#2f3136'
        },
        showTop: {
            type: Number,
            default: 10
        },
        
        lastRefresh: {
            type: Date,
            default: Date.now
        },
        
        currentMonth: {
            type: String,
            default: () => {
                const now = new Date();
                return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            }
        }
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Guild', guildSchema);