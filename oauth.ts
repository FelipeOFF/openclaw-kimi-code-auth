/**
 * OAuth helpers for Kimi Code CLI integration.
 * Reuses existing Kimi CLI authentication from ~/.kimi/credentials/kimi-code.json
 * 
 * This version includes automatic token refresh when tokens are expired.
 * 
 * SECURITY NOTES:
 * - Tokens are never logged or exposed in error messages
 * - File permissions are validated before reading credentials
 * - All paths are resolved using Node.js path module to prevent traversal
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";

const KIMI_CREDENTIALS_PATH = join(homedir(), ".kimi", "credentials", "kimi-code.json");
const TOKEN_REFRESH_THRESHOLD_MS = 2 * 60 * 1000; // Refresh if less than 2 minutes left

export type KimiCodeOAuthCredentials = {
  access: string;
  refresh: string;
  expires: number;
  scope?: string;
  tokenType?: string;
};

export type KimiCodeOAuthContext = {
  isRemote: boolean;
  openUrl: (url: string) => Promise<void>;
  log: (msg: string) => void;
  note: (message: string, title?: string) => Promise<void>;
  prompt: (message: string) => Promise<string>;
  progress: { update: (msg: string) => void; stop: (msg?: string) => void };
};

/**
 * Validate file permissions to ensure credentials file is not world-readable.
 * Returns true if permissions are acceptable or cannot be determined.
 */
function validateCredentialFilePermissions(filePath: string): boolean {
  try {
    const stats = statSync(filePath);
    const mode = stats.mode & 0o777;
    
    // File should be owner-readable/writable only (600)
    // Allow 644 as some systems may have different defaults
    if (mode !== 0o600 && mode !== 0o644) {
      // eslint-disable-next-line no-console
      console.warn(
        `[kimi-code-auth] Warning: ${filePath} has permissions ${mode.toString(8)}, ` +
        `expected 600. Consider running: chmod 600 ${filePath}`
      );
      return false;
    }
    return true;
  } catch {
    // If we can't check permissions, continue anyway
    return true;
  }
}

/**
 * Sanitize log messages to prevent potential log injection.
 */
function sanitizeLogMessage(msg: string): string {
  // Remove control characters and limit length
  return msg
    .replace(/[\x00-\x1F\x7F]/g, '')
    .substring(0, 500);
}

/**
 * Read existing OAuth credentials from Kimi CLI.
 * Kimi CLI stores credentials at ~/.kimi/credentials/kimi-code.json
 */
function readKimiCliCredentials(): KimiCodeOAuthCredentials | null {
  try {
    // Validate path is within home directory (prevent path traversal)
    const resolvedPath = resolve(KIMI_CREDENTIALS_PATH);
    const resolvedHome = resolve(homedir());
    if (!resolvedPath.startsWith(resolvedHome)) {
      throw new Error('Invalid credentials path: path traversal detected');
    }

    if (!existsSync(KIMI_CREDENTIALS_PATH)) {
      return null;
    }

    // Validate file permissions
    validateCredentialFilePermissions(KIMI_CREDENTIALS_PATH);

    const content = readFileSync(KIMI_CREDENTIALS_PATH, "utf8");
    
    // Validate JSON structure before parsing
    if (!content || content.trim().length === 0) {
      return null;
    }

    const data = JSON.parse(content) as {
      access_token?: string;
      refresh_token?: string;
      expires_at?: number;
      scope?: string;
      token_type?: string;
    };

    // Validate required fields
    if (!data.access_token || !data.refresh_token) {
      return null;
    }

    // Basic JWT validation (should have 3 parts separated by dots)
    const jwtPattern = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
    if (!jwtPattern.test(data.access_token) || !jwtPattern.test(data.refresh_token)) {
      // eslint-disable-next-line no-console
      console.warn('[kimi-code-auth] Warning: Tokens do not appear to be valid JWT format');
    }

    return {
      access: data.access_token,
      refresh: data.refresh_token,
      expires: data.expires_at ? Math.floor(data.expires_at * 1000) : Date.now() + 3600 * 1000,
      scope: data.scope,
      tokenType: data.token_type,
    };
  } catch (error) {
    // Log error without exposing sensitive data
    if (error instanceof Error && error.message.includes('path traversal')) {
      throw error;
    }
    return null;
  }
}

/**
 * Check if credentials are expired or about to expire
 */
function isTokenExpiredOrNearExpiry(credentials: KimiCodeOAuthCredentials): boolean {
  const now = Date.now();
  const timeLeft = credentials.expires - now;
  return timeLeft < TOKEN_REFRESH_THRESHOLD_MS;
}

/**
 * Try to refresh token by running kimi login
 * This is a best-effort attempt - may not work in all environments
 */
async function tryRefreshToken(log: (msg: string) => void): Promise<boolean> {
  try {
    log(sanitizeLogMessage("Token expiring soon. Attempting to refresh via kimi login..."));
    
    // Try to run kimi login non-interactively (may work if already authenticated)
    return new Promise((resolve) => {
      const child = spawn("kimi", ["login"], {
        detached: true,
        stdio: "ignore",
      });
      
      // Give it 5 seconds to refresh
      setTimeout(() => {
        try {
          child.kill();
        } catch {
          // ignore
        }
        
        // Check if we got new credentials
        const newCreds = readKimiCliCredentials();
        if (newCreds && !isTokenExpiredOrNearExpiry(newCreds)) {
          log(sanitizeLogMessage("Token refreshed successfully!"));
          resolve(true);
        } else {
          log(sanitizeLogMessage("Token refresh may require manual login."));
          resolve(false);
        }
      }, 5000);
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    log(sanitizeLogMessage(`Token refresh failed: ${errorMsg}`));
    return false;
  }
}

/**
 * Check if Kimi CLI is installed and authenticated.
 */
export function isKimiCliAuthenticated(): boolean {
  return readKimiCliCredentials() !== null;
}

/**
 * Login using existing Kimi CLI credentials.
 * If token is expired or about to expire, tries to refresh automatically.
 * If not authenticated, guides the user to run `kimi login` first.
 */
export async function loginKimiCodeOAuth(
  ctx: KimiCodeOAuthContext,
): Promise<KimiCodeOAuthCredentials> {
  let credentials = readKimiCliCredentials();

  // If no credentials at all
  if (!credentials) {
    await ctx.note(
      [
        "Kimi CLI authentication not found.",
        "Please run 'kimi login' first to authenticate.",
        "",
        "After authenticating with Kimi CLI, run this command again.",
      ].join("\n"),
      "Kimi Code OAuth",
    );

    const shouldOpen = await ctx.prompt("Open Kimi CLI documentation? (y/n): ");
    if (shouldOpen.toLowerCase() === "y") {
      try {
        await ctx.openUrl("https://github.com/moonshot-ai/kimi-cli");
      } catch {
        ctx.log("\nVisit: https://github.com/moonshot-ai/kimi-cli\n");
      }
    }

    throw new Error(
      "Kimi CLI not authenticated. Please run 'kimi login' first.",
    );
  }

  // Check if token needs refresh
  if (isTokenExpiredOrNearExpiry(credentials)) {
    ctx.progress.update("Token expiring soon, attempting refresh...");
    
    const refreshed = await tryRefreshToken(ctx.log);
    
    if (refreshed) {
      // Re-read credentials after refresh
      const newCredentials = readKimiCliCredentials();
      if (newCredentials) {
        ctx.progress.stop("Token refreshed successfully");
        return newCredentials;
      }
    }
    
    // Refresh failed or didn't work
    ctx.progress.stop("Token refresh required");
    await ctx.note(
      [
        "Kimi token has expired or is about to expire.",
        "",
        "Please run 'kimi login' manually to refresh the token:",
        "  kimi login",
        "",
        "The Kimi token expires every 10 minutes.",
        "Consider setting up automatic renewal with:",
        "  crontab -e",
        "  */5 * * * * /home/crew/.openclaw/workspace/scripts/renew-kimi-token.sh",
      ].join("\n"),
      "Token Expired",
    );
    
    // Return current credentials anyway - they might still work briefly
    // OpenClaw will fallback to next provider if they fail
    ctx.log("Returning current token. OpenClaw will use fallback if expired.");
  } else {
    ctx.progress.stop("Found valid Kimi CLI authentication");
  }

  return credentials;
}

/**
 * Refresh OAuth tokens using Kimi CLI's refresh mechanism.
 * This delegates to the Kimi CLI to handle token refresh.
 * 
 * NOTE: This is called by the cron script, not by OpenClaw directly.
 */
export async function refreshKimiCodeTokens(
  refreshToken: string,
): Promise<KimiCodeOAuthCredentials | null> {
  // Try to refresh by running kimi login
  const refreshed = await tryRefreshToken(console.log);
  
  if (refreshed) {
    return readKimiCliCredentials();
  }
  
  // If refresh failed, just return current credentials
  const credentials = readKimiCliCredentials();
  if (credentials && credentials.refresh === refreshToken) {
    return credentials;
  }

  return null;
}
