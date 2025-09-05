const { Client, GatewayIntentBits, EmbedBuilder, ActivityType, ApplicationCommandOptionType } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const RateLimiter = require('./utils/rateLimiter');
const CodeHelper = require('./helpers/codeHelper');
const MessageHandler = require('./handlers/messageHandler');
const Logger = require('./utils/logger');
require('dotenv').config();

class AICodeHelperBot {
    constructor() {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.DirectMessages
            ]
        });

        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        this.rateLimiter = new RateLimiter();
        this.codeHelper = new CodeHelper(this.genAI);
        this.messageHandler = new MessageHandler(this.codeHelper, this.rateLimiter);
        
        this.setupEventListeners();
        this.setupActivityRotation();
    }

    setupEventListeners() {
        this.client.once('ready', async () => {
            Logger.info(`✅ ${this.client.user.tag} is online!`);
            Logger.info(`📊 Serving ${this.client.guilds.cache.size} servers`);
            Logger.info(`👥 Serving ${this.client.users.cache.size} users`);
            
            await this.registerCommands();
            this.setRandomActivity();
        });

    
        this.client.on('messageCreate', async (message) => {
            try {
                if (message.author.bot) return;
                
                const botMentioned = message.mentions.has(this.client.user);
                const isDM = message.channel.type === 1;
                const allowedChannel = process.env.ALLOWED_CHANNELS ? 
                    process.env.ALLOWED_CHANNELS.split(',').includes(message.channel.id) : true;
                
                if (botMentioned || allowedChannel || isDM) {
                    await this.messageHandler.handle(message);
                }
            } catch (error) {
                Logger.error('Error handling message:', error);
            }
        });

        this.client.on('interactionCreate', async (interaction) => {
            try {
                if (interaction.isChatInputCommand()) {
                    await this.handleSlashCommand(interaction);
                } else if (interaction.isButton()) {
                    await this.messageHandler.handleInteraction(interaction);
                }
            } catch (error) {
                Logger.error('Error handling interaction:', error);
                
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: 'An error occurred while processing your request.',
                        ephemeral: true
                    }).catch(() => {});
                }
            }
        });

        this.client.on('error', (error) => {
            Logger.error('Discord client error:', error);
        });

        this.client.on('disconnect', () => {
            Logger.warn('Bot disconnected from Discord');
        });

        this.client.on('reconnecting', () => {
            Logger.info('Bot reconnecting to Discord...');
        });
    }

    setupActivityRotation() {
        const activities = [
            { name: 'code being debugged 🐛', type: ActivityType.Watching },
            { name: 'with algorithms ⚡', type: ActivityType.Playing },
            { name: 'to developers 👂', type: ActivityType.Listening },
            { name: 'code reviews 👁️', type: ActivityType.Competing },
            { name: 'bugs get squashed 🔨', type: ActivityType.Watching },
            { name: 'Stack Overflow 📚', type: ActivityType.Competing },
            { name: '/help for commands ❓', type: ActivityType.Listening },
            { name: 'code compilation ⚙️', type: ActivityType.Watching },
            { name: 'JavaScript errors 🚨', type: ActivityType.Watching },
            { name: 'Python scripts 🐍', type: ActivityType.Playing },
            { name: 'React components ⚛️', type: ActivityType.Playing },
            { name: 'API responses 🌐', type: ActivityType.Listening }
        ];

        this.setRandomActivity(activities);

        this.activityInterval = setInterval(() => {
            this.setRandomActivity(activities);
        }, 10 * 60 * 1000);
    }

    setRandomActivity(activities) {
        const defaultActivities = [
            { name: 'code being debugged 🐛', type: ActivityType.Watching },
            { name: 'with algorithms ⚡', type: ActivityType.Playing },
            { name: 'to developers 👂', type: ActivityType.Listening }
        ];
        
        const activityList = activities || defaultActivities;
        const activity = activityList[Math.floor(Math.random() * activityList.length)];
        
        try {
            if (this.client.user) {
                this.client.user.setPresence({
                    activities: [activity],
                    status: 'online'
                });
                
                Logger.info(`🎭 Activity set to: ${activity.name}`);
            }
        } catch (error) {
            Logger.error('Error setting activity:', error);
        }
    }

    async handleSlashCommand(interaction) {
        await interaction.deferReply();

        const rateLimitResult = await this.rateLimiter.checkRateLimit(
            interaction.user.id,
            interaction.guild?.id
        );

        if (!rateLimitResult.allowed) {
            const embed = new EmbedBuilder()
                .setTitle('⏰ Rate Limited')
                .setDescription(rateLimitResult.message)
                .setColor(0xFFFF00)
                .setTimestamp();

            if (rateLimitResult.remaining) {
                embed.addFields([{
                    name: 'Remaining Requests',
                    value: `Minute: ${rateLimitResult.remaining.minute}\nHour: ${rateLimitResult.remaining.hour}`,
                    inline: true
                }]);
            }

            return await interaction.editReply({ embeds: [embed] });
        }

        const { commandName, options } = interaction;

        try {
            switch (commandName) {
                case 'help':
                    await this.handleHelpCommand(interaction);
                    break;
                case 'debug':
                    await this.handleDebugCommand(interaction, options);
                    break;
                case 'optimize':
                    await this.handleOptimizeCommand(interaction, options);
                    break;
                case 'explain':
                    await this.handleExplainCommand(interaction, options);
                    break;
                case 'review':
                    await this.handleReviewCommand(interaction, options);
                    break;
                case 'generate':
                    await this.handleGenerateCommand(interaction, options);
                    break;
                case 'stats':
                    await this.handleStatsCommand(interaction);
                    break;
                default:
                    await interaction.editReply({
                        content: '❌ Unknown command. Use `/help` to see available commands.'
                    });
            }
        } catch (error) {
            Logger.error(`Error handling /${commandName} command:`, error);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Command Error')
                .setDescription('An error occurred while processing your command. Please try again.')
                .setColor(0xFF0000)
                .setTimestamp();

            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }

    async handleHelpCommand(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('🤖 AI Code Helper - Commands')
            .setColor(0x0099FF)
            .setDescription('I can help you with coding tasks using AI assistance!')
            .addFields([
                {
                    name: '🐛 `/debug <code>`',
                    value: 'Debug your code and find errors',
                    inline: false
                },
                {
                    name: '⚡ `/optimize <code>`',
                    value: 'Optimize code for better performance',
                    inline: false
                },
                {
                    name: '📚 `/explain <code>`',
                    value: 'Get detailed code explanations',
                    inline: false
                },
                {
                    name: '👁️ `/review <code>`',
                    value: 'Get code quality review and feedback',
                    inline: false
                },
                {
                    name: '🚀 `/generate <description> [language]`',
                    value: 'Generate code from description',
                    inline: false
                },
                {
                    name: '📊 `/stats`',
                    value: 'Show bot statistics',
                    inline: false
                }
            ])
            .addFields([
                {
                    name: '💡 Tips',
                    value: '• Use code blocks: \\`\\`\\`js\\ncode here\\n\\`\\`\\`\n• Mention me in any channel\n• Dont Brak TOS\n• Use slash commands for quick actions',
                    inline: false
                }
            ])
            .setFooter({ text: 'AI Code Helper • Powered by Gemini AI' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    }

    async handleDebugCommand(interaction, options) {
        const code = options.getString('code');
        const language = this.extractLanguageFromCode(code) || 'javascript';

        const result = await this.codeHelper.debugCode(code, 'Debug this code', language);

        if (result.success) {
            const embed = new EmbedBuilder()
                .setTitle('🐛 Debug Analysis')
                .setDescription(this.formatCodeResponse(result.content))
                .setColor(0x00FF00)
                .setTimestamp()
                .setFooter({ text: 'AI Code Helper' });

            await interaction.editReply({ embeds: [embed] });
        } else {
            const embed = new EmbedBuilder()
                .setTitle('❌ Debug Failed')
                .setDescription(result.error || 'Unable to debug the provided code.')
                .setColor(0xFF0000)
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        }
    }

    async handleOptimizeCommand(interaction, options) {
        const code = options.getString('code');
        const language = this.extractLanguageFromCode(code) || 'javascript';

        const result = await this.codeHelper.optimizeCode(code, language);

        if (result.success) {
            const embed = new EmbedBuilder()
                .setTitle('⚡ Code Optimization')
                .setDescription(this.formatCodeResponse(result.content))
                .setColor(0x00FF00)
                .setTimestamp()
                .setFooter({ text: 'AI Code Helper' });

            await interaction.editReply({ embeds: [embed] });
        } else {
            const embed = new EmbedBuilder()
                .setTitle('❌ Optimization Failed')
                .setDescription(result.error || 'Unable to optimize the provided code.')
                .setColor(0xFF0000)
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        }
    }

    async handleExplainCommand(interaction, options) {
        const code = options.getString('code');
        const language = this.extractLanguageFromCode(code) || 'javascript';

        const result = await this.codeHelper.explainCode(code, language);

        if (result.success) {
            const embed = new EmbedBuilder()
                .setTitle('📚 Code Explanation')
                .setDescription(this.formatExplanation(result.content))
                .setColor(0x0099FF)
                .setTimestamp()
                .setFooter({ text: 'AI Code Helper' });

            await interaction.editReply({ embeds: [embed] });
        } else {
            const embed = new EmbedBuilder()
                .setTitle('❌ Explanation Failed')
                .setDescription(result.error || 'Unable to explain the provided code.')
                .setColor(0xFF0000)
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        }
    }

    async handleReviewCommand(interaction, options) {
        const code = options.getString('code');
        const language = this.extractLanguageFromCode(code) || 'javascript';

        const result = await this.codeHelper.reviewCode(code, language);

        if (result.success) {
            const embed = new EmbedBuilder()
                .setTitle('👁️ Code Review')
                .setDescription(this.formatReview(result.content))
                .setColor(0xFFFF00)
                .setTimestamp()
                .setFooter({ text: 'AI Code Helper' });

            await interaction.editReply({ embeds: [embed] });
        } else {
            const embed = new EmbedBuilder()
                .setTitle('❌ Review Failed')
                .setDescription(result.error || 'Unable to review the provided code.')
                .setColor(0xFF0000)
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        }
    }

    async handleGenerateCommand(interaction, options) {
        const description = options.getString('description');
        const language = options.getString('language') || 'javascript';

        const result = await this.codeHelper.generateCode(description, language);

        if (result.success) {
            const embed = new EmbedBuilder()
                .setTitle('🚀 Generated Code')
                .setDescription(this.formatCodeResponse(result.content))
                .setColor(0x00FF00)
                .setTimestamp()
                .setFooter({ text: 'AI Code Helper' });

            await interaction.editReply({ embeds: [embed] });
        } else {
            const embed = new EmbedBuilder()
                .setTitle('❌ Generation Failed')
                .setDescription(result.error || 'Unable to generate code from the provided description.')
                .setColor(0xFF0000)
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        }
    }

    async handleStatsCommand(interaction) {
        const stats = this.getStats();
        const uptime = this.formatUptime(stats.uptime);
        const memory = this.formatMemoryUsage(stats.memoryUsage);

        const embed = new EmbedBuilder()
            .setTitle('📊 Bot Statistics')
            .setColor(0x9932CC)
            .setThumbnail(this.client.user.displayAvatarURL())
            .addFields([
                {
                    name: '🌐 Servers',
                    value: stats.guilds.toString(),
                    inline: true
                },
                {
                    name: '👥 Users',
                    value: stats.users.toString(),
                    inline: true
                },
                {
                    name: '📺 Channels',
                    value: stats.channels.toString(),
                    inline: true
                },
                {
                    name: '⏱️ Uptime',
                    value: uptime,
                    inline: true
                },
                {
                    name: '🏓 Ping',
                    value: `${stats.ping}ms`,
                    inline: true
                },
                {
                    name: '🖥️ Memory',
                    value: memory,
                    inline: true
                },
                {
                    name: '🟢 Node Version',
                    value: stats.nodeVersion,
                    inline: true
                },
                {
                    name: '🤖 Library',
                    value: 'Discord.js v14',
                    inline: true
                },
                {
                    name: '🧠 AI Model',
                    value: 'Google Gemini',
                    inline: true
                }
            ])
            .setTimestamp()
            .setFooter({ text: 'AI Code Helper Statistics' });

        await interaction.editReply({ embeds: [embed] });
    }

    extractLanguageFromCode(code) {
        if (code.includes('function') || code.includes('const') || code.includes('let')) return 'javascript';
        if (code.includes('def ') || code.includes('import ')) return 'python';
        if (code.includes('public class') || code.includes('System.out')) return 'java';
        if (code.includes('#include') || code.includes('std::')) return 'cpp';
        if (code.includes('interface') || code.includes('type ')) return 'typescript';
        if (code.includes('func ') || code.includes('package ')) return 'go';
        if (code.includes('fn ') || code.includes('use ')) return 'rust';
        return null;
    }

    formatCodeResponse(content) {
        if (content.includes('```')) {
            return content.length > 2000 ? content.substring(0, 1950) + '\n\n*...truncated*' : content;
        }
        
        const lines = content.split('\n');
        let formatted = '';
        let inCode = false;
        
        for (const line of lines) {
            if (this.looksLikeCode(line) && !inCode) {
                formatted += '```js\n';
                inCode = true;
            } else if (inCode && !this.looksLikeCode(line) && line.trim()) {
                formatted += '```\n';
                inCode = false;
            }
            formatted += line + '\n';
        }
        
        if (inCode) formatted += '```';
        return formatted.length > 2000 ? formatted.substring(0, 1950) + '\n\n*...truncated*' : formatted;
    }

    formatExplanation(content) {
        return content
            .replace(/(\d+\.\s)/g, '\n**$1**')
            .replace(/^(.*?:)$/gm, '**$1**')
            .substring(0, 2000);
    }

    formatReview(content) {
        return content
            .replace(/issues?:/gi, '🔴 **Issues:**')
            .replace(/suggestions?:/gi, '💡 **Suggestions:**')
            .replace(/good:|positive:/gi, '✅ **Good:**')
            .replace(/improvements?:/gi, '⚡ **Improvements:**')
            .substring(0, 2000);
    }

    looksLikeCode(line) {
        const codePatterns = [
            /^\s*(function|const|let|var|if|for|while|class)/,
            /^\s*[a-zA-Z_$][a-zA-Z0-9_$]*\s*[=:]/,
            /^\s*[{}()[\];]/,
            /^\s*(import|export|require)/
        ];
        
        return codePatterns.some(pattern => pattern.test(line));
    }

    formatUptime(uptime) {
        const days = Math.floor(uptime / 86400000);
        const hours = Math.floor(uptime / 3600000) % 24;
        const minutes = Math.floor(uptime / 60000) % 60;
        
        if (days > 0) return `${days}d ${hours}h ${minutes}m`;
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    }

    formatMemoryUsage(memory) {
        const used = Math.round(memory.heapUsed / 1024 / 1024 * 100) / 100;
        const total = Math.round(memory.heapTotal / 1024 / 1024 * 100) / 100;
        return `${used}/${total} MB`;
    }

    async registerCommands() {
        try {
            const commands = [
                {
                    name: 'help',
                    description: 'Show help information and available commands'
                },
                {
                    name: 'debug',
                    description: 'Debug code with AI assistance',
                    options: [{
                        name: 'code',
                        type: ApplicationCommandOptionType.String,
                        description: 'The code to debug',
                        required: true
                    }]
                },
                {
                    name: 'optimize',
                    description: 'Optimize code for better performance',
                    options: [{
                        name: 'code',
                        type: ApplicationCommandOptionType.String,
                        description: 'The code to optimize',
                        required: true
                    }]
                },
                {
                    name: 'explain',
                    description: 'Get detailed explanation of code',
                    options: [{
                        name: 'code',
                        type: ApplicationCommandOptionType.String,
                        description: 'The code to explain',
                        required: true
                    }]
                },
                {
                    name: 'review',
                    description: 'Get code quality review and feedback',
                    options: [{
                        name: 'code',
                        type: ApplicationCommandOptionType.String,
                        description: 'The code to review',
                        required: true
                    }]
                },
                {
                    name: 'generate',
                    description: 'Generate code based on description',
                    options: [{
                        name: 'description',
                        type: ApplicationCommandOptionType.String,
                        description: 'Description of what you want to create',
                        required: true
                    }, {
                        name: 'language',
                        type: ApplicationCommandOptionType.String,
                        description: 'Programming language (default: javascript)',
                        required: false,
                        choices: [
                            { name: 'JavaScript', value: 'javascript' },
                            { name: 'Python', value: 'python' },
                            { name: 'Java', value: 'java' },
                            { name: 'C++', value: 'cpp' },
                            { name: 'TypeScript', value: 'typescript' },
                            { name: 'Go', value: 'go' },
                            { name: 'Rust', value: 'rust' }
                        ]
                    }]
                },
                {
                    name: 'stats',
                    description: 'Show bot statistics and information'
                }
            ];

            await this.client.application.commands.set(commands);
            Logger.info(`✅ Registered ${commands.length} slash commands globally`);
            
        } catch (error) {
            Logger.error('Error registering commands:', error);
        }
    }

    async start() {
        try {
            Logger.info('🚀 Starting AI Code Helper Bot...');
            
            if (!process.env.DISCORD_TOKEN) {
                throw new Error('DISCORD_TOKEN is required in environment variables');
            }
            
            if (!process.env.GEMINI_API_KEY) {
                throw new Error('GEMINI_API_KEY is required in environment variables');
            }

            await this.client.login(process.env.DISCORD_TOKEN);
            
        } catch (error) {
            Logger.error('Failed to start bot:', error);
            process.exit(1);
        }
    }

    async shutdown() {
        Logger.info('🔄 Shutting down bot...');
        
        try {
            if (this.activityInterval) {
                clearInterval(this.activityInterval);
            }
            
            if (this.client.user) {
                await this.client.user.setPresence({ status: 'invisible' });
            }
            
            await this.client.destroy();
            Logger.info('✅ Bot shutdown complete');
            
        } catch (error) {
            Logger.error('Error during shutdown:', error);
        } finally {
            process.exit(0);
        }
    }

    getStats() {
        return {
            uptime: this.client.uptime,
            guilds: this.client.guilds.cache.size,
            users: this.client.users.cache.size,
            channels: this.client.channels.cache.size,
            ping: this.client.ws.ping,
            memoryUsage: process.memoryUsage(),
            nodeVersion: process.version
        };
    }
}

process.on('SIGINT', async () => {
    Logger.info('📥 Received SIGINT, shutting down gracefully...');
    if (global.bot) {
        await global.bot.shutdown();
    }
});

process.on('SIGTERM', async () => {
    Logger.info('📥 Received SIGTERM, shutting down gracefully...');
    if (global.bot) {
        await global.bot.shutdown();
    }
});

async function main() {
    try {
        const bot = new AICodeHelperBot();
        global.bot = bot;
        
        await bot.start();
        Logger.info('🎉 AI Code Helper Bot is fully operational!');
        
    } catch (error) {
        Logger.error('❌ Failed to start application:', error);
        process.exit(1);
    }
}

module.exports = AICodeHelperBot;

if (require.main === module) {
    main();
}
