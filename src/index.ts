/**
 * OpenCode Telegram Plugin — Mirror sessions to Telegram
 * _______________________________________________________
 * Copyright (c) 2026 ghostscript0x
 * MIT License — see LICENSE file for full terms
 *
 * ## Outbound (mirror)
 * - Assistant text streams are buffered and edited into a single Telegram message
 * - Tool/command executions, file edits, session events send one-line notices
 * - Permission requests appear with inline Allow/Deny buttons
 *
 * ## Inbound (control)
 * - Plain messages send prompts to the active session
 * - /status, /sessions, /use, /new, /fork, /compact, /abort, /interrupt
 * - Button taps resolve permission requests
 */

import type { Plugin, PluginInput, PluginOptions } from "@opencode-ai/plugin";
import type { Permission } from "@opencode-ai/sdk";
import { loadConfig } from "./config.js";
import { createState } from "./state.js";
import { handleEvent } from "./outbound/index.js";
import { startPolling, stopPolling } from "./inbound/index.js";
import { sendMessage } from "./telegram/client.js";
import { buildPermissionKeyboard } from "./telegram/keyboard.js";

/**
 * Plugin entry point.
 *
 * Usage in opencode.json:
 * ```json
 * {
 *   "plugin": ["./path/to/plugin-telegram"]
 * }
 * ```
 */
const plugin: Plugin = async (input: PluginInput, _options?: PluginOptions) => {
  // ── 1. Load config (throws loudly if TELEGRAM_BOT_TOKEN missing) ──
  const config = loadConfig();

  // ── 2. Create shared state ──
  const state = createState();

  // Log startup
  const chatInfo = config.chatId
    ? `Chat ID: ${config.chatId}`
    : "No CHAT_ID set — inbound control disabled until /start used";
  console.log(`[tg] Plugin loaded. ${chatInfo}`);

  // ── 3. Start inbound polling immediately ──
  //    Polls Telegram's getUpdates every ~1s for messages from the configured chat.
  startPolling(state, config, input.client);
  console.log(`[tg] Inbound polling started.`);

  // ── 4. Return hooks ──
  return {
    /**
     * Event hook — receives all OpenCode events.
     * We fire-and-forget to avoid blocking the event loop.
     */
    event: async (input: { event: import("@opencode-ai/sdk").Event }) => {
      await handleEvent(input.event, state, config);
    },

    /**
     * Permission ask hook — inline keyboard with Allow/Deny buttons.
     */
    "permission.ask": async (
      permInput: Permission,
      output: { status: "ask" | "deny" | "allow" },
    ) => {
      const chatId = config.chatId;
      if (!chatId) {
        // If no CHAT_ID configured, can't send buttons — fall back to "ask"
        output.status = "ask";
        return;
      }

      // Send a message with inline Allow/Deny buttons
      const keyboard = buildPermissionKeyboard(permInput.id);
      const text = `🔐 <b>Permission requested</b>\n${escapeHtml(permInput.title)}`;
      const result = await sendMessage(config.botToken, chatId, text, {
        reply_markup: keyboard,
      });

      if (!result?.ok) {
        // Can't send buttons — fall back to ask
        output.status = "ask";
        return;
      }

      // Create a promise that resolves when the user taps a button
      const promise = new Promise<"allow" | "deny">((resolve) => {
        state.permissionResolvers.set(permInput.id, resolve);
      });

      // Wait for the Telegram user to click a button (with timeout)
      const timeout = 120_000; // 2 minutes
      const timer = setTimeout(() => {
        state.permissionResolvers.delete(permInput.id);
        output.status = "ask"; // fall back to TUI
      }, timeout);

      try {
        const decision = await promise;
        clearTimeout(timer);
        output.status = decision;
      } catch {
        clearTimeout(timer);
        output.status = "ask";
      }
    },

    /**
     * Dispose hook — clean up polling interval.
     */
    dispose: async () => {
      stopPolling(state);
      console.log("[tg] Plugin disposed.");
    },
  };
};

export default plugin;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Also export named for flexibility
export { plugin };
