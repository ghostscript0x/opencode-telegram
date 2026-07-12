/**
 * OpenCode Telegram Plugin — Mirror sessions to Telegram
 * _______________________________________________________
 * Copyright (c) 2026 ghostscript0x
 * MIT License — see LICENSE file for full terms
 *
 * State factory — creates a clean PluginState object.
 */
import type { PluginState } from "./types.js";

export function createState(): PluginState {
  return {
    activeSessionId: null,
    textBuffers: new Map(),
    permissionResolvers: new Map(),
    pollingActive: false,
    pollingTimerId: null,
    updateOffset: 0,
    reportedAssistantIds: new Set(),
  };
}
