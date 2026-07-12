/**
 * OpenCode Telegram Plugin — Mirror sessions to Telegram
 * _______________________________________________________
 * Copyright (c) 2026 ghostscript0x
 * MIT License — see LICENSE file for full terms
 *
 * Inbound control: polls Telegram's getUpdates for messages from the
 * configured chat, and routes them to command handlers or permission
 * resolvers.
 *
 * Runs on setInterval (fire-and-forget) so it doesn't block the event loop.
 */
import { getUpdates, sendMessage, answerCallbackQuery } from "../telegram/client.js";
import { parseCallbackData, buildCommandKeyboard, buildMiniKeyboard } from "../telegram/keyboard.js";
import { handleCommand } from "./commands.js";
import type { PluginConfig } from "../config.js";
import type { PluginState } from "../types.js";
import type { OpencodeClient } from "@opencode-ai/sdk/client";

const POLL_DELAY_MS = 1_000;

/**
 * Start the polling loop using recursive setTimeout.
 * This ensures only ONE getUpdates request is active at a time,
 * avoiding connection pile-up from setInterval + long polling.
 * Does an immediate first poll, then continues every ~1s.
 */
export function startPolling(
  state: PluginState,
  config: PluginConfig,
  client: OpencodeClient,
): void {
  state.pollingActive = true;
  // Fire first poll immediately (don't wait 1s)
  runPollCycle(state, config, client);
}

/**
 * Run one poll cycle: pollOnce, then schedule the next.
 */
async function runPollCycle(
  state: PluginState,
  config: PluginConfig,
  client: OpencodeClient,
): Promise<void> {
  if (!state.pollingActive) return;

  try {
    await pollOnce(state, config, client);
  } catch (err) {
    console.error(`[tg:inbound] Poll error:`, err);
  }

  // Schedule next iteration
  if (state.pollingActive) {
    const timerId = setTimeout(() => {
      runPollCycle(state, config, client);
    }, POLL_DELAY_MS);
    state.pollingTimerId = timerId;
  }
}

/**
 * Stop the polling loop.
 */
export function stopPolling(state: PluginState): void {
  state.pollingActive = false;
  if (state.pollingTimerId !== null) {
    clearTimeout(state.pollingTimerId);
    state.pollingTimerId = null;
  }
}

/**
 * Single poll iteration.
 */
async function pollOnce(
  state: PluginState,
  config: PluginConfig,
  client: OpencodeClient,
): Promise<void> {
  const updates = await getUpdates(config.botToken, state.updateOffset, 3);
  if (!updates || updates.length === 0) return;

  for (const update of updates) {
    // Update offset so we don't process this update again
    state.updateOffset = update.update_id + 1;

    // Handle callback queries (inline keyboard button presses)
    if (update.callback_query) {
      await handleCallbackQuery(update.callback_query, state, config, client);
      continue;
    }

    // Handle text messages
    if (update.message?.text) {
      // If TELEGRAM_CHAT_ID is set, ignore messages from other chats
      if (config.chatId && String(update.message.chat.id) !== String(config.chatId)) {
        continue;
      }

      await handleTextMessage(update.message, state, config, client);
    }
  }
}

/**
 * Handle a text message from a chat.
 */
async function handleTextMessage(
  message: { message_id: number; chat: { id: number }; text?: string },
  state: PluginState,
  config: PluginConfig,
  client: OpencodeClient,
): Promise<void> {
  const text = message.text?.trim() ?? "";
  const chatId = message.chat.id;
  if (!text) return;

  let reply: string;

  if (text.startsWith("/")) {
    // Bot command
    reply = await handleCommand(text, state, client);
  } else {
    // Plain text — submit through the TUI so it shows up visually
    try {
      await client.tui.clearPrompt({});
      await client.tui.appendPrompt({ body: { text } });
      await client.tui.submitPrompt({});
      reply = `💬 Prompt submitted in TUI.`;
    } catch (err) {
      // Fallback: send via API directly
      try {
        const targetId = state.activeSessionId;
        if (targetId) {
          await client.session.prompt({
            path: { id: targetId },
            body: { parts: [{ type: "text", text }] },
          });
          reply = `💬 Prompt sent to <code>${escapeHtml(targetId.slice(0, 8))}</code>`;
        } else {
          reply = "⚠️ No active session. Use <code>/new &lt;prompt&gt;</code> or <code>/use &lt;id&gt;</code>.";
        }
      } catch {
        reply = `❌ Failed to send prompt.`;
      }
    }
  }

  await sendMessage(config.botToken, chatId, reply);
}

/**
 * Handle a callback query (inline keyboard button press).
 * Routes to permission resolvers or command execution.
 */
async function handleCallbackQuery(
  cb: { id: string; from: { id: number }; data?: string; message?: { message_id: number; chat: { id: number } } },
  state: PluginState,
  config: PluginConfig,
  client: OpencodeClient,
): Promise<void> {
  // Must have an associated message to validate chat origin
  if (!cb.message) {
    await answerCallbackQuery(config.botToken, cb.id, "Not supported");
    return;
  }

  // If TELEGRAM_CHAT_ID is set, ignore callbacks from other chats
  if (config.chatId && String(cb.message.chat.id) !== String(config.chatId)) {
    return;
  }

  if (!cb.data) return;

  const parsed = parseCallbackData(cb.data);
  if (!parsed) {
    await answerCallbackQuery(config.botToken, cb.id, "Unknown action");
    return;
  }

  // ── Permission buttons ──
  if (parsed.type === "permission") {
    const resolver = state.permissionResolvers.get(parsed.permissionID);
    if (resolver) {
      resolver(parsed.action);
      state.permissionResolvers.delete(parsed.permissionID);
      await answerCallbackQuery(
        config.botToken,
        cb.id,
        parsed.action === "allow" ? "✅ Allowed" : "❌ Denied",
      );

      if (cb.message) {
        const statusText = parsed.action === "allow" ? "✅ Allowed" : "❌ Denied";
        await sendMessage(config.botToken, cb.message.chat.id, statusText);
      }
    } else {
      await answerCallbackQuery(config.botToken, cb.id, "Permission already resolved");
    }
    return;
  }

  // ── Command buttons ──
  if (parsed.type === "command") {
    const cmd = parsed.command;
    // Answer the callback immediately to dismiss the loading spinner
    await answerCallbackQuery(config.botToken, cb.id, `Executing ${cmd}...`);

    // Execute the command and send the result as a new message
    const reply = await handleCommand(cmd, state, client);
    const chatId = cb.message.chat.id;

    // For /menu, send the command keyboard
    if (cmd === "/menu") {
      await sendMessage(config.botToken, chatId, "📋 <b>Command Menu</b> — tap a button:", {
        reply_markup: buildCommandKeyboard(),
      });
    } else {
      // For other commands, send the result with a mini keyboard
      await sendMessage(config.botToken, chatId, reply, {
        reply_markup: buildMiniKeyboard(),
      });
    }
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
