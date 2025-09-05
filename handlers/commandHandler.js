const { EmbedBuilder, ActionRowBuilder, SelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Logger = require('../utils/logger');

class CommandHandler {
    constructor(codeHelper, rateLimiter) {
        this.codeHelper = codeHelper;
        this.rateLimiter = rateLimiter;
        this.commands = new Map();
        
        this.setupCommands();
    }

    setupCommands() {
        this.commands.set('help', this.helpCommand.bind(this));
        this.commands.set('debug', this.debugCommand.bind(this));
        this.commands.set('optimize', this.optimizeCommand.bind(this));
        this.commands.set('explain', this.explainCommand.bind(this));
        this.commands.set('review', this.reviewCommand.bind(this));
        this.commands.set('generate', this.generateCommand.bind(this));
        this.commands.set('models', this.modelsCommand.bind(this));
        this.commands.set('stats', this.statsCommand.bind(this));
        this.commands.set('limits', this.limitsCommand.bind(this));
    }

    async handle(interaction) {
        const commandName = interaction.commandName;
        
        if (!this.commands.has(commandName)) {
            await interaction.reply({
                content: '❌ Unknown command!',
                ephemeral: true
            });
            return;
        }

        try {
            if (!['help', 'models', 'stats', 'limits'].includes(commandName)) {
                const rateLimitResult = await this.rateLimiter.checkRateLimit(
                    interaction.user.id,
                    interaction.guild?.id
                );

                if (!rateLimitResult.allowed) {
                    await this.handleRateLimit(interaction, rateLimitResult);
                    return;
                }
            }

            await this.commands.get(commandName)(interaction);
        } catch (error) {
            Logger.error(`Command ${commandName} error:`, error);
            await this.sendErrorResponse(interaction, error);
        }
    }

    async helpCommand(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('🤖 AI Code Helper - Commands')
            .setColor(0x0099FF)
            .setDescription('I can help you with code analysis, debugging, optimization, and more!')
            .addFields([
                {
                    name: '🔧 Core Commands',
                    value: [
                        '`/debug` - Debug code and fix errors',
                        '`/optimize` - Optimize code performance',
                        '`/explain` - Explain how code works',
                        '`/review` - Get code quality feedback',
                        '`/generate` - Generate code from description'
                    ].join('\n'),
                    inline: false
                },
                {
                    name: '📊 Utility Commands',
                    value: [
                        '`/models` - View available AI models',
                        '`/stats` - View your usage statistics',
                        '`/limits` - Check rate limit information',
                        '`/help` - Show this help message'
                    ].join('\n'),
                    inline: false
                },
                {
                    name: '💡 Usage Tips',
                    value: [
                        '• Use code blocks with \\`\\`\\`language\\`\\`\\` for best results',
                        '• Mention specific issues or requirements',
                        '• Try different models for varying perspectives',
                        '• Use @AI Code Helper to chat naturally'
                    ].join('\n'),
                    inline: false
                }
            ])
            .setFooter({ 
                text: 'Powered by Gemini AI • Use responsibly',
                iconURL: interaction.client.user.displayAvatarURL()
            })
            .setTimestamp();

        const row = new ActionRowBuilder()
            .addComponents([
                new ButtonBuilder()
                    .setCustomId('show_examples')
                    .setLabel('📝 Show Examples')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('show_models')
                    .setLabel('🧠 Available Models')
                    .setStyle(ButtonStyle.Secondary)
            ]);

        await interaction.reply({ embeds: [embed], components: [row] });
    }

    async debugCommand(interaction) {
        const code = interaction.options.getString('code');
        const error = interaction.options.getString('error') || 'General debugging';
        const language = interaction.options.getString('language') || 'javascript';
        const model = interaction.options.getString('model') || null;

        await interaction.deferReply();

        const result = await this.codeHelper.debugCode(code, error, language);

        if (result.success) {
            const embed = new EmbedBuilder()
                .setTitle('🐛 Debug Analysis')
                .setDescription(this.truncateText(result.content, 4000))
                .setColor(0x00FF00)
                .addFields([
                    { name: 'Language', value: language, inline: true },
                    { name: 'Model Used', value: result.model || 'Default', inline: true }
                ])
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } else {
            await interaction.editReply({
                embeds: [this.createErrorEmbed('Debug Failed', result.error)]
            });
        }
    }

    async optimizeCommand(interaction) {
        const code = interaction.options.getString('code');
        const language = interaction.options.getString('language') || 'javascript';
        const model = interaction.options.getString('model') || null;

        await interaction.deferReply();

        const result = await this.codeHelper.optimizeCode(code, language);

        if (result.success) {
            const embed = new EmbedBuilder()
                .setTitle('⚡ Code Optimization')
                .setDescription(this.truncateText(result.content, 4000))
                .setColor(0x00FF00)
                .addFields([
                    { name: 'Language', value: language, inline: true },
                    { name: 'Model Used', value: result.model || 'Default', inline: true }
                ])
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } else {
            await interaction.editReply({
                embeds: [this.createErrorEmbed('Optimization Failed', result.error)]
            });
        }
    }

    async explainCommand(interaction) {
        const code = interaction.options.getString('code');
        const language = interaction.options.getString('language') || 'auto';
        const model = interaction.options.getString('model') || null;

        await interaction.deferReply();

        const result = await this.codeHelper.explainCode(code, language);

        if (result.success) {
            const embed = new EmbedBuilder()
                .setTitle('📚 Code Explanation')
                .setDescription(this.truncateText(result.content, 4000))
                .setColor(0x0099FF)
                .addFields([
                    { name: 'Language', value: language, inline: true },
                    { name: 'Model Used', value: result.model || 'Default', inline: true }
                ])
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } else {
            await interaction.editReply({
                embeds: [this.createErrorEmbed('Explanation Failed', result.error)]
            });
        }
    }

    async reviewCommand(interaction) {
        const code = interaction.options.getString('code');
        const language = interaction.options.getString('language') || 'javascript';
        const model = interaction.options.getString('model') || null;

        await interaction.deferReply();

        const result = await this.codeHelper.reviewCode(code, language);

        if (result.success) {
            const embed = new EmbedBuilder()
                .setTitle('👁️ Code Review')
                .setDescription(this.truncateText(result.content, 4000))
                .setColor(0xFFFF00)
                .addFields([
                    { name: 'Language', value: language, inline: true },
                    { name: 'Model Used', value: result.model || 'Default', inline: true }
                ])
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } else {
            await interaction.editReply({
                embeds: [this.createErrorEmbed('Review Failed', result.error)]
            });
        }
    }

    async generateCommand(interaction) {
        const description = interaction.options.getString('description');
        const language = interaction.options.getString('language') || 'javascript';
        const model = interaction.options.getString('model') || null;

        await interaction.deferReply();

        const result = await this.codeHelper.generateCode(description, language);

        if (result.success) {
            const embed = new EmbedBuilder()
                .setTitle('🚀 Generated Code')
                .setDescription(this.truncateText(result.content, 4000))
                .setColor(0x00FF00)
                .addFields([
                    { name: 'Language', value: language, inline: true },
                    { name: 'Model Used', value: result.model || 'Default', inline: true },
                    { name: 'Request', value: this.truncateText(description, 100), inline: true }
                ])
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } else {
            await interaction.editReply({
                embeds: [this.createErrorEmbed('Generation Failed', result.error)]
            });
        }
    }

    async modelsCommand(interaction) {
        const availableModels = this.codeHelper.getAvailableModels();
        
        const embed = new EmbedBuilder()
            .setTitle('🧠 Available Gemini Models')
            .setColor(0x0099FF)
            .setDescription('Here are the AI models you can use:')
            .addFields([
                {
                    name: '🚀 Latest Models',
                    value: [
                        '`gemini-1.5-pro` - Most capable, best for complex tasks',
                        '`gemini-1.5-flash` - Fast and efficient for quick tasks'
                    ].join('\n'),
                    inline: false
                },
                {
                    name: '⚡ Standard Models', 
                    value: [
                        '`gemini-pro` - General purpose model',
                        '`gemini-pro-vision` - Supports image analysis',
                        '`gemini-1.0-pro` - Stable and reliable'
                    ].join('\n'),
                    inline: false
                },
                {
                    name: '💡 Usage Tips',
                    value: [
                        '• Default model is used when not specified',
                        '• Different models may give varying perspectives',
                        '• Flash models are faster but less detailed',
                        '• Pro models are slower but more thorough'
                    ].join('\n'),
                    inline: false
                }
            ])
            .setFooter({ text: `Default: ${this.codeHelper.defaultModel}` })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }

    async statsCommand(interaction) {
        const userStats = this.rateLimiter.getUserStats(interaction.user.id);
        const globalStats = this.rateLimiter.getGlobalStats();

        const embed = new EmbedBuilder()
            .setTitle('📊 Usage Statistics')
            .setColor(userStats.isPremium ? 0xFFD700 : 0x0099FF)
            .addFields([
                {
                    name: '👤 Your Usage',
                    value: [
                        `**Minute:** ${userStats.usage.minute.used}/${userStats.usage.minute.limit}`,
                        `**Hour:** ${userStats.usage.hour.used}/${userStats.usage.hour.limit}`,
                        `**Violations:** ${userStats.violations}`,
                        `**Status:** ${userStats.tempBanned ? '🚫 Temp Banned' : '✅ Active'}`
                    ].join('\n'),
                    inline: true
                },
                {
                    name: '🌐 Global Usage',
                    value: [
                        `**Minute:** ${globalStats.usage.minute.used}/${globalStats.usage.minute.limit}`,
                        `**Hour:** ${globalStats.usage.hour.used}/${globalStats.usage.hour.limit}`,
                        `**Active Users:** ${globalStats.activeUsers}`,
                        `**Temp Banned:** ${globalStats.tempBannedUsers}`
                    ].join('\n'),
                    inline: true
                },
                {
                    name: '💎 Account Type',
                    value: userStats.isPremium ? 
                        '**Premium User** 🌟\nHigher rate limits and priority access' :
                        '**Standard User**\nStandard rate limits apply',
                    inline: false
                }
            ])
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }

    async limitsCommand(interaction) {
        const userStats = this.rateLimiter.getUserStats(interaction.user.id);
        
        const embed = new EmbedBuilder()
            .setTitle('⏰ Rate Limit Information')
            .setColor(0x0099FF)
            .setDescription('Current rate limits and policies:')
            .addFields([
                {
                    name: '🚀 Standard Limits',
                    value: [
                        `**Per Minute:** ${this.rateLimiter.config.userRequestsPerMinute} requests`,
                        `**Per Hour:** ${this.rateLimiter.config.userRequestsPerHour} requests`,
                        `**Cooldown:** ${this.rateLimiter.config.cooldownPeriod / 1000}s after limit hit`
                    ].join('\n'),
                    inline: true
                },
                {
                    name: '💎 Premium Limits',
                    value: [
                        `**Per Minute:** ${this.rateLimiter.config.premiumUserRequestsPerMinute} requests`,
                        `**Per Hour:** ${this.rateLimiter.config.premiumUserRequestsPerHour} requests`,
                        `**Priority:** Higher priority processing`
                    ].join('\n'),
                    inline: true
                },
                {
                    name: '📋 Policies',
                    value: [
                        '• 3 violations = temporary ban',
                        `• Temp ban duration: ${this.rateLimiter.config.tempBanDuration / 60000} minutes`,
                        '• Limits reset every hour',
                        '• Fair usage policy applies'
                    ].join('\n'),
                    inline: false
                }
            ]);

        if (userStats.isPremium) {
            embed.setFooter({ text: '🌟 You have premium access!' });
        }

        await interaction.reply({ embeds: [embed] });
    }

    async handleRateLimit(interaction, rateLimitResult) {
        const embed = new EmbedBuilder()
            .setTitle('⏰ Rate Limited')
            .setDescription(rateLimitResult.message)
            .setColor(0xFFFF00)
            .setTimestamp();

        if (rateLimitResult.remaining) {
            embed.addFields([
                { 
                    name: 'Remaining Requests', 
                    value: `Minute: ${rateLimitResult.remaining.minute}\nHour: ${rateLimitResult.remaining.hour}`, 
                    inline: true 
                }
            ]);
        }

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    createErrorEmbed(title, description) {
        return new EmbedBuilder()
            .setTitle(`❌ ${title}`)
            .setDescription(description)
            .setColor(0xFF0000)
            .setTimestamp();
    }

    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength - 3) + '...';
    }
}

module.exports = CommandHandler;
