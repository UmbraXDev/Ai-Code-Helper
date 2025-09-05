const Logger = require('../utils/logger');

class CodeHelper {
    constructor(genAI) {
        this.genAI = genAI;
        this.models = {
            'gemini-pro': 'gemini-pro',
            'gemini-pro-vision': 'gemini-pro-vision',
            'gemini-1.5-pro': 'gemini-1.5-pro-latest',
            'gemini-1.5-flash': 'gemini-1.5-flash-latest',
            'gemini-1.0-pro': 'gemini-1.0-pro-latest'
        };
        this.defaultModel = process.env.DEFAULT_GEMINI_MODEL || 'gemini-1.5-pro-latest';
    }

    async analyzeCode(code, question, modelName = null) {
        try {
            const model = this.genAI.getGenerativeModel({ 
                model: modelName || this.defaultModel 
            });

            const prompt = this.createCodeAnalysisPrompt(code, question);
            const result = await model.generateContent(prompt);
            const response = await result.response;
            
            return {
                success: true,
                content: response.text(),
                model: modelName || this.defaultModel
            };
        } catch (error) {
            Logger.error('Code analysis error:', error);
            return {
                success: false,
                error: this.handleGeminiError(error)
            };
        }
    }

    async debugCode(code, errorMessage, language = 'javascript') {
        try {
            const model = this.genAI.getGenerativeModel({ model: this.defaultModel });
            
            const prompt = `
You are an expert debugging assistant. Analyze the following ${language} code and error message, then provide:

1. **Root Cause**: What's causing the error
2. **Fixed Code**: Corrected version with explanations
3. **Prevention**: How to avoid similar issues

**Code:**
\`\`\`${language}
${code}
\`\`\`

**Error Message:**
\`\`\`
${errorMessage}
\`\`\`

Please format your response clearly with code blocks and explanations.
            `.trim();

            const result = await model.generateContent(prompt);
            const response = await result.response;
            
            return {
                success: true,
                content: response.text()
            };
        } catch (error) {
            Logger.error('Debug error:', error);
            return {
                success: false,
                error: this.handleGeminiError(error)
            };
        }
    }

    async optimizeCode(code, language = 'javascript') {
        try {
            const model = this.genAI.getGenerativeModel({ model: this.defaultModel });
            
            const prompt = `
You are a code optimization expert. Analyze this ${language} code and provide:

1. **Performance Issues**: Identify bottlenecks and inefficiencies
2. **Optimized Code**: Improved version with better performance
3. **Explanation**: Why the optimizations work
4. **Best Practices**: Additional recommendations

**Original Code:**
\`\`\`${language}
${code}
\`\`\`

Focus on readability, performance, and maintainability.
            `.trim();

            const result = await model.generateContent(prompt);
            const response = await result.response;
            
            return {
                success: true,
                content: response.text()
            };
        } catch (error) {
            Logger.error('Optimization error:', error);
            return {
                success: false,
                error: this.handleGeminiError(error)
            };
        }
    }

    async explainCode(code, language = 'auto') {
        try {
            const model = this.genAI.getGenerativeModel({ model: this.defaultModel });
            
            const prompt = `
Explain this code in detail. Provide:

1. **Overview**: What the code does
2. **Line-by-line**: Explanation of key parts
3. **Concepts**: Programming concepts used
4. **Use Cases**: When you'd use this code

**Code:**
\`\`\`${language !== 'auto' ? language : ''}
${code}
\`\`\`

Make it educational and easy to understand.
            `.trim();

            const result = await model.generateContent(prompt);
            const response = await result.response;
            
            return {
                success: true,
                content: response.text()
            };
        } catch (error) {
            Logger.error('Explanation error:', error);
            return {
                success: false,
                error: this.handleGeminiError(error)
            };
        }
    }

    async generateCode(description, language = 'javascript') {
        try {
            const model = this.genAI.getGenerativeModel({ model: this.defaultModel });
            
            const prompt = `
Generate ${language} code based on this description: "${description}"

Provide:
1. **Complete Code**: Working implementation
2. **Usage Example**: How to use the code
3. **Explanation**: Brief explanation of the approach
4. **Dependencies**: Any required libraries or modules

Make sure the code is production-ready and follows best practices.
            `.trim();

            const result = await model.generateContent(prompt);
            const response = await result.response;
            
            return {
                success: true,
                content: response.text()
            };
        } catch (error) {
            Logger.error('Code generation error:', error);
            return {
                success: false,
                error: this.handleGeminiError(error)
            };
        }
    }

    async reviewCode(code, language = 'javascript') {
        try {
            const model = this.genAI.getGenerativeModel({ model: this.defaultModel });
            
            const prompt = `
Perform a comprehensive code review of this ${language} code:

\`\`\`${language}
${code}
\`\`\`

Provide feedback on:
1. **Code Quality**: Structure, readability, maintainability
2. **Best Practices**: Adherence to coding standards
3. **Potential Issues**: Bugs, security concerns, performance problems
4. **Suggestions**: Specific improvements with examples
5. **Rating**: Overall quality score (1-10) with justification

Be thorough but constructive in your feedback.
            `.trim();

            const result = await model.generateContent(prompt);
            const response = await result.response;
            
            return {
                success: true,
                content: response.text()
            };
        } catch (error) {
            Logger.error('Code review error:', error);
            return {
                success: false,
                error: this.handleGeminiError(error)
            };
        }
    }

    createCodeAnalysisPrompt(code, question) {
        return `
You are an expert programming assistant. A user has provided code and a question.

**Code:**
\`\`\`
${code}
\`\`\`

**Question:**
${question}

Please provide a detailed, helpful response. Include code examples where relevant and explain your reasoning clearly.
        `.trim();
    }

    handleGeminiError(error) {
        if (error.message.includes('API key')) {
            return 'Invalid or missing Gemini API key. Please check your configuration.';
        } else if (error.message.includes('quota')) {
            return 'API quota exceeded. Please try again later.';
        } else if (error.message.includes('blocked')) {
            return 'Request was blocked due to safety concerns. Please rephrase your request.';
        } else if (error.message.includes('model not found')) {
            return 'The specified Gemini model was not found.';
        } else {
            return `An error occurred: ${error.message}`;
        }
    }

    getAvailableModels() {
        return Object.keys(this.models);
    }

    isValidModel(modelName) {
        return this.models.hasOwnProperty(modelName);
    }
}

module.exports = CodeHelper;
