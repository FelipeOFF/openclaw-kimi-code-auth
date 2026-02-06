#!/bin/bash
# Setup automatic token renewal for Kimi Code OpenClaw plugin
# This script configures cron to automatically renew Kimi tokens every 5 minutes

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RENEWAL_SCRIPT="${HOME}/.openclaw/workspace/scripts/renew-kimi-token.sh"
CRON_JOB="*/5 * * * * ${RENEWAL_SCRIPT}"

echo "=== Kimi Code Auto-Renewal Setup ==="
echo

# Check dependencies
if ! command -v kimi &> /dev/null; then
    echo "ERROR: kimi CLI not found. Please install it first:"
    echo "  https://github.com/moonshot-ai/kimi-cli"
    exit 1
fi

if ! command -v jq &> /dev/null; then
    echo "ERROR: jq not found. Please install it first:"
    echo "  Ubuntu/Debian: sudo apt-get install jq"
    echo "  macOS: brew install jq"
    exit 1
fi

# Check if already authenticated with Kimi
if [[ ! -f "${HOME}/.kimi/credentials/kimi-code.json" ]]; then
    echo "ERROR: Not authenticated with Kimi CLI."
    echo "Please run 'kimi login' first to authenticate."
    exit 1
fi

echo "✓ Kimi CLI found"
echo "✓ jq found"
echo "✓ Kimi credentials found"

# Create scripts directory
mkdir -p "${HOME}/.openclaw/workspace/scripts"

# Copy renewal script if not exists, or update it
if [[ ! -f "$RENEWAL_SCRIPT" ]]; then
    echo "→ Copying renewal script to ${RENEWAL_SCRIPT}"
    cp "${SCRIPT_DIR}/renew-kimi-token.sh" "$RENEWAL_SCRIPT" 2>/dev/null || \
        curl -fsSL "https://raw.githubusercontent.com/FelipeOFF/openclaw-kimi-code-auth/main/renew-kimi-token.sh" -o "$RENEWAL_SCRIPT"
    chmod +x "$RENEWAL_SCRIPT"
else
    echo "✓ Renewal script already exists at ${RENEWAL_SCRIPT}"
fi

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "renew-kimi-token.sh"; then
    echo "✓ Cron job already configured"
else
    echo "→ Adding cron job for automatic token renewal"
    (crontab -l 2>/dev/null || echo "") | {
        cat
        echo "# Kimi Code automatic token renewal (runs every 5 minutes)"
        echo "$CRON_JOB"
    } | crontab -
    echo "✓ Cron job added"
fi

echo
echo "=== Setup Complete ==="
echo
echo "Token renewal is now configured to run every 5 minutes."
echo "Logs will be written to: ${HOME}/.openclaw/logs/kimi-token-renewal.log"
echo
echo "To verify it's working, run:"
echo "  tail -f ${HOME}/.openclaw/logs/kimi-token-renewal.log"
echo
echo "To manually test the renewal script:"
echo "  ${RENEWAL_SCRIPT}"
echo
echo "To remove the cron job later:"
echo "  crontab -e"
echo "  # Remove the line containing renew-kimi-token.sh"
