/**
 * OpenCode Telegram Plugin — Mirror sessions to Telegram
 * _______________________________________________________
 * Copyright (c) 2026 ghostscript0x
 * MIT License — see LICENSE file for full terms
 *
 * Internal types used across the plugin.
 */

/** Per-message text buffer for streaming assistant text */
export interface TextBufferEntry {
  /** The Telegram chat ID where the message lives */
  chatId: string;
  /** The OpenCode session this buffer belongs to */
  sessionID: string;
  /** Telegram message ID once sent (null = not sent yet) */
  telegramMessageId: number | null;
  /** Accumulated text so far */
  accumulatedText: string;
  /** Timestamp of last edit (for throttling) */
  lastSentAt: number;
}

/** Shared mutable state between outbound and inbound modules */
export interface PluginState {
  /** Currently active/selected session ID for inbound commands */
  activeSessionId: string | null;
  /** Text buffers keyed by OpenCode messageID */
  textBuffers: Map<string, TextBufferEntry>;
  /** Permission resolvers keyed by permission ID */
  permissionResolvers: Map<string, (status: "allow" | "deny") => void>;
  /** Whether the polling loop is active */
  pollingActive: boolean;
  /** Reference to the polling timer (for cleanup) */
  pollingTimerId: ReturnType<typeof setTimeout> | null;
  /** Telegram getUpdates offset */
  updateOffset: number;
  /** Set of assistant message IDs already reported as complete (dedup) */
  reportedAssistantIds: Set<string>;
}

/** Callback data encoded in inline keyboard buttons */
export interface CallbackData {
  action: "allow" | "deny";
  permissionID: string;
}

/** Minimal Telegram message result from Bot API */
export interface TelegramMessageResult {
  ok: boolean;
  result?: {
    message_id: number;
    chat: { id: number };
    text?: string;
  };
  description?: string;
}

/** Minimal Telegram update from getUpdates */
export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    chat: { id: number };
    text?: string;
  };
  callback_query?: {
    id: string;
    from: { id: number };
    data?: string;
    message?: {
      message_id: number;
      chat: { id: number };
    };
  };
}
