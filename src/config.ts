/**
 * OpenCode Telegram Plugin — Mirror sessions to Telegram
 * _______________________________________________________
 * Copyright (c) 2026 ghostscript0x
 * MIT License — see LICENSE file for full terms
 *
 * Reads and validates Telegram environment variables.
 * Fails LOUDLY if TELEGRAM_BOT_TOKEN is missing. Does not silently no-op.
 *
 * Reads from process.env first, then falls back to the OpenCode config
 * directory's .env file (where users typically store secrets).
 */
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

export interface PluginConfig {
  /** Telegram Bot API token (required) */
  botToken: string;
  /** Allowed Telegram chat/user ID (optional — if set, filters polling) */
  chatId: string | null;
}

/**
 * Read config from environment variables, with fallback to the
 * OpenCode config .env file.
 * Throws immediately if TELEGRAM_BOT_TOKEN is missing.
 */
export function loadConfig(): PluginConfig {
  // 1. Try process.env first
  let botToken = process.env["TELEGRAM_BOT_TOKEN"];
  let chatId = process.env["TELEGRAM_CHAT_ID"] ?? null;

  // 2. Fallback: try to load from opencode config .env
  if (!botToken || botToken.trim() === "") {
    const loaded = tryLoadDotenv();
    if (loaded) {
      botToken = loaded.TELEGRAM_BOT_TOKEN ?? botToken;
      if (!chatId) chatId = loaded.TELEGRAM_CHAT_ID ?? null;
    }
  }

  if (!botToken || botToken.trim() === "") {
    throw new Error(
      "╔══════════════════════════════════════════════════════════╗\n" +
      "║  TELEGRAM_BOT_TOKEN environment variable is not set!   ║\n" +
      "║                                                        ║\n" +
      "║  This plugin requires a Telegram Bot API token.        ║\n" +
      "║                                                        ║\n" +
      "║  Set it in your shell before running opencode:         ║\n" +
      "║    export TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl  ║\n" +
      "║                                                        ║\n" +
      "║  Or add it to ~/.config/opencode/.env:                 ║\n" +
      "║    TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl         ║\n" +
      "║    TELEGRAM_CHAT_ID=123456789                         ║\n" +
      "╚══════════════════════════════════════════════════════════╝"
    );
  }

  return { botToken: botToken.trim(), chatId };
}

/**
 * Try to load TELEGRAM_* vars from the OpenCode config .env file.
 * Returns null if the file doesn't exist or can't be read.
 */
function tryLoadDotenv(): { TELEGRAM_BOT_TOKEN?: string; TELEGRAM_CHAT_ID?: string } | null {
  const configDir = getOpencodeConfigDir();
  if (!configDir) return null;

  const envPath = path.join(configDir, ".env");
  try {
    if (!fs.existsSync(envPath)) return null;
    const content = fs.readFileSync(envPath, "utf-8");
    const result: Record<string, string> = {};
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim();
      // Only pick up TELEGRAM_ vars
      if (key === "TELEGRAM_BOT_TOKEN" || key === "TELEGRAM_CHAT_ID") {
        result[key] = value;
      }
    }
    return result.TELEGRAM_BOT_TOKEN
      ? result as { TELEGRAM_BOT_TOKEN: string; TELEGRAM_CHAT_ID?: string }
      : null;
  } catch {
    return null;
  }
}

/**
 * Find the OpenCode config directory.
 * Checks common locations for the platform.
 */
function getOpencodeConfigDir(): string | null {
  const candidates: string[] = [];

  // Linux/macOS: ~/.config/opencode
  // Windows: uses same convention in Git Bash/MSYS2
  const home = os.homedir();
  candidates.push(path.join(home, ".config", "opencode"));

  // Windows: AppData/Roaming/opencode
  if (process.env["APPDATA"]) {
    candidates.push(path.join(process.env["APPDATA"], "opencode"));
  }

  // Windows: AppData/Local/opencode
  if (process.env["LOCALAPPDATA"]) {
    candidates.push(path.join(process.env["LOCALAPPDATA"], "opencode"));
  }

  for (const dir of candidates) {
    try {
      if (fs.existsSync(dir)) return dir;
    } catch {
      continue;
    }
  }

  return null;
}
