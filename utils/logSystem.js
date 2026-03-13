const logs = [];
const MAX_LOGS = 50;

const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

function addLog(type, message, timestamp = new Date()) {
    const logEntry = {
        type,
        message: String(message),
        timestamp
    };
    
    logs.push(logEntry);
    
    if (logs.length > MAX_LOGS) {
        logs.shift();
    }
}

console.log = function(...args) {
    const message = args.join(' ');
    addLog('info', message);
    originalLog.apply(console, args);
};

console.error = function(...args) {
    const message = args.join(' ');
    addLog('error', message);
    originalError.apply(console, args);
};

console.warn = function(...args) {
    const message = args.join(' ');
    addLog('warn', message);
    originalWarn.apply(console, args);
};

function getRecentLogs(count = 15) {
    return logs.slice(-count);
}

function getLogStats() {
    const recent = logs.slice(-50);
    const stats = {
        total: recent.length,
        info: recent.filter(log => log.type === 'info').length,
        error: recent.filter(log => log.type === 'error').length,
        warn: recent.filter(log => log.type === 'warn').length
    };
    return stats;
}

module.exports = {
    getRecentLogs,
    getLogStats,
    addLog
};