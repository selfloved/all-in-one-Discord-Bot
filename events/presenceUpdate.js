const { handlePresenceUpdate } = require('./vanityEvents');

module.exports = {
    name: 'presenceUpdate',
    async execute(oldPresence, newPresence) {
        await handlePresenceUpdate(oldPresence, newPresence);
    }
};