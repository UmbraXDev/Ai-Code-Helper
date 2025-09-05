const Logger = require('./logger');

class RateLimiter {
    constructor() {
        this.userLimits = new Map();
        this.globalLimits = new Map(); 
        
        this.config = {
            userRequestsPerMinute: parseInt(process.env.USER_REQUESTS_PER_MINUTE) || 10,
            userRequestsPerHour: parseInt(process.env.USER_REQUESTS_PER_HOUR) || 50,
            globalRequestsPerMinute: parseInt(process.env.GLOBAL_REQUESTS_PER_MINUTE) || 100,
            globalRequestsPerHour: parseInt(process.env.GLOBAL_REQUESTS_PER_HOUR) || 1000,
            
            premiumUserRequestsPerMinute: parseInt(process.env.PREMIUM_USER_REQUESTS_PER_MINUTE) || 30,
            premiumUserRequestsPerHour: parseInt(process.env.PREMIUM_USER_REQUESTS_PER_HOUR) || 200,
            
            cooldownPeriod: parseInt(process.env.COOLDOWN_PERIOD) || 60000, // 1 minute
            tempBanDuration: parseInt(process.env.TEMP_BAN_DURATION) || 300000, // 5 minutes
        };

        this.tempBans = new Map(); 
        this.premiumUsers = new Set(process.env.PREMIUM_USERS ? process.env.PREMIUM_USERS.split(',') : []);
        
        setInterval(() => this.cleanup(), 10 * 60 * 1000);
    }

    async checkRateLimit(userId, guildId = null) {
        const now = Date.now();
        
        if (this.tempBans.has(userId)) {
            const banExpiry = this.tempBans.get(userId);
            if (now < banExpiry) {
                const remainingTime = Math.ceil((banExpiry - now) / 1000);
                return {
                    allowed: false,
                    reason: 'temp_ban',
                    retryAfter: remainingTime,
                    message: `You are temporarily banned from using the bot. Try again in ${remainingTime} seconds.`
                };
            } else {
                this.tempBans.delete(userId);
            }
        }

        const userCheck = this.checkUserLimit(userId, now);
        if (!userCheck.allowed) {
            return userCheck;
        }

        const globalCheck = this.checkGlobalLimit(now);
        if (!globalCheck.allowed) {
            return globalCheck;
        }

        this.recordRequest(userId, now);
        this.recordGlobalRequest(now);

        return { allowed: true };
    }

    checkUserLimit(userId, now) {
        const isPremium = this.premiumUsers.has(userId);
        const minuteLimit = isPremium ? 
            this.config.premiumUserRequestsPerMinute : 
            this.config.userRequestsPerMinute;
        const hourLimit = isPremium ? 
            this.config.premiumUserRequestsPerHour : 
            this.config.userRequestsPerHour;

        if (!this.userLimits.has(userId)) {
            this.userLimits.set(userId, { requests: [], violations: 0 });
        }

        const userData = this.userLimits.get(userId);
        
        userData.requests = userData.requests.filter(time => now - time < 60 * 60 * 1000); 

        const recentMinute = userData.requests.filter(time => now - time < 60 * 1000).length;
        const recentHour = userData.requests.length;

        if (recentMinute >= minuteLimit) {
            userData.violations = (userData.violations || 0) + 1;
            
            if (userData.violations >= 3) {
                this.tempBans.set(userId, now + this.config.tempBanDuration);
                Logger.warn(`User ${userId} temporarily banned for rate limit violations`);
                return {
                    allowed: false,
                    reason: 'temp_ban_applied',
                    retryAfter: this.config.tempBanDuration / 1000,
                    message: `Too many violations! You've been temporarily banned for ${this.config.tempBanDuration / 1000} seconds.`
                };
            }

            const retryAfter = 60 - Math.floor((now - Math.max(...userData.requests.filter(time => now - time < 60 * 1000))) / 1000);
            return {
                allowed: false,
                reason: 'minute_limit',
                retryAfter: Math.max(retryAfter, 1),
                remaining: { minute: 0, hour: hourLimit - recentHour },
                message: `Rate limit exceeded! You can make ${minuteLimit} requests per minute. Try again in ${Math.max(retryAfter, 1)} seconds.`
            };
        }

        if (recentHour >= hourLimit) {
            const oldestRequest = Math.min(...userData.requests);
            const retryAfter = 60 * 60 - Math.floor((now - oldestRequest) / 1000);
            return {
                allowed: false,
                reason: 'hour_limit',
                retryAfter: Math.max(retryAfter, 1),
                remaining: { minute: minuteLimit - recentMinute, hour: 0 },
                message: `Hourly limit exceeded! You can make ${hourLimit} requests per hour. Try again in ${Math.floor(retryAfter / 60)} minutes.`
            };
        }

        if (userData.violations > 0) {
            userData.violations = Math.max(0, userData.violations - 0.1);
        }

        return { 
            allowed: true, 
            remaining: { 
                minute: minuteLimit - recentMinute, 
                hour: hourLimit - recentHour 
            } 
        };
    }

    checkGlobalLimit(now) {
        if (!this.globalLimits.has('global')) {
            this.globalLimits.set('global', { requests: [] });
        }

        const globalData = this.globalLimits.get('global');
        
        globalData.requests = globalData.requests.filter(time => now - time < 60 * 60 * 1000);

        const recentMinute = globalData.requests.filter(time => now - time < 60 * 1000).length;
        const recentHour = globalData.requests.length;

        if (recentMinute >= this.config.globalRequestsPerMinute) {
            return {
                allowed: false,
                reason: 'global_minute_limit',
                retryAfter: 60,
                message: 'The bot is currently experiencing high traffic. Please try again in a minute.'
            };
        }

        if (recentHour >= this.config.globalRequestsPerHour) {
            return {
                allowed: false,
                reason: 'global_hour_limit',
                retryAfter: 3600,
                message: 'The bot has reached its hourly request limit. Please try again later.'
            };
        }

        return { allowed: true };
    }

    recordRequest(userId, timestamp) {
        const userData = this.userLimits.get(userId);
        userData.requests.push(timestamp);
    }

    recordGlobalRequest(timestamp) {
        const globalData = this.globalLimits.get('global');
        globalData.requests.push(timestamp);
    }

    cleanup() {
        const now = Date.now();
        const oneHourAgo = now - 60 * 60 * 1000;

        for (const [userId, userData] of this.userLimits.entries()) {
            userData.requests = userData.requests.filter(time => time > oneHourAgo);
            if (userData.requests.length === 0 && (userData.violations || 0) === 0) {
                this.userLimits.delete(userId);
            }
        }

        const globalData = this.globalLimits.get('global');
        if (globalData) {
            globalData.requests = globalData.requests.filter(time => time > oneHourAgo);
        }

        for (const [userId, expiry] of this.tempBans.entries()) {
            if (now > expiry) {
                this.tempBans.delete(userId);
            }
        }

        Logger.info(`Rate limiter cleanup completed. Active users: ${this.userLimits.size}, Temp bans: ${this.tempBans.size}`);
    }

    getUserStats(userId) {
        const now = Date.now();
        const userData = this.userLimits.get(userId) || { requests: [], violations: 0 };
        const isPremium = this.premiumUsers.has(userId);
        
        const recentMinute = userData.requests.filter(time => now - time < 60 * 1000).length;
        const recentHour = userData.requests.filter(time => now - time < 60 * 60 * 1000).length;

        const minuteLimit = isPremium ? 
            this.config.premiumUserRequestsPerMinute : 
            this.config.userRequestsPerMinute;
        const hourLimit = isPremium ? 
            this.config.premiumUserRequestsPerHour : 
            this.config.userRequestsPerHour;

        return {
            isPremium,
            usage: {
                minute: { used: recentMinute, limit: minuteLimit },
                hour: { used: recentHour, limit: hourLimit }
            },
            violations: userData.violations || 0,
            tempBanned: this.tempBans.has(userId)
        };
    }

    addPremiumUser(userId) {
        this.premiumUsers.add(userId);
        Logger.info(`User ${userId} added to premium users`);
    }

    removePremiumUser(userId) {
        this.premiumUsers.delete(userId);
        Logger.info(`User ${userId} removed from premium users`);
    }

    clearUserLimits(userId) {
        this.userLimits.delete(userId);
        this.tempBans.delete(userId);
        Logger.info(`Rate limits cleared for user ${userId}`);
    }

    getGlobalStats() {
        const now = Date.now();
        const globalData = this.globalLimits.get('global') || { requests: [] };
        
        const recentMinute = globalData.requests.filter(time => now - time < 60 * 1000).length;
        const recentHour = globalData.requests.filter(time => now - time < 60 * 60 * 1000).length;

        return {
            usage: {
                minute: { used: recentMinute, limit: this.config.globalRequestsPerMinute },
                hour: { used: recentHour, limit: this.config.globalRequestsPerHour }
            },
            activeUsers: this.userLimits.size,
            tempBannedUsers: this.tempBans.size
        };
    }
}

module.exports = RateLimiter;
