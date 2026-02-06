# 🔐 OpenClaw Kimi Code Auth Plugin

[![OpenClaw](https://img.shields.io/badge/OpenClaw-Plugin-blue)](https://docs.openclaw.ai/)
[![Kimi](https://img.shields.io/badge/Kimi-Moonshot%20AI-green)](https://kimi.moonshot.cn/)
[![License](https://img.shields.io/badge/license-MIT-yellow)](LICENSE)

OAuth provider plugin for [Kimi Code CLI](https://github.com/moonshot-ai/kimi-cli) integration with [OpenClaw](https://docs.openclaw.ai/).

## ⚠️ Important: Token Expiration Notice

Kimi OAuth tokens expire **every 10 minutes** - much faster than other providers (Google, Anthropic, etc. typically have tokens lasting hours or days).

**To prevent interruptions, you MUST set up automatic token renewal.** See [Auto-Renewal Setup](#-auto-renewal-setup) below.

Without auto-renewal, OpenClaw will fall back to other configured providers (like Gemini) when the Kimi token expires.

## ✨ Features

- 🔑 **OAuth Authentication** - More secure than API keys
- 🔄 **Token Reuse** - Leverages existing Kimi CLI authentication
- ⚡ **Auto-refresh** - Automatic token renewal via cron (recommended)
- 🎯 **Zero Config** - Works out of the box after `kimi login`
- 🔒 **Secure** - Tokens stored in OpenClaw's encrypted auth profiles

## 📋 Requirements

- [OpenClaw](https://docs.openclaw.ai/) installed
- [Kimi CLI](https://github.com/moonshot-ai/kimi-cli) installed and authenticated
- `jq` installed (for JSON processing in renewal script)

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

#### Option A: Install from GitHub (recommended)

```bash
# Install directly from GitHub
openclaw plugins install https://github.com/FelipeOFF/openclaw-kimi-code-auth

# Restart the gateway
openclaw gateway restart
```

#### Option B: Clone and install locally

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

### 6. ⚡ Set Up Auto-Renewal (Required!)

Kimi tokens expire every 10 minutes. To ensure continuous operation, run:

```bash
cd openclaw-kimi-code-auth
./setup-auto-renewal.sh
```

This will:
- Install the renewal script
- Configure cron to run it every 5 minutes
- Set up logging for monitoring

**Or manually:**

```bash
# Copy the renewal script
cp renew-kimi-token.sh ~/.openclaw/workspace/scripts/
chmod +x ~/.openclaw/workspace/scripts/renew-kimi-token.sh

# Add to crontab
crontab -e
# Add this line:
*/5 * * * * /home/YOUR_USERNAME/.openclaw/workspace/scripts/renew-kimi-token.sh
```

Verify it's working:
```bash
tail -f ~/.openclaw/logs/kimi-token-renewal.log
```

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

## 🔄 Auto-Renewal Setup

### Why Auto-Renewal is Needed

Kimi OAuth tokens expire every **10 minutes** (600 seconds). This is by design from Moonshot AI and is much shorter than:
- Google OAuth: ~1 hour
- GitHub OAuth: No expiration (refresh tokens)
- OpenAI API keys: No expiration

Without auto-renewal, you would need to manually run `kimi login` every 10 minutes.

### How the Renewal Script Works

The `renew-kimi-token.sh` script:
1. Runs every 5 minutes via cron
2. Checks token expiration time
3. If less than 5 minutes remaining, triggers `kimi login`
4. Updates `~/.openclaw/agents/main/agent/auth-profiles.json` with new tokens
5. Restarts OpenClaw gateway to use new tokens

### Monitoring

View renewal logs:
```bash
tail -f ~/.openclaw/logs/kimi-token-renewal.log
```

Example output:
```
[2026-02-06 01:35:00] Token expires in 2 minutes (120s)
[2026-02-06 01:35:00] Token expiring soon, attempting renewal...
[2026-02-06 01:35:05] kimi login completed successfully
[2026-02-06 01:35:05] New token expires in 10 minutes
[2026-02-06 01:35:06] Auth profiles updated successfully
[2026-02-06 01:35:07] Gateway restarted successfully
[2026-02-06 01:35:07] Token renewal cycle completed
```

### Troubleshooting Auto-Renewal

**Script not running?**
```bash
# Check crontab
crontab -l | grep kimi-token

# Check if script is executable
ls -la ~/.openclaw/workspace/scripts/renew-kimi-token.sh

# Run manually to test
~/.openclaw/workspace/scripts/renew-kimi-token.sh
```

**Token still expiring?**
```bash
# Check current token expiration
cat ~/.kimi/credentials/kimi-code.json | jq '.expires_at'
date +%s
# Calculate difference
```

**Gateway not restarting?**
```bash
# Check if openclaw command is in PATH
which openclaw

# Try restarting manually
openclaw gateway restart
```

## 🏗️ Architecture

This plugin follows the same pattern as official OpenClaw OAuth providers:

### OAuth Flow

1. **Kimi CLI** handles the OAuth dance with Moonshot AI
2. **Tokens** are stored securely in `~/.kimi/credentials/kimi-code.json`
3. **This plugin** reads those tokens and provides them to OpenClaw
4. **Auto-refresh** happens via the cron script every 5 minutes

### Plugin Pattern

Following the same architecture as official providers:
- Uses `api.registerProvider()` to register the OAuth provider
- Returns `configPatch` to automatically register models and provider config
- Uses `OAUTH_PLACEHOLDER` for apiKey (same as Qwen, Gemini plugins)
- Models are automatically added to the allowlist

```
┌─────────────┐     OAuth     ┌──────────────┐
│  Kimi CLI   │ ◄──────────► │ Moonshot AI  │
│  (kimi)     │               │  (OAuth)     │
└──────┬──────┘               └──────────────┘
       │
       │ stores tokens                    ┌─────────────────┐
       ▼                                    │                 │
┌─────────────┐     reads      ┌───────────┤  renew-kimi-    │
│ ~/.kimi/    │ ─────────────► │  Plugin   │  token.sh       │
│ credentials │                │           │  (cron every    │
└─────────────┘                └─────┬─────┘  5 min)         │
                                     │                       │
                                     │ configPatch           │
                                     ▼                       │
                              ┌──────────────┐              │
                              │   OpenClaw   │ ◄────────────┘
                              │   Gateway    │   auto-refresh
                              └──────────────┘
```

### Similar Providers

This plugin follows the same architecture as:
- `@openclaw/qwen-portal-auth` - Qwen OAuth
- `@openclaw/google-gemini-cli-auth` - Gemini OAuth  
- `@openclaw/google-antigravity-auth` - Google Antigravity OAuth

The key difference: Kimi's 10-minute token expiration requires the external cron-based renewal.

## 🛠️ Development

### Project Structure

```
openclaw-kimi-code-auth/
├── index.ts              # Main plugin entry point
├── oauth.ts              # OAuth credential reader with auto-refresh
├── openclaw.plugin.json  # Plugin manifest
├── package.json          # Package metadata
├── renew-kimi-token.sh   # Token renewal script (cron)
├── setup-auto-renewal.sh # Auto-renewal setup helper
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

# Test auto-renewal
./renew-kimi-token.sh
```

## 🐛 Troubleshooting

### "Kimi CLI not authenticated"

Run `kimi login` first:

```bash
kimi login
```

### Token expired / Falling back to Gemini

If OpenClaw falls back to Gemini instead of using Kimi, the token has expired.

**Quick fix:**
```bash
kimi login
openclaw gateway restart
```

**Permanent fix:**
Set up auto-renewal as described in [Auto-Renewal Setup](#-auto-renewal-setup).

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

### Check token expiration

```bash
# Check when token expires
cat ~/.kimi/credentials/kimi-code.json | jq '.expires_at'

# Convert to readable date
date -d @$(cat ~/.kimi/credentials/kimi-code.json | jq '.expires_at')  # Linux
date -r $(cat ~/.kimi/credentials/kimi-code.json | jq '.expires_at')   # macOS
```

### Verify auto-renewal is working

```bash
# Check cron job
crontab -l | grep kimi

# Check logs
cat ~/.openclaw/logs/kimi-token-renewal.log | tail -20

# Check if gateway restarted recently
openclaw gateway status
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
