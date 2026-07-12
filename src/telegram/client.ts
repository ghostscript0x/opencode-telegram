/**
 * OpenCode Telegram Plugin — Mirror sessions to Telegram
 * _______________________________________________________
 * Copyright (c) 2026 ghostscript0x
 * MIT License — see LICENSE file for full terms
 *
 * Low-level Telegram Bot API fetch wrappers.
 * Uses plain fetch — no extra dependencies.
 * All functions catch errors and return null rather than throwing.
 */
import type {
  TelegramMessageResult,
  TelegramUpdate,
} from "../types.js";

const BASE_URL = "https://api.telegram.org/bot";

function apiUrl(token: string, method: string): string {
  return `${BASE_URL}${token}/${method}`;
}

/**
 * Send a text message to a chat.
 */
export async function sendMessage(
  token: string,
  chatId: string | number,
  text: string,
  extra: Record<string, unknown> = {},
): Promise<TelegramMessageResult | null> {
  try {
    const body: Record<string, unknown> = {
      chat_id: chatId,
      text,
      ...extra,
      parse_mode: "HTML", // Always enforce HTML — don't let extra override
    };
    const res = await fetch(apiUrl(token, "sendMessage"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as TelegramMessageResult;
    if (!data.ok) {
      console.warn(`[tg] sendMessage failed: ${data.description}`);
    }
    return data;
  } catch (err) {
    console.warn(`[tg] sendMessage error:`, err);
    return null;
  }
}

/**
 * Edit an existing message's text.
 */
export async function editMessageText(
  token: string,
  chatId: string | number,
  messageId: number,
  text: string,
  extra: Record<string, unknown> = {},
): Promise<TelegramMessageResult | null> {
  try {
    const body: Record<string, unknown> = {
      chat_id: chatId,
      message_id: messageId,
      text,
      ...extra,
      parse_mode: "HTML", // Always enforce HTML — don't let extra override
    };
    const res = await fetch(apiUrl(token, "editMessageText"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as TelegramMessageResult;
    if (!data.ok) {
      // Suppress "message is not modified" warnings (they're harmless)
      if (!data.description?.includes("message is not modified")) {
        console.warn(`[tg] editMessageText failed: ${data.description}`);
      }
    }
    return data;
  } catch (err) {
    console.warn(`[tg] editMessageText error:`, err);
    return null;
  }
}

/**
 * Fetch pending updates from Telegram (long polling).
 */
export async function getUpdates(
  token: string,
  offset: number,
  timeout = 30,
): Promise<TelegramUpdate[] | null> {
  try {
    const url = `${apiUrl(token, "getUpdates")}?offset=${offset}&timeout=${timeout}`;
    const res = await fetch(url);
    const data = await res.json() as { ok: boolean; result?: TelegramUpdate[] };
    if (!data.ok) return null;
    return data.result ?? [];
  } catch (err) {
    console.warn(`[tg] getUpdates error:`, err);
    return null;
  }
}

/**
 * Answer a callback query (inline keyboard button press).
 */
export async function answerCallbackQuery(
  token: string,
  callbackQueryId: string,
  text?: string,
): Promise<void> {
  try {
    const body: Record<string, unknown> = {
      callback_query_id: callbackQueryId,
    };
    if (text) body.text = text;
    await fetch(apiUrl(token, "answerCallbackQuery"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.warn(`[tg] answerCallbackQuery error:`, err);
  }
}
