const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Logger = require('../utils/logger');

class MessageHandler {
    constructor(codeHelper, rateLimiter) {
        this.codeHelper = codeHelper;
        this.rateLimiter = rateLimiter;
        this.processingMessages = new Set();
        this.buttonHandlers = new Map();
        this.setupButtonHandlers();
    }

    setupButtonHandlers() {
        this.buttonHandlers.set('debug_more', this.handleDebugButton.bind(this));
        this.buttonHandlers.set('optimize_more', this.handleOptimizeButton.bind(this));
        this.buttonHandlers.set('explain_more', this.handleExplainButton.bind(this));
        this.buttonHandlers.set('review_more', this.handleReviewButton.bind(this));
        this.buttonHandlers.set('show_help', this.handleHelpButton.bind(this));
        this.buttonHandlers.set('show_examples', this.handleExamplesButton.bind(this));
        this.buttonHandlers.set('regenerate', this.handleRegenerateButton.bind(this));
    }

    async handleInteraction(interaction) {
        if (!interaction.isButton()) return;

        const handler = this.buttonHandlers.get(interaction.customId);
        if (handler) {
            await interaction.deferUpdate();
            await handler(interaction);
        }
    }

    async handle(message) {
        if (this.processingMessages.has(message.id)) return;
        this.processingMessages.add(message.id);

        try {
            const rateLimitResult = await this.rateLimiter.checkRateLimit(
                message.author.id, 
                message.guild?.id
            );

            if (!rateLimitResult.allowed) {
                await this.handleRateLimit(message, rateLimitResult);
                return;
            }

            const codeBlocks = this.extractCodeBlocks(message.content);
            const action = this.determineAction(message.content, codeBlocks.length > 0);

            await message.channel.sendTyping();

            const response = await this.processAction(action, message, codeBlocks);
            if (response) {
                await this.sendResponse(message, response);
            }

        } catch (error) {
            Logger.error('Message handling error:', error);
            await this.sendErrorResponse(message, error);
        } finally {
            this.processingMessages.delete(message.id);
        }
    }

    async processAction(action, message, codeBlocks) {
        const handlers = {
            debug: () => this.handleDebugRequest(message, codeBlocks),
            optimize: () => this.handleOptimizeRequest(message, codeBlocks),
            explain: () => this.handleExplainRequest(message, codeBlocks),
            review: () => this.handleReviewRequest(message, codeBlocks),
            generate: () => this.handleGenerateRequest(message),
            general: () => this.handleGeneralRequest(message, codeBlocks)
        };

        return await (handlers[action] || handlers.general)();
    }

    extractCodeBlocks(content) {
        const codeBlockRegex = /```(\w+)?\n([\s\S]*?)\n```/g;
        const inlineCodeRegex = /`([^`\n]{10,})`/g;
        const blocks = [];

        let match;
        while ((match = codeBlockRegex.exec(content)) !== null) {
            blocks.push({
                type: 'block',
                language: match[1] || 'javascript',
                code: match[2].trim()
            });
        }

        if (blocks.length === 0) {
            while ((match = inlineCodeRegex.exec(content)) !== null) {
                blocks.push({
                    type: 'inline',
                    language: 'javascript',
                    code: match[1].trim()
                });
            }
        }

        return blocks;
    }

    determineAction(content, hasCode) {
        const patterns = {
            debug: /debug|error|fix|broken|issue/i,
            optimize: /optimize|performance|improve|faster|efficiency/i,
            explain: /explain|what does|how does|understand/i,
            review: /review|feedback|quality|check/i,
            generate: /generate|create|write|make|build/i
        };

        for (const [action, pattern] of Object.entries(patterns)) {
            if (pattern.test(content)) return action;
        }

        return hasCode ? 'general' : 'generate';
    }

    async handleDebugRequest(message, codeBlocks) {
        if (!codeBlocks.length) {
            return this.createErrorResponse('No code found', 'Provide code blocks for debugging');
        }

        const { code, language } = codeBlocks[0];
        const errorMessage = this.extractErrorMessage(message.content);
        
        const result = await this.codeHelper.debugCode(code, errorMessage || 'Debug analysis', language);
        
        return this.createSuccessResponse(
            '🐛 Debug Analysis',
            this.formatCodeResponse(result.content),
            { action: 'debug', code, language }
        );
    }

    async handleOptimizeRequest(message, codeBlocks) {
        if (!codeBlocks.length) {
            return this.createErrorResponse('No code found', 'Provide code blocks for optimization');
        }

        const { code, language } = codeBlocks[0];
        const result = await this.codeHelper.optimizeCode(code, language);

        return this.createSuccessResponse(
            '⚡ Optimization',
            this.formatCodeResponse(result.content),
            { action: 'optimize', code, language }
        );
    }

    async handleExplainRequest(message, codeBlocks) {
        if (!codeBlocks.length) {
            return this.createErrorResponse('No code found', 'Provide code blocks for explanation');
        }

        const { code, language } = codeBlocks[0];
        const result = await this.codeHelper.explainCode(code, language);

        return this.createSuccessResponse(
            '📚 Explanation',
            this.formatExplanation(result.content),
            { action: 'explain', code, language }
        );
    }

    async handleReviewRequest(message, codeBlocks) {
        if (!codeBlocks.length) {
            return this.createErrorResponse('No code found', 'Provide code blocks for review');
        }

        const { code, language } = codeBlocks[0];
        const result = await this.codeHelper.reviewCode(code, language);

        return this.createSuccessResponse(
            '👁️ Code Review',
            this.formatReview(result.content),
            { action: 'review', code, language }
        );
    }

    async handleGenerateRequest(message) {
        const description = message.content.replace(/<@!?\d+>/g, '').trim();
        const language = this.extractLanguage(description) || 'javascript';
        
        const result = await this.codeHelper.generateCode(description, language);

        return this.createSuccessResponse(
            '🚀 Generated Code',
            this.formatCodeResponse(result.content),
            { action: 'generate', description, language }
        );
    }

    async handleGeneralRequest(message, codeBlocks) {
        const question = message.content.replace(/<@!?\d+>/g, '').trim();
        
        if (codeBlocks.length > 0) {
            const { code, language } = codeBlocks[0];
            const result = await this.codeHelper.analyzeCode(code, question);
            return this.createSuccessResponse(
                '💡 Analysis',
                this.formatAnalysis(result.content),
                { action: 'analyze', code, question, language }
            );
        } else {
            const result = await this.codeHelper.generateCode(question);
            return this.createSuccessResponse(
                '🤖 Response',
                this.formatCodeResponse(result.content),
                { action: 'general', question }
            );
        }
    }

    async handleDebugButton(interaction) {
        const embed = interaction.message.embeds[0];
        const context = this.extractContextFromEmbed(embed);
        
        if (context.code) {
            const result = await this.codeHelper.debugCode(context.code, 'Additional debugging', context.language);
            await this.updateInteractionResponse(interaction, '🐛 Advanced Debug', result.content);
        }
    }

    async handleOptimizeButton(interaction) {
        const embed = interaction.message.embeds[0];
        const context = this.extractContextFromEmbed(embed);
        
        if (context.code) {
            const result = await this.codeHelper.optimizeCode(context.code, context.language);
            await this.updateInteractionResponse(interaction, '⚡ Advanced Optimization', result.content);
        }
    }

    async handleExplainButton(interaction) {
        const embed = interaction.message.embeds[0];
        const context = this.extractContextFromEmbed(embed);
        
        if (context.code) {
            const result = await this.codeHelper.explainCode(context.code, context.language);
            await this.updateInteractionResponse(interaction, '📚 Detailed Explanation', result.content);
        }
    }

    async handleReviewButton(interaction) {
        const embed = interaction.message.embeds[0];
        const context = this.extractContextFromEmbed(embed);
        
        if (context.code) {
            const result = await this.codeHelper.reviewCode(context.code, context.language);
            await this.updateInteractionResponse(interaction, '👁️ Detailed Review', result.content);
        }
    }

    async handleHelpButton(interaction) {
        const helpEmbed = this.createCompactEmbed(
            '❓ How to Use',
            '**Commands:**\n' +
            '• `debug` - Find and fix errors\n' +
            '• `optimize` - Improve performance\n' +
            '• `explain` - Understand code\n' +
            '• `review` - Get feedback\n' +
            '• Just ask - Generate code\n\n' +
            '**Format:** Use code blocks \\`\\`\\`js\\n...\\`\\`\\`',
            0x0099FF
        );

        await interaction.editReply({ embeds: [helpEmbed], components: [] });
    }

    async handleExamplesButton(interaction) {
        const exampleEmbed = this.createCompactEmbed(
            '📝 Examples',
            '```js\n// Example 1: Debug this\nfunction add(a, b) {\n  return a + c; // Error here\n}\n```\n' +
            '```python\n# Example 2: Optimize this\nfor i in range(1000000):\n  print(i)\n```\n' +
            '**Or just ask:** "Create a REST API in Node.js"',
            0x9932CC
        );

        await interaction.editReply({ embeds: [exampleEmbed], components: [] });
    }

    async handleRegenerateButton(interaction) {
        const embed = interaction.message.embeds[0];
        await interaction.followUp({ content: 'Regenerating...', ephemeral: true });
    }

    createSuccessResponse(title, content, context = {}) {
        return {
            embeds: [this.createCompactEmbed(title, content, 0x00FF00)],
            components: [this.createAdvancedActionRow(), this.createUtilityRow()],
            context
        };
    }

    createErrorResponse(title, description) {
        return {
            embeds: [this.createCompactEmbed(`❌ ${title}`, description, 0xFF0000)],
            components: [this.createHelpRow()]
        };
    }

    createCompactEmbed(title, description, color = 0x0099FF) {
        const embed = new EmbedBuilder()
            .setTitle(title)
            .setColor(color)
            .setTimestamp()
            .setFooter({ 
                text: 'AI Code Helper',
                iconURL: 'https://cdn.discordapp.com/emojis/1234567890123456789.png'
            });

        if (description.length > 2000) {
            const truncated = description.substring(0, 1950);
            const lastNewline = truncated.lastIndexOf('\n');
            embed.setDescription(
                (lastNewline > 1800 ? truncated.substring(0, lastNewline) : truncated) + 
                '\n\n*...truncated for brevity*'
            );
        } else {
            embed.setDescription(description);
        }

        return embed;
    }

    createAdvancedActionRow() {
        return new ActionRowBuilder()
            .addComponents([
                new ButtonBuilder()
                    .setCustomId('debug_more')
                    .setEmoji('🐛')
                    .setLabel('Debug')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('optimize_more')
                    .setEmoji('⚡')
                    .setLabel('Optimize')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('explain_more')
                    .setEmoji('📚')
                    .setLabel('Explain')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('review_more')
                    .setEmoji('👁️')
                    .setLabel('Review')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('regenerate')
                    .setEmoji('🔄')
                    .setLabel('Retry')
                    .setStyle(ButtonStyle.Secondary)
            ]);
    }

    createUtilityRow() {
        return new ActionRowBuilder()
            .addComponents([
                new ButtonBuilder()
                    .setCustomId('show_help')
                    .setEmoji('❓')
                    .setLabel('Help')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('show_examples')
                    .setEmoji('📝')
                    .setLabel('Examples')
                    .setStyle(ButtonStyle.Secondary)
            ]);
    }

    createHelpRow() {
        return new ActionRowBuilder()
            .addComponents([
                new ButtonBuilder()
                    .setCustomId('show_help')
                    .setEmoji('❓')
                    .setLabel('Help')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('show_examples')
                    .setEmoji('📝')
                    .setLabel('Examples')
                    .setStyle(ButtonStyle.Success)
            ]);
    }

    formatCodeResponse(content) {
        if (content.includes('```')) {
            return content;
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
        return formatted;
    }

    formatExplanation(content) {
    
        return content
            .replace(/(\d+\.\s)/g, '\n**$1**')
            .replace(/^(.*?:)$/gm, '**$1**')
            .trim();
    }

    formatReview(content) {
        
        return content
            .replace(/issues?:/gi, '🔴 **Issues:**')
            .replace(/suggestions?:/gi, '💡 **Suggestions:**')
            .replace(/good:|positive:/gi, '✅ **Good:**')
            .replace(/improvements?:/gi, '⚡ **Improvements:**');
    }

    formatAnalysis(content) {
        return content
            .replace(/summary:/gi, '📋 **Summary:**')
            .replace(/key points?:/gi, '🔑 **Key Points:**')
            .replace(/analysis:/gi, '🔍 **Analysis:**');
    }

    looksLikeCode(line) {
        const codePatterns = [
            /^\s*(function|const|let|var|if|for|while|class)/,
            /^\s*[a-zA-Z_$][a-zA-Z0-9_$]*\s*[=:]/,
            /^\s*[{}()[\];]/,
            /^\s*(import|export|require)/,
            /^\s*(public|private|protected)/
        ];
        
        return codePatterns.some(pattern => pattern.test(line));
    }

    extractContextFromEmbed(embed) {
       
        const description = embed.description || '';
        const codeMatch = description.match(/```(\w+)?\n([\s\S]*?)\n```/);
        
        return {
            code: codeMatch ? codeMatch[2] : null,
            language: codeMatch ? codeMatch[1] || 'javascript' : 'javascript'
        };
    }

    async updateInteractionResponse(interaction, title, content) {
        const embed = this.createCompactEmbed(title, this.formatCodeResponse(content), 0x00FF00);
        await interaction.editReply({ 
            embeds: [embed], 
            components: [this.createAdvancedActionRow(), this.createUtilityRow()] 
        });
    }

    extractErrorMessage(content) {
        const errorPatterns = [
            /error[:\s]+(.+?)(?:\n|$)/i,
            /exception[:\s]+(.+?)(?:\n|$)/i,
            /```[\s\S]*?(error|exception)[\s\S]*?```/i
        ];

        for (const pattern of errorPatterns) {
            const match = content.match(pattern);
            if (match) return match[1]?.trim();
        }
        return null;
    }

    extractLanguage(content) {
        const langMap = {
            'javascript': ['js', 'javascript', 'node'],
            'typescript': ['ts', 'typescript'],
            'python': ['py', 'python'],
            'java': ['java'],
            'cpp': ['cpp', 'c++'],
            'csharp': ['c#', 'csharp'],
            'php': ['php'],
            'ruby': ['ruby', 'rb'],
            'go': ['go', 'golang'],
            'rust': ['rust', 'rs']
        };

        const lower = content.toLowerCase();
        for (const [lang, keywords] of Object.entries(langMap)) {
            if (keywords.some(keyword => lower.includes(keyword))) {
                return lang;
            }
        }
        return null;
    }

    async handleRateLimit(message, rateLimitResult) {
        const embed = this.createCompactEmbed(
            '⏰ Rate Limited',
            `${rateLimitResult.message}\n\n⏱️ **Remaining:** ${rateLimitResult.remaining?.minute || 0}/min`,
            0xFFFF00
        );

        await message.reply({ embeds: [embed] });
    }

    async sendResponse(message, response) {
        try {
            await message.reply(response);
        } catch (error) {
            Logger.error('Error sending response:', error);
            await message.reply({
                embeds: [this.createCompactEmbed('❌ Error', 'Failed to send response. Try again.', 0xFF0000)]
            });
        }
    }

    async sendErrorResponse(message, error) {
        const embed = this.createCompactEmbed(
            '💥 Error',
            'An unexpected error occurred. Please try again.',
            0xFF0000
        );

        try {
            await message.reply({ embeds: [embed] });
        } catch (sendError) {
            Logger.error('Failed to send error response:', sendError);
        }
    }
}

module.exports = MessageHandler;
