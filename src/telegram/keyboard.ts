/**
 * OpenCode Telegram Plugin — Mirror sessions to Telegram
 * _______________________________________________________
 * Copyright (c) 2026 ghostscript0x
 * MIT License — see LICENSE file for full terms
 *
 * Inline keyboard markup builders.
 *
 * Two types of buttons:
 * 1. Permission Allow/Deny — callback prefix "p:"
 * 2. TUI Commands — callback prefix "cmd:"
 */

// ── Permission buttons ──

const CALLBACK_PREFIX_ALLOW = "p:allow:";
const CALLBACK_PREFIX_DENY = "p:deny:";

/**
 * Build an inline keyboard with Allow/Deny buttons for a permission.
 */
export function buildPermissionKeyboard(
  permissionID: string,
): Record<string, unknown> {
  return {
    inline_keyboard: [
      [
        {
          text: "✅ Allow",
          callback_data: `${CALLBACK_PREFIX_ALLOW}${permissionID}`,
        },
        {
          text: "❌ Deny",
          callback_data: `${CALLBACK_PREFIX_DENY}${permissionID}`,
        },
      ],
    ],
  };
}

/**
 * Parse a permission callback data string.
 * Returns null if the data doesn't match the expected format.
 */
export function parsePermissionCallback(
  data: string,
): { action: "allow" | "deny"; permissionID: string } | null {
  if (data.startsWith(CALLBACK_PREFIX_ALLOW)) {
    return {
      action: "allow",
      permissionID: data.slice(CALLBACK_PREFIX_ALLOW.length),
    };
  }
  if (data.startsWith(CALLBACK_PREFIX_DENY)) {
    return {
      action: "deny",
      permissionID: data.slice(CALLBACK_PREFIX_DENY.length),
    };
  }
  return null;
}

// ── Command buttons ──

const CALLBACK_PREFIX_CMD = "cmd:";

/** Available command button definitions */
export interface CommandButton {
  label: string;
  command: string; // e.g. "/status", "/fork", "/compact"
  args?: string;
}

/**
 * Build a full command menu inline keyboard.
 * Shows all available TUI commands as tap buttons.
 */
export function buildCommandKeyboard(): Record<string, unknown> {
  return {
    inline_keyboard: [
      // Row 1: Status & Sessions
      [
        { text: "📋 Status", callback_data: `${CALLBACK_PREFIX_CMD}/status` },
        { text: "📂 Sessions", callback_data: `${CALLBACK_PREFIX_CMD}/sessions` },
      ],
      // Row 2: Fork & Compact
      [
        { text: "🔄 Fork", callback_data: `${CALLBACK_PREFIX_CMD}/fork` },
        { text: "🗜️ Compact", callback_data: `${CALLBACK_PREFIX_CMD}/compact` },
      ],
      // Row 3: Abort & Interrupt
      [
        { text: "⏹️ Abort", callback_data: `${CALLBACK_PREFIX_CMD}/abort` },
        { text: "⏸️ Interrupt", callback_data: `${CALLBACK_PREFIX_CMD}/interrupt` },
      ],
      // Row 4: New Session & Help
      [
        { text: "🆕 New", callback_data: `${CALLBACK_PREFIX_CMD}/new` },
        { text: "❓ Help", callback_data: `${CALLBACK_PREFIX_CMD}/help` },
      ],
    ],
  };
}

/**
 * Build a mini inline keyboard with the most common actions.
 * Attached to the bottom of reply messages.
 */
export function buildMiniKeyboard(): Record<string, unknown> {
  return {
    inline_keyboard: [
      [
        { text: "📋 Status", callback_data: `${CALLBACK_PREFIX_CMD}/status` },
        { text: "🔄 Fork", callback_data: `${CALLBACK_PREFIX_CMD}/fork` },
        { text: "🗜️ Compact", callback_data: `${CALLBACK_PREFIX_CMD}/compact` },
      ],
      [
        { text: "📂 Sessions", callback_data: `${CALLBACK_PREFIX_CMD}/sessions` },
        { text: "⏹️ Abort", callback_data: `${CALLBACK_PREFIX_CMD}/abort` },
        { text: "📋 Menu", callback_data: `${CALLBACK_PREFIX_CMD}/menu` },
      ],
    ],
  };
}

/**
 * Parse a command callback data string.
 * Returns the command string (e.g. "/status") or null.
 */
export function parseCommandCallback(
  data: string,
): string | null {
  if (!data.startsWith(CALLBACK_PREFIX_CMD)) return null;
  return data.slice(CALLBACK_PREFIX_CMD.length);
}

/**
 * Universal callback parser — tries permission first, then command.
 */
export function parseCallbackData(
  data: string,
): { type: "permission"; action: "allow" | "deny"; permissionID: string } |
   { type: "command"; command: string } |
   null {
  // Try permission
  const perm = parsePermissionCallback(data);
  if (perm) return { type: "permission", ...perm };

  // Try command
  const cmd = parseCommandCallback(data);
  if (cmd) return { type: "command", command: cmd };

  return null;
}
