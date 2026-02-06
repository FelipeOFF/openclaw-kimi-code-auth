/**
 * OAuth helpers for Kimi Code CLI integration.
 * Reuses existing Kimi CLI authentication from ~/.kimi/credentials/kimi-code.json
 * 
 * This version includes automatic token refresh when tokens are expired.
 */

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
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
 * Read existing OAuth credentials from Kimi CLI.
 * Kimi CLI stores credentials at ~/.kimi/credentials/kimi-code.json
 */
function readKimiCliCredentials(): KimiCodeOAuthCredentials | null {
  try {
    if (!existsSync(KIMI_CREDENTIALS_PATH)) {
      return null;
    }

    const content = readFileSync(KIMI_CREDENTIALS_PATH, "utf8");
    const data = JSON.parse(content) as {
      access_token?: string;
      refresh_token?: string;
      expires_at?: number;
      scope?: string;
      token_type?: string;
    };

    if (!data.access_token || !data.refresh_token) {
      return null;
    }

    return {
      access: data.access_token,
      refresh: data.refresh_token,
      expires: data.expires_at ? Math.floor(data.expires_at * 1000) : Date.now() + 3600 * 1000,
      scope: data.scope,
      tokenType: data.token_type,
    };
  } catch {
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
    log("Token expiring soon. Attempting to refresh via kimi login...");
    
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
          log("Token refreshed successfully!");
          resolve(true);
        } else {
          log("Token refresh may require manual login.");
          resolve(false);
        }
      }, 5000);
    });
  } catch (err) {
    log(`Token refresh failed: ${err}`);
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
