const fs = require('fs');
const path = require('path');

class Logger {
    constructor() {
        this.logDir = process.env.LOG_DIR || './logs';
        this.logLevel = process.env.LOG_LEVEL || 'info';
        this.maxLogSize = parseInt(process.env.MAX_LOG_SIZE) || 10 * 1024 * 1024; //10Mb
        this.maxLogFiles = parseInt(process.env.MAX_LOG_FILES) || 5;
        
        this.levels = {
            error: 0,
            warn: 1,
            info: 2,
            debug: 3
        };
        
        this.colors = {
            error: '\x1b[31m',
            warn: '\x1b[33m', 
            info: '\x1b[36m',
            debug: '\x1b[37m',
            reset: '\x1b[0m'
        };

        this.ensureLogDirectory();
        this.setupLogRotation();
    }

    ensureLogDirectory() {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    setupLogRotation() {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        
        const timeUntilMidnight = tomorrow.getTime() - now.getTime();
        
        setTimeout(() => {
            this.rotateLogFiles();
            setInterval(() => {
                this.rotateLogFiles();
            }, 24 * 60 * 60 * 1000);
        }, timeUntilMidnight);
    }

    rotateLogFiles() {
        const logFile = path.join(this.logDir, 'bot.log');
        
        if (fs.existsSync(logFile)) {
            const stats = fs.statSync(logFile);
            
            if (stats.size > this.maxLogSize || this.shouldRotateByDate(stats.mtime)) {
                const timestamp = new Date().toISOString().slice(0, 10);
                const rotatedFile = path.join(this.logDir, `bot-${timestamp}.log`);
                
                try {
                    fs.renameSync(logFile, rotatedFile);
                    this.cleanOldLogFiles();
                } catch (error) {
                    console.error('Failed to rotate log files:', error);
                }
            }
        }
    }

    shouldRotateByDate(fileDate) {
        const now = new Date();
        const fileDay = new Date(fileDate).toDateString();
        const today = now.toDateString();
        return fileDay !== today;
    }

    cleanOldLogFiles() {
        try {
            const files = fs.readdirSync(this.logDir)
                .filter(file => file.startsWith('bot-') && file.endsWith('.log'))
                .map(file => ({
                    name: file,
                    path: path.join(this.logDir, file),
                    mtime: fs.statSync(path.join(this.logDir, file)).mtime
                }))
                .sort((a, b) => b.mtime - a.mtime);

            if (files.length > this.maxLogFiles) {
                const filesToDelete = files.slice(this.maxLogFiles);
                filesToDelete.forEach(file => {
                    try {
                        fs.unlinkSync(file.path);
                    } catch (error) {
                        console.error(`Failed to delete old log file ${file.name}:`, error);
                    }
                });
            }
        } catch (error) {
            console.error('Failed to clean old log files:', error);
        }
    }

    formatMessage(level, message, meta = {}) {
        const timestamp = new Date().toISOString();
        const metaString = Object.keys(meta).length > 0 ? JSON.stringify(meta) : '';
        return `[${timestamp}] ${level.toUpperCase()}: ${message} ${metaString}`.trim();
    }

    writeToFile(level, message, meta = {}) {
        if (!this.shouldLog(level)) return;

        const logFile = path.join(this.logDir, 'bot.log');
        const formattedMessage = this.formatMessage(level, message, meta);
        
        try {
            fs.appendFileSync(logFile, formattedMessage + '\n');
        } catch (error) {
            console.error('Failed to write to log file:', error);
        }
    }

    writeToConsole(level, message, meta = {}) {
        if (!this.shouldLog(level)) return;

        const color = this.colors[level] || this.colors.info;
        const timestamp = new Date().toLocaleTimeString();
        const metaString = Object.keys(meta).length > 0 ? JSON.stringify(meta, null, 2) : '';
        
        console.log(`${color}[${timestamp}] ${level.toUpperCase()}:${this.colors.reset} ${message}`);
        
        if (metaString) {
            console.log(`${color}${metaString}${this.colors.reset}`);
        }
    }

    shouldLog(level) {
        return this.levels[level] <= this.levels[this.logLevel];
    }

    error(message, meta = {}) {
        this.writeToConsole('error', message, meta);
        this.writeToFile('error', message, meta);
        
        if (meta.stack) {
            this.writeToFile('error', meta.stack);
        }
        if (meta instanceof Error) {
            this.writeToFile('error', meta.stack);
        }
    }

    warn(message, meta = {}) {
        this.writeToConsole('warn', message, meta);
        this.writeToFile('warn', message, meta);
    }

    info(message, meta = {}) {
        this.writeToConsole('info', message, meta);
        this.writeToFile('info', message, meta);
    }

    debug(message, meta = {}) {
        this.writeToConsole('debug', message, meta);
        this.writeToFile('debug', message, meta);
    }

    apiRequest(endpoint, method, statusCode, responseTime, userId = null) {
        const meta = {
            endpoint,
            method,
            statusCode,
            responseTime: `${responseTime}ms`,
            userId
        };

        if (statusCode >= 400) {
            this.error(`API Request Failed: ${method} ${endpoint}`, meta);
        } else {
            this.info(`API Request: ${method} ${endpoint}`, meta);
        }
    }

    userAction(userId, action, details = {}) {
        this.info(`User Action: ${action}`, {
            userId,
            action,
            ...details
        });
    }

    system(event, details = {}) {
        this.info(`System Event: ${event}`, {
            event,
            ...details
        });
    }

    getRecentLogs(lines = 100) {
        const logFile = path.join(this.logDir, 'bot.log');
        
        if (!fs.existsSync(logFile)) {
            return [];
        }

        try {
            const content = fs.readFileSync(logFile, 'utf8');
            const allLines = content.split('\n').filter(line => line.trim());
            return allLines.slice(-lines);
        } catch (error) {
            this.error('Failed to read log file:', error);
            return [];
        }
    }

    getLogStats() {
        const logFile = path.join(this.logDir, 'bot.log');
        
        if (!fs.existsSync(logFile)) {
            return { exists: false };
        }

        try {
            const stats = fs.statSync(logFile);
            const content = fs.readFileSync(logFile, 'utf8');
            const lines = content.split('\n').filter(line => line.trim());
            
            const levelCounts = {
                ERROR: 0,
                WARN: 0,
                INFO: 0,
                DEBUG: 0
            };

            lines.forEach(line => {
                for (const level of Object.keys(levelCounts)) {
                    if (line.includes(`${level}:`)) {
                        levelCounts[level]++;
                        break;
                    }
                }
            });

            return {
                exists: true,
                size: stats.size,
                modified: stats.mtime,
                totalLines: lines.length,
                levelCounts
            };
        } catch (error) {
            this.error('Failed to get log stats:', error);
            return { exists: true, error: error.message };
        }
    }
}

const logger = new Logger();

module.exports = logger;
