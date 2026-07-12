/**
 * OpenCode Telegram Plugin — Mirror sessions to Telegram
 * _______________________________________________________
 * Copyright (c) 2026 ghostscript0x
 * MIT License — see LICENSE file for full terms
 *
 * Text part streaming handler.
 *
 * For each messageID, we maintain a single Telegram message.
 * The first chunk sends a new message; subsequent chunks edit it —
 * throttled to one edit per second per buffer.
 *
 * Uses `part.text` (the full text of the part) rather than `delta`,
 * because `delta` is optional and may be empty for some event sources.
 *
 * On session.idle, we flush all buffers belonging to that session.
 */
import { sendMessage, editMessageText } from "../telegram/client.js";
import type { PluginConfig } from "../config.js";
import type { PluginState, TextBufferEntry } from "../types.js";
import type { EventMessagePartUpdated, TextPart } from "@opencode-ai/sdk";

const THROTTLE_MS = 1_000;
const MAX_TEXT_LENGTH = 4_000;

/**
 * Handle a `message.part.updated` event where the part type is "text".
 */
export async function handleTextPartUpdated(
  event: EventMessagePartUpdated,
  state: PluginState,
  config: PluginConfig,
): Promise<void> {
  const part = event.properties.part;
  if (part.type !== "text") return;

  const textPart = part as TextPart;
  const { messageID, sessionID } = textPart;
  const fullText = textPart.text ?? "";
  const chatId = config.chatId;

  if (!chatId) return;

  // Get or create buffer for this messageID
  let buffer = state.textBuffers.get(messageID);
  if (!buffer) {
    buffer = {
      chatId,
      sessionID,
      telegramMessageId: null,
      accumulatedText: "",
      lastSentAt: 0,
    };
    state.textBuffers.set(messageID, buffer);
  }

  // Use full text from the part (more reliable than delta)
  buffer.accumulatedText = fullText;

  const now = Date.now();
  const timeSinceLastEdit = now - buffer.lastSentAt;

  if (buffer.telegramMessageId === null) {
    // First chunk — send a new message
    const displayText = formatDisplayText(buffer.accumulatedText);
    if (!displayText) return;

    const result = await sendMessage(config.botToken, chatId, displayText, {
      disable_web_page_preview: true,
    });
    if (result?.ok && result.result) {
      buffer.telegramMessageId = result.result.message_id;
      buffer.lastSentAt = Date.now();
    }
  } else if (timeSinceLastEdit >= THROTTLE_MS && fullText.length > 0) {
    // Subsequent chunk — edit (throttled)
    const displayText = formatDisplayText(buffer.accumulatedText);
    if (!displayText) return;

    await editMessageText(config.botToken, chatId, buffer.telegramMessageId, displayText, {
      disable_web_page_preview: true,
    });
    buffer.lastSentAt = Date.now();
  }
}

/**
 * Flush (final edit + cleanup) a single text buffer.
 */
export async function flushTextBuffer(
  messageID: string,
  state: PluginState,
  config: PluginConfig,
): Promise<void> {
  const buffer = state.textBuffers.get(messageID);
  if (!buffer) return;

  if (buffer.telegramMessageId !== null) {
    const displayText = formatDisplayText(buffer.accumulatedText);
    if (displayText) {
      await editMessageText(config.botToken, buffer.chatId, buffer.telegramMessageId, displayText, {
        disable_web_page_preview: true,
      });
    }
  }

  state.textBuffers.delete(messageID);
}

/**
 * Flush all buffers belonging to a given session.
 * Called on session.idle.
 */
export function flushSessionBuffers(
  sessionID: string,
  state: PluginState,
  config: PluginConfig,
): void {
  for (const [messageID, buffer] of state.textBuffers.entries()) {
    if (buffer.sessionID === sessionID) {
      // Fire and forget — no await, don't block the event hook
      flushTextBuffer(messageID, state, config).catch(() => {});
    }
  }
}

// ── Formatting ──

function formatDisplayText(text: string): string {
  if (!text) return "";

  let display = text;
  if (display.length > MAX_TEXT_LENGTH) {
    const over = display.length - MAX_TEXT_LENGTH + 100;
    display = display.slice(0, MAX_TEXT_LENGTH - 100) +
      `\n\n… <i>(truncated, ${over} more chars)</i>`;
  }

  return escapeHtml(display);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
