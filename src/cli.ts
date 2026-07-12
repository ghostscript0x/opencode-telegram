#!/usr/bin/env node

/**
 * OpenCode Telegram Plugin — Mirror sessions to Telegram
 * _______________________________________________________
 * Copyright (c) 2026 ghostscript0x
 * MIT License — see LICENSE file for full terms
 *
 * CLI for stress-free install/uninstall/status/export.
 *
 * Usage:
 *   node dist/cli.js install           Install/connect the plugin
 *   node dist/cli.js install --token=X Install non-interactive
 *   node dist/cli.js uninstall         Uninstall/disconnect
 *   node dist/cli.js status            Check installation
 *   node dist/cli.js export            Show config for another PC
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as readline from "node:readline";

// ── Config path helpers ──

function findOpencodeConfigDir(): string | null {
  const candidates: string[] = [];
  const home = os.homedir();

  // Linux/macOS: ~/.config/opencode
  candidates.push(path.join(home, ".config", "opencode"));

  // Windows: AppData/Roaming/opencode (common for npm global tools)
  if (process.env["APPDATA"]) {
    candidates.push(path.join(process.env["APPDATA"], "opencode"));
  }

  // Windows: AppData/Local/opencode
  if (process.env["LOCALAPPDATA"]) {
    candidates.push(path.join(process.env["LOCALAPPDATA"], "opencode"));
  }

  // Also check XDG_CONFIG_HOME
  if (process.env["XDG_CONFIG_HOME"]) {
    candidates.push(path.join(process.env["XDG_CONFIG_HOME"], "opencode"));
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

function getConfigPaths() {
  const configDir = findOpencodeConfigDir();
  if (!configDir) return null;
  return {
    configDir,
    configFile: path.join(configDir, "opencode.json"),
    envFile: path.join(configDir, ".env"),
  };
}

// ── Config file read/write ──

interface OpencodeConfig {
  plugin?: Array<string | [string, Record<string, unknown>]>;
  [key: string]: unknown;
}

function readConfig(configPath: string): OpencodeConfig {
  try {
    const content = fs.readFileSync(configPath, "utf-8");
    return JSON.parse(content) as OpencodeConfig;
  } catch {
    return {};
  }
}

function writeConfig(configPath: string, config: OpencodeConfig): void {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

function readEnvFile(envPath: string): Map<string, string> {
  const env = new Map<string, string>();
  try {
    const content = fs.readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      env.set(trimmed.slice(0, eqIdx).trim(), trimmed.slice(eqIdx + 1).trim());
    }
  } catch {
    // File doesn't exist yet
  }
  return env;
}

function writeEnvFile(envPath: string, env: Map<string, string>): void {
  const lines: string[] = [];
  for (const [key, value] of env) {
    lines.push(`${key}=${value}`);
  }
  fs.writeFileSync(envPath, lines.join("\n") + "\n", "utf-8");
}

// ── Interactive prompt ──

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// ── Commands ──

function parseArgs(): { token: string; chatId: string } {
  const args = process.argv.slice(3);
  const result = { token: "", chatId: "" };
  for (const arg of args) {
    if (arg.startsWith("--token=")) result.token = arg.slice(8);
    else if (arg.startsWith("--chat-id=")) result.chatId = arg.slice(10);
    else if (arg.startsWith("--chatId=")) result.chatId = arg.slice(9);
  }
  return result;
}

async function cmdInstall(): Promise<void> {
  const cliArgs = parseArgs();

  console.log("");
  console.log("╔══════════════════════════════════════════╗");
  console.log("║   OpenCode Telegram Plugin — Install    ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log("");

  const paths = getConfigPaths();
  if (!paths) {
    console.error("❌ Could not find OpenCode config directory.");
    console.error("   Make sure OpenCode has been run at least once on this machine.");
    process.exit(1);
  }

  console.log(`📁 OpenCode config directory: ${paths.configDir}`);
  console.log("");

  // ── Priority: CLI args > process.env > .env file > interactive prompt ──
  const env = readEnvFile(paths.envFile);
  let botToken = cliArgs.token
    || process.env["TELEGRAM_BOT_TOKEN"]
    || env.get("TELEGRAM_BOT_TOKEN")
    || "";
  let chatId = cliArgs.chatId
    || process.env["TELEGRAM_CHAT_ID"]
    || env.get("TELEGRAM_CHAT_ID")
    || "";

  // ── Bot Token ──
  if (!botToken && process.stdin.isTTY) {
    botToken = await ask("🤖 Enter your Telegram Bot Token (from @BotFather): ");
  }

  if (!botToken) {
    console.error("");
    console.error("❌ TELEGRAM_BOT_TOKEN is required.");
    console.error("   Provide it via:");
    console.error("     --token=XXX       CLI argument");
    console.error("     TELEGRAM_BOT_TOKEN env var");
    console.error("     add it to ~/.config/opencode/.env");
    console.error("");
    process.exit(1);
  }

  // ── Chat ID ──
  if (!chatId && process.stdin.isTTY) {
    chatId = await ask("👤 Enter your Telegram Chat ID (optional, press Enter to skip): ");
  }

  // ── Write .env ──
  env.set("TELEGRAM_BOT_TOKEN", botToken);
  if (chatId) env.set("TELEGRAM_CHAT_ID", chatId);
  writeEnvFile(paths.envFile, env);
  console.log("✅ .env file updated.");

  // ── Update opencode.json ──
  const config = readConfig(paths.configFile);
  const pluginPath = path.resolve(process.cwd(), "dist", "index.js");

  // Normalize to forward slashes for consistency
  const normalizedPath = pluginPath.replace(/\\/g, "/");

  // Check if already installed
  let alreadyInstalled = false;
  if (config.plugin) {
    for (const entry of config.plugin) {
      const entryPath = typeof entry === "string" ? entry : entry[0];
      if (entryPath === normalizedPath) {
        alreadyInstalled = true;
        break;
      }
    }
  }

  if (alreadyInstalled) {
    console.log("✅ Plugin already registered in opencode.json.");
  } else {
    if (!config.plugin) config.plugin = [];
    config.plugin.push(normalizedPath);
    writeConfig(paths.configFile, config);
    console.log(`✅ Plugin added to opencode.json:`);
    console.log(`   ${normalizedPath}`);
  }

  console.log("");
  console.log("🎉 Installation complete! Restart OpenCode to activate the plugin.");
  console.log(`   Then send /start to your bot on Telegram.`);
  console.log("");
}

async function cmdUninstall(): Promise<void> {
  console.log("");
  console.log("╔══════════════════════════════════════════╗");
  console.log("║  OpenCode Telegram Plugin — Uninstall   ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log("");

  const paths = getConfigPaths();
  if (!paths) {
    console.log("ℹ️  OpenCode config directory not found — nothing to uninstall.");
    return;
  }

  const config = readConfig(paths.configFile);
  const pluginPath = path.resolve(process.cwd(), "dist", "index.js").replace(/\\/g, "/");

  if (!config.plugin || config.plugin.length === 0) {
    console.log("ℹ️  No plugins registered in opencode.json.");
  } else {
    const before = config.plugin.length;
    config.plugin = config.plugin.filter((entry) => {
      const entryPath = typeof entry === "string" ? entry : entry[0];
      return entryPath !== pluginPath;
    });

    if (config.plugin.length === before) {
      console.log("ℹ️  Plugin not found in opencode.json.");
    } else {
      // Clean up empty array
      if (config.plugin.length === 0) delete config.plugin;
      writeConfig(paths.configFile, config);
      console.log("✅ Plugin removed from opencode.json.");
    }
  }

  // Ask about .env
  const env = readEnvFile(paths.envFile);
  if (env.has("TELEGRAM_BOT_TOKEN") || env.has("TELEGRAM_CHAT_ID")) {
    const answer = await ask("🗑️  Remove Telegram env vars from .env too? [y/N] ");
    if (answer.toLowerCase() === "y" || answer.toLowerCase() === "yes") {
      env.delete("TELEGRAM_BOT_TOKEN");
      env.delete("TELEGRAM_CHAT_ID");
      writeEnvFile(paths.envFile, env);
      console.log("✅ Telegram env vars removed from .env.");
    }
  }

  console.log("");
  console.log("👋 Plugin disconnected. Restart OpenCode to apply.");
  console.log("");
}

async function cmdStatus(): Promise<void> {
  console.log("");
  console.log("╔══════════════════════════════════════════╗");
  console.log("║  OpenCode Telegram Plugin — Status      ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log("");

  const paths = getConfigPaths();
  if (!paths) {
    console.log("❌ OpenCode config directory NOT FOUND.");
    console.log("   Make sure OpenCode has been run at least once.");
    process.exit(1);
  }

  console.log(`📁 Config directory: ${paths.configDir}`);
  console.log(`📄 Config file:     ${paths.configFile}`);
  console.log(`📄 Env file:        ${paths.envFile}`);
  console.log("");

  // Check opencode.json
  const config = readConfig(paths.configFile);
  const pluginPath = path.resolve(process.cwd(), "dist", "index.js").replace(/\\/g, "/");

  let registered = false;
  if (config.plugin) {
    for (const entry of config.plugin) {
      const entryPath = typeof entry === "string" ? entry : entry[0];
      if (entryPath === pluginPath) {
        registered = true;
        break;
      }
      // Also check if it contains our plugin name
      if (entryPath.includes("plugin-telegram") || entryPath.includes("telegram")) {
        registered = true;
        break;
      }
    }
  }

  console.log(`📋 Plugin in opencode.json: ${registered ? "✅ YES" : "❌ NO"}`);
  if (registered) {
    console.log(`   Path: ${pluginPath}`);
  }

  // Check .env
  const env = readEnvFile(paths.envFile);
  const hasToken = env.has("TELEGRAM_BOT_TOKEN") && env.get("TELEGRAM_BOT_TOKEN")!.trim().length > 0;
  const hasChatId = env.has("TELEGRAM_CHAT_ID");

  console.log(`🤖 TELEGRAM_BOT_TOKEN: ${hasToken ? "✅ Set" : "❌ Not set"}`);
  console.log(`👤 TELEGRAM_CHAT_ID:   ${hasChatId ? `✅ ${env.get("TELEGRAM_CHAT_ID")}` : "❌ Not set (optional)"}`);

  // Check build
  const distIndex = path.resolve(process.cwd(), "dist", "index.js");
  const buildExists = fs.existsSync(distIndex);
  console.log(`🔧 Plugin built:       ${buildExists ? "✅ YES" : "❌ NO (run 'npm run build')"}`);

  console.log("");
  if (registered && hasToken && buildExists) {
    console.log("🎉 All good! Restart OpenCode to use the plugin.");
  } else {
    console.log("⚠️  Run 'node dist/cli.js install' to set up.");
  }
  console.log("");
}

async function cmdExport(): Promise<void> {
  console.log("");
  console.log("╔══════════════════════════════════════════╗");
  console.log("║  OpenCode Telegram Plugin — Export      ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log("");

  const paths = getConfigPaths();
  if (!paths) {
    console.log("❌ OpenCode config directory not found.");
    process.exit(1);
  }

  const env = readEnvFile(paths.envFile);
  const botToken = env.get("TELEGRAM_BOT_TOKEN") || "";
  const chatId = env.get("TELEGRAM_CHAT_ID") || "";

  if (!botToken) {
    console.log("⚠️  No TELEGRAM_BOT_TOKEN configured on this machine.");
    console.log("   Run 'node dist/cli.js install' first.");
    process.exit(1);
  }

  const maskedToken = botToken.length > 10
    ? botToken.slice(0, 6) + "…" + botToken.slice(-4)
    : "***";

  console.log("📋 Copy these to your other computer:");
  console.log("");
  console.log("   Step 1: Copy the plugin folder to the other machine");
  console.log(`   Step 2: Run these commands:`);
  console.log("");
  console.log(`   node dist/cli.js install`);
  console.log("");
  console.log(`   When prompted, enter:`);
  console.log(`   🤖 Bot Token: ${maskedToken}`);
  if (chatId) console.log(`   👤 Chat ID:   ${chatId}`);
  console.log("");
  console.log("   Or set the env vars manually in ~/.config/opencode/.env:");
  console.log(`   TELEGRAM_BOT_TOKEN=${botToken}`);
  if (chatId) console.log(`   TELEGRAM_CHAT_ID=${chatId}`);
  console.log("");
}

// ── Main ──

async function main(): Promise<void> {
  const command = process.argv[2]?.toLowerCase();

  switch (command) {
    case "install":
      await cmdInstall();
      break;
    case "uninstall":
    case "remove":
    case "disconnect":
      await cmdUninstall();
      break;
    case "status":
      await cmdStatus();
      break;
    case "export":
      await cmdExport();
      break;
    default:
      console.log("");
      console.log("OpenCode Telegram Plugin CLI");
      console.log("");
      console.log("Usage:");
      console.log("  node dist/cli.js install                 - Install (interactive)");
      console.log("  node dist/cli.js install --token=XXX     - Install with token");
      console.log("  node dist/cli.js install --token=X --chat-id=Y  - Install with both");
      console.log("  node dist/cli.js uninstall               - Uninstall/disconnect");
      console.log("  node dist/cli.js status                  - Check installation");
      console.log("  node dist/cli.js export                  - Show config for export");
      console.log("");
      console.log("  You can also set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID as");
      console.log("  environment variables instead of using -- flags.");
      console.log("");
  }
}

main().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
