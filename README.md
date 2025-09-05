
---

# 🤖 AI Code Helper Bot

The **AI Code Helper Bot** is a smart and reliable Discord bot built to assist developers, learners, and coding enthusiasts directly within their server. It leverages the power of AI to make coding easier, faster, and more enjoyable, offering everything from debugging support to programming explanations in plain, beginner-friendly language.

This bot is not just another coding assistant—it is designed to act like your personal AI coding partner. Whether you are stuck on a tricky bug, need guidance with syntax, or simply want to learn how to write more optimized and efficient code, the bot is here to help.

---

## 🚀 What It Can Do

* **Instant Code Help**: Share your code snippets, and the bot can analyze, explain, and improve them.
* **Debugging Assistance**: Find and fix common errors across multiple programming languages.
* **Programming Explanations**: Learn coding concepts with easy-to-understand breakdowns, great for both beginners and experienced developers.
* **Multi-Language Support**: From Python and JavaScript to C++, Java, and more—the bot adapts to different programming environments.
* **Learning Companion**: Perfect for students preparing projects, hobbyists working on ideas, or professionals who need quick AI-powered input.

---

## ⚙️ Setup Guide

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/ai-code-helper-bot.git
cd ai-code-helper-bot
```

### 2. Install Dependencies

```bash
npm i
```

### 3. Configure Environment Variables

Create a `.env` file in the project root and add the following:

```env
DISCORD_TOKEN=your_discord_bot_token
DISCORD_CLIENT_ID=your_discord_client_id

GEMINI_API_KEY=your_gemini_api_key
DEFAULT_GEMINI_MODEL=gemini-1.5-flash

ALLOWED_CHANNELS=
# Leave empty to allow all channels

USER_REQUESTS_PER_MINUTE=10
USER_REQUESTS_PER_HOUR=50
GLOBAL_REQUESTS_PER_MINUTE=100
GLOBAL_REQUESTS_PER_HOUR=1000

PREMIUM_USERS=
PREMIUM_USER_REQUESTS_PER_MINUTE=30
PREMIUM_USER_REQUESTS_PER_HOUR=200

COOLDOWN_PERIOD=60000
TEMP_BAN_DURATION=300000

LOG_LEVEL=info
LOG_DIR=./logs
MAX_LOG_SIZE=10485760
MAX_LOG_FILES=5

NODE_ENV=production
DEBUG=false
```

### 4. Run the Bot

```bash
node bot.js
```

---

## 🌐 Community & Support

We believe that coding should be collaborative, and that’s why we’ve created a support server where you can get help, suggest new features, or just connect with other coders who share the same passion.

👉 [Join the Support Server](https://discord.gg/KMaVP2xupg)

---

## 💡 Why Use AI Code Helper Bot?

With the AI Code Helper Bot, you don’t have to waste hours searching for solutions. It gives you instant guidance, encourages better coding practices, and grows with you as you learn. Whether you’re coding for school, building projects, or solving real-world problems, this bot is a reliable companion that makes programming smoother, smarter, and more fun.

---
