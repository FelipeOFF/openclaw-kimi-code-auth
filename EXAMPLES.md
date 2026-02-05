# Usage Examples

## Basic Usage

### Send a message using Kimi Code

```bash
openclaw agent --model kimi-coding/kimi-for-coding --message "Explain recursion in Python"
```

### Set as default for all interactions

```bash
openclaw models set kimi-coding/kimi-for-coding
```

## Cron Jobs

### Daily code review at 9 AM

```bash
openclaw cron add \
  --name "morning-code-review" \
  --cron "0 9 * * *" \
  --tz "America/Sao_Paulo" \
  --model kimi-coding/kimi-for-coding \
  --session isolated \
  --message "Review yesterday's git commits and suggest improvements" \
  --announce \
  --to "telegram:YOUR_CHAT_ID"
```

### Weekly architecture review

```bash
openclaw cron add \
  --name "weekly-arch-review" \
  --cron "0 10 * * 1" \
  --model kimi-coding/kimi-for-coding \
  --message "Analyze the project architecture and suggest refactoring opportunities" \
  --timeout-seconds 1800
```

## Multi-Agent Setup

### Create a coding-specific agent

```bash
# Create new agent
openclaw agents add coding-assistant

# Configure it to use Kimi Code
openclaw models set --agent coding-assistant kimi-coding/kimi-for-coding

# Switch to the agent
openclaw agents switch coding-assistant

# Now all interactions use Kimi Code
openclaw agent --message "Refactor this function to use async/await"
```

## Telegram Integration

### Send coding help via Telegram

```bash
openclaw agent \
  --to "telegram:YOUR_CHAT_ID" \
  --model kimi-coding/kimi-for-coding \
  --message "Write a bash script that backs up my PostgreSQL database daily"
```

## Advanced Usage

### With thinking enabled

```bash
openclaw agent \
  --model kimi-coding/kimi-for-coding \
  --thinking high \
  --message "Design a distributed system for real-time chat"
```

### Timeout configuration

```bash
openclaw agent \
  --model kimi-coding/kimi-for-coding \
  --timeout-seconds 300 \
  --message "Generate a complete REST API with FastAPI and SQLModel"
```

## Fallback Chain

Configure multiple models as fallbacks:

```bash
# Set primary and fallbacks
openclaw config set agents.defaults.model.primary "kimi-coding/kimi-for-coding"
openclaw config set agents.defaults.model.fallbacks '["kimi-coding/kimi-for-coding", "openai-codex/gpt-5.2", "google-gemini-cli/gemini-3-pro-preview"]'
```

Or edit `~/.openclaw/openclaw.json`:

```json
{
  "agents": {
    "defaults": {
      "model": {
        "primary": "kimi-coding/kimi-for-coding",
        "fallbacks": [
          "kimi-coding/kimi-for-coding",
          "openai-codex/gpt-5.2",
          "google-gemini-cli/gemini-3-pro-preview"
        ]
      }
    }
  }
}
```

## Session Management

### Check available models

```bash
openclaw models list
```

### Check model status

```bash
openclaw models status
```

### View OAuth token status

```bash
openclaw models status | grep -A 2 "kimi-coding"
```

## Troubleshooting Commands

### Reset Kimi Code authentication

```bash
# Remove existing auth profile
rm ~/.openclaw/agents/main/agent/auth-profiles.json

# Re-authenticate
kimi login
openclaw models auth login --provider kimi-coding
```

### Check plugin status

```bash
openclaw plugins list | grep kimi
```

### Restart with plugin reload

```bash
openclaw gateway restart
sleep 5
openclaw models status
```
