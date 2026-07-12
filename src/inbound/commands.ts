/**
 * OpenCode Telegram Plugin — Mirror sessions to Telegram
 * _______________________________________________________
 * Copyright (c) 2026 ghostscript0x
 * MIT License — see LICENSE file for full terms
 *
 * Command handlers for inbound Telegram messages.
 * Each handler returns a reply text string.
 */
import type { OpencodeClient } from "@opencode-ai/sdk/client";
import type { PluginState } from "../types.js";

/**
 * Handle `/status` — show current active session.
 */
export async function handleStatus(
  state: PluginState,
  _client: OpencodeClient,
): Promise<string> {
  if (state.activeSessionId) {
    return `🟢 Active session: <code>${escapeHtml(state.activeSessionId)}</code>`;
  }
  return "🟡 No active session. Use <code>/use &lt;id&gt;</code> to select one, or wait for a session to be created automatically.";
}

/**
 * Handle `/sessions` — list all sessions.
 */
export async function handleSessions(
  _state: PluginState,
  client: OpencodeClient,
): Promise<string> {
  try {
    const res = await client.session.list();
    if (!res.data || res.data.length === 0) {
      return "📭 No sessions found.";
    }

    const lines = res.data.slice(0, 10).map((s) => {
      const id = s.id.slice(0, 8);
      const title = s.title
        ? s.title.length > 40
          ? s.title.slice(0, 40) + "…"
          : s.title
        : "untitled";
      return `• <code>${escapeHtml(id)}</code> — ${escapeHtml(title)}`;
    });

    const total = res.data.length;
    const more = total > 10 ? `\n\n… and ${total - 10} more` : "";
    return `📋 <b>Sessions (${total})</b>\n${lines.join("\n")}${more}`;
  } catch (err) {
    return `❌ Failed to list sessions: ${escapeHtml(sanitizeError(err))}`;
  }
}

/**
 * Handle `/use <id>` — set the active session.
 */
export async function handleUse(
  args: string,
  state: PluginState,
  client: OpencodeClient,
): Promise<string> {
  const sessionId = args.trim();
  if (!sessionId) {
    return "⚠️ Usage: <code>/use &lt;session-id&gt;</code>";
  }

  try {
    // Verify the session exists
    const res = await client.session.get({ path: { id: sessionId } });
    if (res.data) {
      state.activeSessionId = sessionId;
      const title = res.data.title || "untitled";
      return `✅ Switched to session <code>${escapeHtml(sessionId)}</code> (${escapeHtml(title)})`;
    }
    return `❌ Session <code>${escapeHtml(sessionId)}</code> not found.`;
  } catch (err) {
    return `❌ Session <code>${escapeHtml(args.trim())}</code> not found.`;
  }
}

/**
 * Handle `/new <prompt>` — create a new session and send a prompt.
 * Submits through the TUI so it shows up visually in both TUI and Telegram.
 */
export async function handleNew(
  args: string,
  state: PluginState,
  client: OpencodeClient,
): Promise<string> {
  const prompt = args.trim();
  if (!prompt) {
    return "⚠️ Usage: <code>/new &lt;your-prompt&gt;</code>";
  }

  try {
    // Submit through the TUI — this creates a session, shows the prompt,
    // and displays the response, all in both TUI and Telegram
    await client.tui.clearPrompt({});
    await client.tui.appendPrompt({ body: { text: prompt } });
    await client.tui.submitPrompt({});

    return `🆕 New prompt submitted in TUI: ${escapeHtml(prompt.slice(0, 200))}`;
  } catch (err) {
    // Fallback: use API directly
    try {
      const createRes = await client.session.create({});
      if (!createRes.data) {
        return "❌ Failed to create session.";
      }
      const sessionId = createRes.data.id;
      state.activeSessionId = sessionId;
      await client.session.prompt({
        path: { id: sessionId },
        body: { parts: [{ type: "text", text: prompt }] },
      });
      return `🆕 Session created: <code>${escapeHtml(sessionId)}</code>\n💬 Prompt sent via API fallback.`;
    } catch (fallbackErr) {
      return `❌ Error: ${escapeHtml(sanitizeError(fallbackErr))}`;
    }
  }
}

/**
 * Handle `/fork [sessionId]` — fork the current or specified session.
 */
export async function handleFork(
  args: string,
  state: PluginState,
  client: OpencodeClient,
): Promise<string> {
  const sessionId = args.trim() || state.activeSessionId;
  if (!sessionId) {
    return "⚠️ No active session to fork. Use <code>/fork &lt;session-id&gt;</code> or <code>/use &lt;id&gt;</code> first.";
  }

  try {
    const res = await client.session.fork({ path: { id: sessionId } });
    if (res.data) {
      state.activeSessionId = res.data.id;
      const title = res.data.title || "untitled";
      return `🔄 Forked session <code>${escapeHtml(sessionId.slice(0, 8))}</code>\n🆕 New session: <code>${escapeHtml(res.data.id)}</code> (${escapeHtml(title)})`;
    }
    return `❌ Failed to fork session.`;
  } catch (err) {
    return `❌ Error forking session: ${escapeHtml(sanitizeError(err))}`;
  }
}

/**
 * Handle `/compact` — compact the current session via TUI command.
 */
export async function handleCompact(
  state: PluginState,
  client: OpencodeClient,
): Promise<string> {
  if (!state.activeSessionId) {
    return "⚠️ No active session to compact.";
  }

  try {
    await client.tui.executeCommand({ body: { command: "session.compact" } });
    return `🗜️ Compacting session <code>${escapeHtml(state.activeSessionId.slice(0, 8))}</code>...`;
  } catch (err) {
    return `❌ Failed to compact: ${escapeHtml(sanitizeError(err))}`;
  }
}

/**
 * Handle `/abort [sessionId]` — abort the current or specified session.
 */
export async function handleAbort(
  args: string,
  state: PluginState,
  client: OpencodeClient,
): Promise<string> {
  const sessionId = args.trim() || state.activeSessionId;
  if (!sessionId) {
    return "⚠️ No active session to abort.";
  }

  try {
    await client.session.abort({ path: { id: sessionId } });
    // Don't clear activeSessionId — session still exists
    return `⏹️ Aborted session <code>${escapeHtml(sessionId.slice(0, 8))}</code>`;
  } catch (err) {
    return `❌ Failed to abort: ${escapeHtml(sanitizeError(err))}`;
  }
}

/**
 * Handle `/interrupt` — interrupt the current session via TUI command.
 */
export async function handleInterrupt(
  _state: PluginState,
  client: OpencodeClient,
): Promise<string> {
  try {
    await client.tui.executeCommand({ body: { command: "session.interrupt" } });
    return `⏸️ Interrupted.`;
  } catch (err) {
    return `❌ Failed to interrupt: ${escapeHtml(sanitizeError(err))}`;
  }
}

/**
 * Handle `/help` — show all available commands.
 */
export async function handleHelp(): Promise<string> {
  return `🤖 <b>OpenCode Telegram Bot Commands</b>\n\n` +
    `<code>/status</code> — show current session\n` +
    `<code>/sessions</code> — list all sessions\n` +
    `<code>/use &lt;id&gt;</code> — switch to a session\n` +
    `<code>/new &lt;prompt&gt;</code> — new session with prompt\n` +
    `<code>/fork [id]</code> — fork current or specified session\n` +
    `<code>/compact</code> — compact current session\n` +
    `<code>/abort [id]</code> — abort current or specified session\n` +
    `<code>/interrupt</code> — interrupt current session\n` +
    `<code>/menu</code> — show command keyboard\n` +
    `<code>/help</code> — show this help`;
}

/**
 * Handle `/menu` — returns a marker that the callback handler sends the keyboard for.
 * When called from a callback, the keyboard is sent automatically.
 * When typed, we just show the help text.
 */
export async function handleMenu(): Promise<string> {
  return `📋 Tap a button below or type a command.`;
}

/**
 * Safely extract a user-friendly error message without leaking internals.
 */
function sanitizeError(err: unknown): string {
  if (err instanceof Error) {
    // Only take the first line of the message to avoid stack traces
    const firstLine = err.message.split("\n")[0] ?? "";
    // Limit to 200 chars
    return firstLine.length > 200 ? firstLine.slice(0, 200) + "…" : firstLine;
  }
  return "An unexpected error occurred";
}

/**
 * Parse and route a command string.
 */
export async function handleCommand(
  text: string,
  state: PluginState,
  client: OpencodeClient,
): Promise<string> {
  const trimmed = text.trim();

  if (trimmed === "/status") {
    return handleStatus(state, client);
  }

  if (trimmed === "/sessions") {
    return handleSessions(state, client);
  }

  if (trimmed.startsWith("/use ")) {
    return handleUse(trimmed.slice(5), state, client);
  }

  if (trimmed.startsWith("/new ")) {
    return handleNew(trimmed.slice(5), state, client);
  }

  if (trimmed === "/fork" || trimmed.startsWith("/fork ")) {
    return handleFork(trimmed === "/fork" ? "" : trimmed.slice(6), state, client);
  }

  if (trimmed === "/compact") {
    return handleCompact(state, client);
  }

  if (trimmed === "/abort" || trimmed.startsWith("/abort ")) {
    return handleAbort(trimmed === "/abort" ? "" : trimmed.slice(7), state, client);
  }

  if (trimmed === "/interrupt") {
    return handleInterrupt(state, client);
  }

  if (trimmed === "/help") {
    return handleHelp();
  }

  if (trimmed === "/menu") {
    return handleMenu();
  }

  // Unknown command
  return `❓ Unknown command. Use <code>/help</code> to see all commands.`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
