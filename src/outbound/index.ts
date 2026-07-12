/**
 * OpenCode Telegram Plugin — Mirror sessions to Telegram
 * _______________________________________________________
 * Copyright (c) 2026 ghostscript0x
 * MIT License — see LICENSE file for full terms
 *
 * Event dispatcher — routes each event type to the appropriate handler.
 * This is called from the plugin's `event` hook.
 *
 * We intentionally do NOT await notice sends or text-stream operations,
 * so the event hook returns immediately and doesn't block OpenCode.
 */
import type { Event } from "@opencode-ai/sdk";
import type { PluginConfig } from "../config.js";
import type { PluginState } from "../types.js";
import {
  handleCommandExecuted,
  handleFileEdited,
  handleSessionIdle,
  handleSessionError,
  handleMessageUpdated,
  handleSessionCreated,
  handleAssistantMessage,
} from "./notices.js";
import {
  handleTextPartUpdated,
  flushSessionBuffers,
} from "./text-stream.js";
import { sendMessage } from "../telegram/client.js";

export async function handleEvent(
  event: Event,
  state: PluginState,
  config: PluginConfig,
): Promise<void> {
  // Fire-and-forget: don't let a slow Telegram call block the event hook
  // We create a promise but don't await it — errors are caught internally.
  const task = (async () => {
    switch (event.type) {
      // ── Text streaming ──
      case "message.part.updated": {
        await handleTextPartUpdated(event, state, config);
        break;
      }

      // ── One-line notices ──
      case "command.executed": {
        await handleCommandExecuted(event, state, config);
        break;
      }

      case "file.edited": {
        await handleFileEdited(event, config);
        break;
      }

      case "session.idle": {
        // Flush all pending text buffers for this session first
        flushSessionBuffers(event.properties.sessionID, state, config);
        // Then send the "Turn complete" notice
        await handleSessionIdle(event, state, config);
        break;
      }

      case "session.error": {
        await handleSessionError(event, config);
        break;
      }

      case "session.created": {
        await handleSessionCreated(event, state, config);
        break;
      }

      case "session.updated": {
        // Could be useful for tracking session title changes
        break;
      }

      case "message.updated": {
        // Route by message role
        const info = event.properties.info;
        if (info.role === "assistant") {
          await handleAssistantMessage(event as any, config, state);
          // Also check for errors on assistant messages (existing behavior)
          if ((info as any).error) {
            await handleMessageUpdated(event as any, config);
          }
        }
        // User messages: text content is handled by text-stream via
        // `message.part.updated` — no separate handler needed.
        break;
      }

      case "tui.command.execute": {
        await handleTuiCommand(event as any, config);
        break;
      }

      // Ignore other event types
      default:
        break;
    }
  })();

  // Intentionally NOT awaiting — fire and forget
  task.catch((err) => {
    console.error(`[tg:outbound] Unhandled error processing ${event.type}:`, err);
  });
}

/**
 * Handle TUI command execution (e.g. session.new, session.list, etc.)
 */
async function handleTuiCommand(
  event: { properties: { command: string } },
  config: PluginConfig,
): Promise<void> {
  const cid = chatId(config);
  if (!cid) return;

  const cmd = event.properties.command;
  let emoji = "🖥️";
  if (cmd.includes("session.new")) emoji = "🆕";
  else if (cmd.includes("session.interrupt")) emoji = "⏹️";
  else if (cmd.includes("session.compact")) emoji = "🗜️";

  const text = `${emoji} <b>TUI</b>: <code>${escapeHtml(cmd)}</code>`;
  await sendMessage(config.botToken, cid, text);
}

function chatId(config: PluginConfig): string | number | null {
  return config.chatId;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
