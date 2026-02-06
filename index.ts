/**
 * OpenClaw plugin for Kimi Code OAuth authentication.
 * 
 * This plugin integrates with the official Kimi CLI (kimi-code) to provide
 * OAuth-based authentication for OpenClaw. It reuses existing Kimi CLI
 * credentials from ~/.kimi/credentials/kimi-code.json
 * 
 * Requirements:
 * - Kimi CLI must be installed: https://github.com/moonshot-ai/kimi-cli
 * - User must be logged in: `kimi login`
 * 
 * Provider ID: kimi-coding
 * Model: kimi-coding/kimi-for-coding
 */

import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";
import { loginKimiCodeOAuth } from "./oauth.js";

const PROVIDER_ID = "kimi-coding";
const PROVIDER_LABEL = "Kimi Code OAuth";
const DEFAULT_MODEL = "kimi-coding/kimi-for-coding";
const DEFAULT_BASE_URL = "https://api.kimi.com/coding/v1";
const OAUTH_PLACEHOLDER = "kimi-oauth";

const kimiCodingPlugin = {
  id: "kimi-code-auth",
  name: "Kimi Code Auth",
  description: "OAuth flow for Kimi Code CLI (Moonshot AI coding assistant)",
  configSchema: emptyPluginConfigSchema(),
  
  register(api) {
    api.registerProvider({
      id: PROVIDER_ID,
      label: PROVIDER_LABEL,
      docsPath: "/providers/models",
      aliases: ["kimi", "kimi-code"],
      envVars: ["KIMI_API_KEY"], // Fallback to API key if OAuth not available
      
      auth: [
        {
          id: "oauth",
          label: "Kimi CLI OAuth",
          hint: "Reuse existing Kimi CLI authentication",
          kind: "oauth",
          
          async run(ctx) {
            const spin = ctx.prompter.progress("Checking Kimi CLI authentication…");
            
            try {
              const result = await loginKimiCodeOAuth({
                isRemote: ctx.isRemote,
                openUrl: ctx.openUrl,
                log: (msg) => ctx.runtime.log(msg),
                note: ctx.prompter.note,
                prompt: async (message) => String(await ctx.prompter.text({ message })),
                progress: spin,
              });

              spin.stop("Kimi Code OAuth complete");
              
              return {
                profiles: [
                  {
                    profileId: `${PROVIDER_ID}:default`,
                    credential: {
                      type: "oauth",
                      provider: PROVIDER_ID,
                      access: result.access,
                      refresh: result.refresh,
                      expires: result.expires,
                      scope: result.scope,
                      tokenType: result.tokenType,
                    },
                  },
                ],
                configPatch: {
                  models: {
                    providers: {
                      [PROVIDER_ID]: {
                        baseUrl: DEFAULT_BASE_URL,
                        apiKey: OAUTH_PLACEHOLDER,
                        api: "openai-completions",
                        models: [
                          {
                            id: "kimi-for-coding",
                            name: "Kimi for Coding (OAuth)",
                            reasoning: true,
                            input: ["text", "image"],
                            cost: {
                              input: 0,
                              output: 0,
                              cacheRead: 0,
                              cacheWrite: 0,
                            },
                            contextWindow: 262144,
                            maxTokens: 8192,
                          },
                        ],
                      },
                    },
                  },
                  agents: {
                    defaults: {
                      models: {
                        [DEFAULT_MODEL]: {
                          alias: "Kimi Code",
                        },
                      },
                    },
                  },
                },
                defaultModel: DEFAULT_MODEL,
                notes: [
                  "Kimi Code uses OAuth via the official Kimi CLI.",
                  "If authentication fails, run 'kimi login' to refresh tokens.",
                  "Model: kimi-for-coding (262k context, supports thinking)",
                ],
              };
            } catch (err) {
              spin.stop("Kimi Code OAuth failed");
              
              if (err instanceof Error && err.message.includes("not authenticated")) {
                await ctx.prompter.note(
                  [
                    "Kimi CLI is not authenticated.",
                    "",
                    "To fix:",
                    "1. Install Kimi CLI: pip install kimi-cli",
                    "2. Login: kimi login",
                    "3. Run this command again",
                    "",
                    "Or use the Moonshot API Key provider instead.",
                  ].join("\n"),
                  "Authentication Required",
                );
              }
              
              throw err;
            }
          },
        },
      ],
    });
  },
};

export default kimiCodingPlugin;
