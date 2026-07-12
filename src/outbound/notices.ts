/**
 * OpenCode Telegram Plugin — Mirror sessions to Telegram
 * _______________________________________________________
 * Copyright (c) 2026 ghostscript0x
 * MIT License — see LICENSE file for full terms
 *
 * One-line notices for non-streaming events.
 * Sends a single message per event — no editing, no throttling.
 */
import { sendMessage } from "../telegram/client.js";
import type { PluginConfig } from "../config.js";
import type { PluginState } from "../types.js";
import type {
  Event,
  EventCommandExecuted,
  EventFileEdited,
  EventSessionIdle,
  EventSessionError,
  EventMessageUpdated,
  AssistantMessage,
  EventSessionCreated,
} from "@opencode-ai/sdk";

// ── Helpers ──

function chatId(config: PluginConfig): string | number | null {
  // If the user configured TELEGRAM_CHAT_ID, use that.
  // Otherwise, we can't send one-liners without knowing the target.
  return config.chatId;
}

// ── Event handlers ──

export async function handleCommandExecuted(
  event: EventCommandExecuted,
  state: PluginState,
  config: PluginConfig,
): Promise<void> {
  const cid = chatId(config);
  if (!cid) return;
  const { name, arguments: args, sessionID } = event.properties;
  // Truncate args to avoid super-long messages
  const shortArgs = args && args.length > 80
    ? args.slice(0, 80) + "…"
    : args ?? "";
  const text = `⚡ <b>${escapeHtml(name)}</b> ${escapeHtml(shortArgs)}`;
  // Prepend session ID if it differs from active
  const prefix = (state.activeSessionId && state.activeSessionId !== sessionID)
    ? `[<code>${escapeHtml(sessionID.slice(0, 8))}</code>] `
    : "";
  await sendMessage(config.botToken, cid, prefix + text);
}

export async function handleFileEdited(
  event: EventFileEdited,
  config: PluginConfig,
): Promise<void> {
  const cid = chatId(config);
  if (!cid) return;
  const { file } = event.properties;
  const text = `📝 <code>${escapeHtml(file)}</code>`;
  await sendMessage(config.botToken, cid, text);
}

export async function handleSessionIdle(
  event: EventSessionIdle,
  state: PluginState,
  config: PluginConfig,
): Promise<void> {
  const cid = chatId(config);
  if (!cid) return;

  // Flush any pending text buffer first
  const { sessionID } = event.properties;

  const text = state.activeSessionId === sessionID
    ? `✅ <b>Turn complete</b>`
    : `✅ <b>Turn complete</b> [<code>${escapeHtml(sessionID.slice(0, 8))}</code>]`;
  await sendMessage(config.botToken, cid, text);
}

export async function handleSessionError(
  event: EventSessionError,
  config: PluginConfig,
): Promise<void> {
  const cid = chatId(config);
  if (!cid) return;
  const { sessionID, error } = event.properties;
  const errorMsg = error
    ? (error as { data?: { message?: string } }).data?.message ?? "Unknown error"
    : "Unknown error";
  const sid = sessionID ? ` [<code>${escapeHtml(sessionID.slice(0, 8))}</code>]` : "";
  const text = `❌ <b>Error</b>${sid}: ${escapeHtml(errorMsg)}`;
  await sendMessage(config.botToken, cid, text);
}

export async function handleMessageUpdated(
  event: EventMessageUpdated,
  config: PluginConfig,
): Promise<void> {
  const cid = chatId(config);
  if (!cid) return;
  const msg = event.properties.info;
  // Only report errors on assistant messages
  if (msg.role === "assistant" && (msg as AssistantMessage).error) {
    const err = (msg as AssistantMessage).error!;
    const errMsg = (err as { data?: { message?: string } }).data?.message ?? "Error in response";
    const text = `⚠️ <b>Response error</b>: ${escapeHtml(errMsg)}`;
    await sendMessage(config.botToken, cid, text);
  }
}

export async function handleSessionCreated(
  event: EventSessionCreated,
  state: PluginState,
  config: PluginConfig,
): Promise<void> {
  const cid = chatId(config);
  if (!cid) return;
  const { info } = event.properties;

  // Auto-track first session as active
  if (!state.activeSessionId) {
    state.activeSessionId = info.id;
  }

  const title = info.title || "untitled";
  const text = `🆕 <b>Session created</b>: ${escapeHtml(title)} (<code>${escapeHtml(info.id.slice(0, 8))}</code>)`;
  await sendMessage(config.botToken, cid, text);
}

/**
 * Handle an assistant message completion — send metadata to Telegram.
 * Deduplicates by message ID so we only report each message once.
 */
export async function handleAssistantMessage(
  event: { properties: { info: { id: string; sessionID: string; role: string; modelID?: string; providerID?: string; cost?: number; tokens?: { input: number; output: number; reasoning: number }; finish?: string; error?: unknown } } },
  config: PluginConfig,
  state: PluginState,
): Promise<void> {
  const cid = chatId(config);
  if (!cid) return;

  const info = event.properties.info;
  if (info.error) return;

  // Dedup: only report each assistant message once
  if (state.reportedAssistantIds.has(info.id)) return;
  state.reportedAssistantIds.add(info.id);

  // Skip intermediate messages with 0 output tokens
  if (info.tokens && info.tokens.output === 0 && !info.finish) return;

  const modelTag = info.modelID ? ` · ${escapeHtml(info.modelID)}` : "";
  const tokenInfo = info.tokens
    ? ` · ⬆${info.tokens.input} ⬇${info.tokens.output}`
    : "";
  const costInfo = info.cost ? ` · $${info.cost.toFixed(4)}` : "";
  const finishReason = info.finish === "stop" ? " ✅" : info.finish ? ` (${info.finish})` : "";

  const text = `🤖 <b>Response complete</b>${modelTag}${tokenInfo}${costInfo}${finishReason}`;
  await sendMessage(config.botToken, cid, text);
}

// ── Utils ──

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
