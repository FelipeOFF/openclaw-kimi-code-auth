# 🔐 OpenClaw Kimi Code Auth Plugin

[![OpenClaw](https://img.shields.io/badge/OpenClaw-Plugin-blue)](https://docs.openclaw.ai/)
[![Kimi](https://img.shields.io/badge/Kimi-Moonshot%20AI-green)](https://kimi.moonshot.cn/)
[![License](https://img.shields.io/badge/license-MIT-yellow)](LICENSE)

OAuth provider plugin for [Kimi Code CLI](https://github.com/moonshot-ai/kimi-cli) integration with [OpenClaw](https://docs.openclaw.ai/).

## ✨ Features

- 🔑 **OAuth Authentication** - More secure than API keys
- 🔄 **Token Reuse** - Leverages existing Kimi CLI authentication
- ⚡ **Auto-refresh** - Tokens refreshed automatically by Kimi CLI
- 🎯 **Zero Config** - Works out of the box after `kimi login`
- 🔒 **Secure** - Tokens stored in OpenClaw's encrypted auth profiles

## 📋 Requirements

- [OpenClaw](https://docs.openclaw.ai/) installed
- [Kimi CLI](https://github.com/moonshot-ai/kimi-cli) installed and authenticated

## 🚀 Quick Start

### 1. Install Kimi CLI

```bash
# Using pip
pip install kimi-cli

# Or using pipx (recommended)
pipx install kimi-cli
```

### 2. Authenticate with Kimi

```bash
kimi login
```

Follow the browser-based OAuth flow to authenticate with your Moonshot AI account.

### 3. Verify Authentication

```bash
kimi whoami
```

### 4. Install the Plugin

```bash
# Clone this repository
git clone https://github.com/FelipeOFF/openclaw-kimi-code-auth.git

# Install the plugin
openclaw plugins install ./openclaw-kimi-code-auth

# Restart the gateway
openclaw gateway restart
```

### 5. Configure OpenClaw

```bash
# Interactive setup
openclaw models auth login --provider kimi-coding

# Or use the configure wizard
openclaw configure
```

Select **"Kimi Code OAuth"** when prompted for the provider.

## 📖 Usage

### Set as Default Model

```bash
# Make Kimi Code your default model
openclaw models set kimi-coding/kimi-for-coding
```

### Use for Specific Sessions

```bash
# Use Kimi Code for a one-off message
openclaw agent --model kimi-coding/kimi-for-coding --message "Write a Python function to calculate fibonacci"

# Or via the Gateway API
openclaw agent --to telegram:YOUR_CHAT_ID --model kimi-coding/kimi-for-coding --message "Hello from Kimi Code!"
```

### Configure for Cron Jobs

```bash
# Add a cron job using Kimi Code
openclaw cron add \
  --name "daily-code-review" \
  --cron "0 9 * * *" \
  --model kimi-coding/kimi-for-coding \
  --message "Review yesterday's code commits and suggest improvements"
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `KIMI_API_KEY` | Fallback API key (optional) | No |

### Available Models

| Model | Context | Features | Auth |
|-------|---------|----------|------|
| `kimi-coding/kimi-for-coding` | 262k | Thinking, code completion, agentic coding | OAuth |
| `moonshot/kimi-k2.5` | 256k | General purpose conversation | API Key |

## 🏗️ Architecture

This plugin integrates with the official Kimi CLI's OAuth flow:

1. **Kimi CLI** handles the OAuth dance with Moonshot AI
2. **Tokens** are stored securely in `~/.kimi/credentials/kimi-code.json`
3. **This plugin** reads those tokens and provides them to OpenClaw
4. **Auto-refresh** happens automatically when you use `kimi` commands

```
┌─────────────┐     OAuth     ┌──────────────┐
│  Kimi CLI   │ ◄──────────► │ Moonshot AI  │
│  (kimi)     │               │  (OAuth)     │
└──────┬──────┘               └──────────────┘
       │
       │ stores tokens
       ▼
┌─────────────┐     reads      ┌──────────────┐
│ ~/.kimi/    │ ─────────────► │  This Plugin │
│ credentials │                │              │
└─────────────┘                └──────┬───────┘
                                      │
                                      │ provides
                                      ▼
                               ┌──────────────┐
                               │   OpenClaw   │
                               │   Gateway    │
                               └──────────────┘
```

## 🛠️ Development

### Project Structure

```
openclaw-kimi-code-auth/
├── index.ts              # Main plugin entry point
├── oauth.ts              # OAuth credential reader
├── openclaw.plugin.json  # Plugin manifest
├── package.json          # Package metadata
└── README.md            # This file
```

### Building

No build step required - TypeScript is handled by OpenClaw's plugin loader.

### Testing

```bash
# Check if plugin loads
openclaw plugins list

# Verify provider is registered
openclaw models status | grep kimi-coding

# Test authentication
openclaw models auth login --provider kimi-coding
```

## 🐛 Troubleshooting

### "Kimi CLI not authenticated"

Run `kimi login` first:

```bash
kimi login
```

### Token expired

Tokens are refreshed automatically by Kimi CLI. Just run any kimi command:

```bash
kimi --version
```

Then retry the OpenClaw operation.

### Plugin not loading

Check the plugin status:

```bash
openclaw plugins list
```

If it shows "error", restart the gateway:

```bash
openclaw gateway restart
```

### Check OAuth status

```bash
openclaw models status
```

Look for:
```
- kimi-coding effective=profiles:~/.openclaw/agents/main/agent/auth-profiles.json 
  | profiles=1 (oauth=1, token=0, api_key=0) 
  | kimi-coding:default=OAuth
```

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 🙏 Acknowledgments

- [OpenClaw](https://docs.openclaw.ai/) - The autonomous AI agent platform
- [Moonshot AI](https://www.moonshot.cn/) - Creators of Kimi
- [Kimi CLI](https://github.com/moonshot-ai/kimi-cli) - Official CLI for Kimi

---

Made with ❤️ for the OpenClaw community
