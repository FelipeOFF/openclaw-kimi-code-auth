#!/bin/bash
# Kimi Token Auto-Renewal Script
# 
# This script checks if the Kimi OAuth token is expiring soon and renews it.
# Run this via cron every 5 minutes: */5 * * * *
#
# The Kimi token expires every ~10 minutes, which is much shorter than
# other providers. This script ensures continuous operation by proactively
# refreshing the token before it expires.
#
# Installation:
#   1. Copy this script to ~/.openclaw/workspace/scripts/renew-kimi-token.sh
#   2. Make it executable: chmod +x renew-kimi-token.sh
#   3. Add to crontab: crontab -e
#      */5 * * * * /home/USER/.openclaw/workspace/scripts/renew-kimi-token.sh
#
# Or use the setup script: ./setup-auto-renewal.sh

set -e

# Ensure PATH includes common binary locations
export PATH="$HOME/.local/bin:$HOME/.asdf/shims:/usr/local/bin:/usr/bin:/bin:$PATH"

KIMI_CREDENTIALS="${HOME}/.kimi/credentials/kimi-code.json"
AUTH_PROFILES="${HOME}/.openclaw/agents/main/agent/auth-profiles.json"
LOG_DIR="${HOME}/.openclaw/logs"
LOG_FILE="${LOG_DIR}/kimi-token-renewal.log"

# Create log directory if needed
mkdir -p "$LOG_DIR"

# Timestamp
log_timestamp() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')]"
}

# Log function
log() {
    echo "$(log_timestamp) $1" | tee -a "$LOG_FILE"
}

# Check if jq is available
if ! command -v jq &> /dev/null; then
    log "ERROR: jq is required but not installed"
    exit 1
fi

# Check if kimi is available
if ! command -v kimi &> /dev/null; then
    log "ERROR: kimi command not found in PATH"
    exit 1
fi

# Check if files exist
if [[ ! -f "$KIMI_CREDENTIALS" ]]; then
    log "ERROR: Kimi credentials file not found: $KIMI_CREDENTIALS"
    log "Please run 'kimi login' first to authenticate"
    exit 1
fi

if [[ ! -f "$AUTH_PROFILES" ]]; then
    log "ERROR: OpenClaw auth profiles not found: $AUTH_PROFILES"
    exit 1
fi

# Read current credentials (truncate decimal part for bash compatibility)
expires_at=$(jq -r '.expires_at // 0' "$KIMI_CREDENTIALS" | cut -d. -f1)
current_time=$(date +%s)

# Check if expires_at is valid
if [[ -z "$expires_at" || "$expires_at" == "null" || "$expires_at" == "0" ]]; then
    log "ERROR: Invalid expires_at in credentials"
    exit 1
fi

# Calculate remaining time in seconds and minutes
remaining_seconds=$((expires_at - current_time))
remaining_minutes=$((remaining_seconds / 60))

log "Token expires in ${remaining_minutes} minutes (${remaining_seconds}s)"

# If more than 5 minutes remaining, no action needed
if (( remaining_seconds > 300 )); then
    log "Token is still valid, no action needed"
    exit 0
fi

# Token needs renewal - attempt to refresh via kimi login
log "Token expiring soon, attempting renewal..."

# Run kimi login to refresh token
# Note: This may open a browser if refresh token is also expired
log "Running: kimi login"

# Run with timeout and capture output
if timeout 30 kimi login 2>&1 | tee -a "$LOG_FILE"; then
    log "kimi login completed successfully"
else
    log "WARNING: kimi login may require manual authentication or timed out"
fi

# Re-read credentials after possible refresh
expires_at=$(jq -r '.expires_at // 0' "$KIMI_CREDENTIALS" | cut -d. -f1)
remaining_seconds=$((expires_at - current_time))
remaining_minutes=$((remaining_seconds / 60))
log "Token now expires in ${remaining_minutes} minutes"

# Update OpenClaw auth-profiles.json with current credentials using jq
log "Updating OpenClaw auth-profiles.json..."

# Create a temporary file for the updated auth profiles
TEMP_FILE=$(mktemp)
trap "rm -f $TEMP_FILE" EXIT

# Read the Kimi credentials
access_token=$(jq -r '.access_token // empty' "$KIMI_CREDENTIALS")
refresh_token=$(jq -r '.refresh_token // empty' "$KIMI_CREDENTIALS")
expires_at_ms=$(jq -r '.expires_at // 0' "$KIMI_CREDENTIALS" | awk '{printf "%d", $1 * 1000}')

if [[ -z "$access_token" || -z "$refresh_token" ]]; then
    log "ERROR: Could not read tokens from Kimi credentials"
    exit 1
fi

# Update auth-profiles.json using jq
jq --arg access "$access_token" \
   --arg refresh "$refresh_token" \
   --argjson expires "$expires_at_ms" '
  .profiles["kimi-coding:default"] = {
    type: "oauth",
    provider: "kimi-coding",
    access: $access,
    refresh: $refresh,
    expires: $expires
  }
' "$AUTH_PROFILES" > "$TEMP_FILE"

if [[ $? -eq 0 ]]; then
    mv "$TEMP_FILE" "$AUTH_PROFILES"
    log "Auth profiles updated successfully"
else
    log "ERROR: Failed to update auth profiles"
    exit 1
fi

# Restart OpenClaw gateway to pick up new credentials
log "Restarting OpenClaw gateway..."
if command -v openclaw &> /dev/null; then
    if openclaw gateway restart 2>&1 | tee -a "$LOG_FILE"; then
        log "Gateway restarted successfully"
    else
        log "WARNING: Failed to restart gateway"
    fi
else
    log "WARNING: openclaw command not found"
fi

log "Token renewal cycle completed"
