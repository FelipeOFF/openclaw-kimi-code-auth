/**
 * OAuth helpers for Kimi Code CLI integration.
 * Reuses existing Kimi CLI authentication from ~/.kimi/credentials/kimi-code.json
 */

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const KIMI_CREDENTIALS_PATH = join(homedir(), ".kimi", "credentials", "kimi-code.json");

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
 * Check if Kimi CLI is installed and authenticated.
 */
export function isKimiCliAuthenticated(): boolean {
  return readKimiCliCredentials() !== null;
}

/**
 * Login using existing Kimi CLI credentials.
 * If not authenticated, guides the user to run `kimi login` first.
 */
export async function loginKimiCodeOAuth(
  ctx: KimiCodeOAuthContext,
): Promise<KimiCodeOAuthCredentials> {
  const credentials = readKimiCliCredentials();

  if (credentials) {
    ctx.progress.stop("Found existing Kimi CLI authentication");
    return credentials;
  }

  // No existing credentials - guide user to authenticate with Kimi CLI
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

/**
 * Refresh OAuth tokens using Kimi CLI's refresh mechanism.
 * This delegates to the Kimi CLI to handle token refresh.
 */
export async function refreshKimiCodeTokens(
  refreshToken: string,
): Promise<KimiCodeOAuthCredentials | null> {
  // For now, we rely on the Kimi CLI to refresh tokens.
  // When the user runs `kimi` commands, the CLI automatically refreshes tokens.
  // We just re-read the credentials file.
  const credentials = readKimiCliCredentials();
  
  if (credentials && credentials.refresh === refreshToken) {
    return credentials;
  }

  return null;
}
