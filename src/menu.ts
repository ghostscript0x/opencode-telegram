#!/usr/bin/env node

/**
 * OpenCode Telegram Plugin — Mirror sessions to Telegram
 * _______________________________________________________
 * Copyright (c) 2026 ghostscript0x
 * MIT License — see LICENSE file for full terms
 *
 * Interactive terminal menu — a colorful TUI for installing,
 * uninstalling, managing the plugin without stress.
 *
 * Usage: node dist/menu.js
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as readline from "node:readline";

// ── ANSI Colors ──
const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  italic: "\x1b[3m",

  black: "\x1b[30m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",

  bgBlack: "\x1b[40m",
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
  bgBlue: "\x1b[44m",
  bgMagenta: "\x1b[45m",
  bgCyan: "\x1b[46m",
  bgWhite: "\x1b[47m",

  // Bright variants
  brightBlack: "\x1b[90m",
  brightRed: "\x1b[91m",
  brightGreen: "\x1b[92m",
  brightYellow: "\x1b[93m",
  brightBlue: "\x1b[94m",
  brightMagenta: "\x1b[95m",
  brightCyan: "\x1b[96m",
  brightWhite: "\x1b[97m",
};

// ── Helpers ──

function clearScreen(): void {
  console.clear();
}

function printBanner(): void {
  const banner = `
${C.brightCyan}${C.bold}   ╔═══════════════════════════════════════════════╗
   ║        ${C.brightWhite}OPENCODE × TELEGRAM${C.brightCyan}             ║
   ║        ${C.brightWhite}Plugin Manager${C.brightCyan}                   ║
   ╚═══════════════════════════════════════════════╝${C.reset}
  `;
  console.log(banner);
}

function printSeparator(char = "─", length = 55): void {
  console.log(`${C.dim}${C.cyan}${char.repeat(length)}${C.reset}`);
}

function printInfo(label: string, value: string): void {
  console.log(`  ${C.cyan}${label}:${C.reset} ${value}`);
}

function printSuccess(msg: string): void {
  console.log(`  ${C.brightGreen}✅ ${msg}${C.reset}`);
}

function printError(msg: string): void {
  console.log(`  ${C.brightRed}❌ ${msg}${C.reset}`);
}

function printWarning(msg: string): void {
  console.log(`  ${C.brightYellow}⚠️  ${msg}${C.reset}`);
}

function printHighlight(msg: string): void {
  console.log(`  ${C.brightMagenta}${msg}${C.reset}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Readline — single shared interface ──

let _rl: readline.Interface | null = null;

function getReadline(): readline.Interface {
  if (!_rl) {
    _rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }
  return _rl;
}

function closeReadline(): void {
  if (_rl) {
    _rl.close();
    _rl = null;
  }
}

async function ask(query: string): Promise<string> {
  const rl = getReadline();
  return new Promise<string>((resolve) => {
    rl.question(query, (answer) => {
      resolve(answer.trim());
    });
  });
}

// ── Config paths (same as cli.ts) ──

function findOpencodeConfigDir(): string | null {
  const candidates: string[] = [];
  const home = os.homedir();
  candidates.push(path.join(home, ".config", "opencode"));
  if (process.env["APPDATA"]) candidates.push(path.join(process.env["APPDATA"], "opencode"));
  if (process.env["LOCALAPPDATA"]) candidates.push(path.join(process.env["LOCALAPPDATA"], "opencode"));
  if (process.env["XDG_CONFIG_HOME"]) candidates.push(path.join(process.env["XDG_CONFIG_HOME"], "opencode"));
  for (const dir of candidates) {
    try { if (fs.existsSync(dir)) return dir; } catch { continue; }
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

function readConfig(configPath: string): Record<string, unknown> {
  try {
    return JSON.parse(fs.readFileSync(configPath, "utf-8"));
  } catch {
    return {};
  }
}

function writeConfig(configPath: string, config: Record<string, unknown>): void {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

function readEnvFile(envPath: string): Map<string, string> {
  const env = new Map<string, string>();
  try {
    for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i === -1) continue;
      env.set(t.slice(0, i).trim(), t.slice(i + 1).trim());
    }
  } catch { /* ignore */ }
  return env;
}

function writeEnvFile(envPath: string, env: Map<string, string>): void {
  const lines: string[] = [];
  for (const [k, v] of env) lines.push(`${k}=${v}`);
  fs.writeFileSync(envPath, lines.join("\n") + "\n", "utf-8");
}

// ── Animations ──

async function showSpinner(ms: number, text: string): Promise<void> {
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  const start = Date.now();
  let i = 0;
  while (Date.now() - start < ms) {
    process.stdout.write(`\r  ${C.cyan}${frames[i % frames.length]}${C.reset} ${text}`);
    i++;
    await sleep(80);
  }
  process.stdout.write(`\r  ${C.green}✓${C.reset} ${text}          \n`);
}

async function showProgressBar(ms: number, text: string): Promise<void> {
  const steps = 20;
  for (let i = 0; i <= steps; i++) {
    const pct = Math.floor((i / steps) * 100);
    const filled = "█".repeat(i);
    const empty = "░".repeat(steps - i);
    process.stdout.write(
      `\r  ${C.cyan}${filled}${C.dim}${empty}${C.reset} ${pct}% ${text}`,
    );
    await sleep(ms / steps);
  }
  process.stdout.write(`\r  ${C.green}${"█".repeat(steps)}${C.reset} 100% ${text} ✅\n`);
}

// ── Actions ──

async function actionInstall(): Promise<void> {
  clearScreen();
  printBanner();
  printSeparator();
  console.log(`  ${C.bold}${C.brightGreen}   INSTALL PLUGIN${C.reset}`);
  printSeparator();
  console.log("");

  const paths = getConfigPaths();
  if (!paths) {
    printError("OpenCode config directory not found. Run OpenCode at least once first.");
    console.log("");
    await pressEnter();
    return;
  }

  printInfo("Config dir", paths.configDir);
  console.log("");

  // Token
  const token = await ask(`${C.brightYellow}🤖${C.reset} ${C.bold}Paste your Telegram Bot Token${C.reset} ${C.dim}(from @BotFather)${C.reset}:\n  > `);
  if (!token) {
    printError("Token is required. Installation cancelled.");
    console.log("");
    await pressEnter();
    return;
  }

  // Chat ID
  const chatId = await ask(
    `\n  ${C.brightYellow}👤${C.reset} ${C.bold}Enter your Telegram Chat ID${C.reset} ${C.dim}(optional, press Enter to skip)${C.reset}:\n  > `,
  );
  console.log("");

  // Spinner: writing .env
  await showSpinner(1200, "Writing configuration...");
  const env = readEnvFile(paths.envFile);
  env.set("TELEGRAM_BOT_TOKEN", token);
  if (chatId) env.set("TELEGRAM_CHAT_ID", chatId);
  writeEnvFile(paths.envFile, env);

  // Progress: updating opencode.json
  await showProgressBar(1500, "Registering plugin with OpenCode...");
  const config = readConfig(paths.configFile);
  const pluginPath = path.resolve(process.cwd(), "dist", "index.js").replace(/\\/g, "/");
  const pluginArr = (config.plugin as Array<string | [string, unknown]> | undefined) ?? [];
  if (pluginArr.length === 0) {
    config.plugin = [pluginPath];
  } else {
    pluginArr.push(pluginPath);
    config.plugin = pluginArr;
  }
  writeConfig(paths.configFile, config);

  // Success!
  console.log("");
  printSeparator("━");
  console.log(`  ${C.brightGreen}${C.bold}   🎉 INSTALLATION COMPLETE!${C.reset}`);
  printSeparator("━");
  console.log("");
  printSuccess("Plugin added to opencode.json");
  printSuccess("Telegram credentials saved to .env");
  console.log("");
  printHighlight(`  ${C.bold}Next step:${C.reset} Restart OpenCode`);
  console.log(`  ${C.dim}The plugin will activate automatically.${C.reset}`);
  console.log(`  ${C.dim}Send /menu to your bot on Telegram to start.${C.reset}`);
  console.log("");
  await pressEnter();
}

async function actionUninstall(): Promise<void> {
  clearScreen();
  printBanner();
  printSeparator();
  console.log(`  ${C.bold}${C.brightRed}   UNINSTALL PLUGIN${C.reset}`);
  printSeparator();
  console.log("");

  const paths = getConfigPaths();
  if (!paths) {
    printWarning("OpenCode config directory not found — nothing to uninstall.");
    console.log("");
    await pressEnter();
    return;
  }

  // Remove from opencode.json
  await showSpinner(800, "Removing plugin registration...");
  const config = readConfig(paths.configFile);
  const pluginPath = path.resolve(process.cwd(), "dist", "index.js").replace(/\\/g, "/");
  let removed = false;
  const pluginEntries = config.plugin as Array<string | [string, unknown]> | undefined;
  if (Array.isArray(pluginEntries)) {
    const before = pluginEntries.length;
    const filtered = pluginEntries.filter((entry) => {
      const p = typeof entry === "string" ? entry : entry[0];
      return p !== pluginPath;
    });
    if (filtered.length !== before) {
      if (filtered.length === 0) {
        delete config.plugin;
      } else {
        config.plugin = filtered;
      }
      writeConfig(paths.configFile, config);
      removed = true;
    }
  }

  if (removed) {
    printSuccess("Plugin removed from opencode.json");
  } else {
    printWarning("Plugin was not registered in opencode.json");
  }

  // Ask about .env
  console.log("");
  const removeEnv = await ask(
    `  ${C.brightYellow}🗑️${C.reset} Remove Telegram credentials from .env too? ${C.dim}[y/N]${C.reset}: `,
  );

  if (removeEnv.toLowerCase() === "y" || removeEnv.toLowerCase() === "yes") {
    await showSpinner(600, "Cleaning environment variables...");
    const env = readEnvFile(paths.envFile);
    env.delete("TELEGRAM_BOT_TOKEN");
    env.delete("TELEGRAM_CHAT_ID");
    writeEnvFile(paths.envFile, env);
    printSuccess("Telegram credentials removed from .env");
  } else {
    printInfo("Kept", ".env credentials");
  }

  console.log("");
  printSeparator("━");
  console.log(`  ${C.brightRed}${C.bold}   👋 DISCONNECTED${C.reset}`);
  printSeparator("━");
  console.log("");
  printHighlight(`  ${C.bold}Restart OpenCode${C.reset} to apply the changes.`);
  console.log("");
  await pressEnter();
}

async function actionStatus(): Promise<void> {
  clearScreen();
  printBanner();
  printSeparator();
  console.log(`  ${C.bold}${C.brightCyan}   STATUS${C.reset}`);
  printSeparator();
  console.log("");

  const paths = getConfigPaths();
  if (!paths) {
    printError("OpenCode config directory NOT FOUND");
    printWarning("Make sure OpenCode has been run at least once on this machine.");
    console.log("");
    await pressEnter();
    return;
  }

  printInfo("Config dir", paths.configDir);
  console.log("");

  // Check opencode.json
  const config = readConfig(paths.configFile);
  const pluginPath = path.resolve(process.cwd(), "dist", "index.js").replace(/\\/g, "/");
  let registered = false;
  const pluginEntries = config.plugin as Array<string | [string, unknown]> | undefined;
  if (Array.isArray(pluginEntries)) {
    for (const entry of pluginEntries) {
      const p = typeof entry === "string" ? entry : entry[0];
      if (p === pluginPath || p.includes("plugin-telegram") || p.includes("telegram")) {
        registered = true;
        break;
      }
    }
  }
  console.log(`  ${registered ? "✅" : "❌"} Plugin registered: ${registered ? C.green + "YES" : C.red + "NO"}${C.reset}`);

  // Check .env
  const env = readEnvFile(paths.envFile);
  const hasToken = env.has("TELEGRAM_BOT_TOKEN") && env.get("TELEGRAM_BOT_TOKEN")!.trim().length > 0;
  const hasChatId = env.has("TELEGRAM_CHAT_ID");
  console.log(`  ${hasToken ? "✅" : "❌"} Bot Token:       ${hasToken ? C.green + "Set" : C.red + "Missing"}${C.reset}`);
  console.log(`  ${hasChatId ? "✅" : "⬜"} Chat ID:         ${hasChatId ? C.green + env.get("TELEGRAM_CHAT_ID") : C.dim + "Not set (optional)"}${C.reset}`);

  // Check build
  const distIndex = path.resolve(process.cwd(), "dist", "index.js");
  const buildExists = fs.existsSync(distIndex);
  console.log(`  ${buildExists ? "✅" : "❌"} Plugin built:    ${buildExists ? C.green + "YES" : C.red + "NO (run 'npm run build')"}${C.reset}`);

  console.log("");
  printSeparator("━");

  const allGood = registered && hasToken && buildExists;
  if (allGood) {
    console.log(`  ${C.brightGreen}${C.bold}   🎉 EVERYTHING IS SET UP${C.reset}`);
    printHighlight(`  Restart OpenCode to use the plugin.`);
  } else {
    console.log(`  ${C.brightYellow}${C.bold}   ⚠️  NOT FULLY CONFIGURED${C.reset}`);
    console.log(`  ${C.dim}  Run "Install" from the menu to set up.${C.reset}`);
  }

  console.log("");
  await pressEnter();
}

async function actionExport(): Promise<void> {
  clearScreen();
  printBanner();
  printSeparator();
  console.log(`  ${C.bold}${C.brightMagenta}   EXPORT — Move to Another Computer${C.reset}`);
  printSeparator();
  console.log("");

  const paths = getConfigPaths();
  if (!paths) {
    printError("Config directory not found");
    await pressEnter();
    return;
  }

  const env = readEnvFile(paths.envFile);
  const token = env.get("TELEGRAM_BOT_TOKEN") || "";
  const chatId = env.get("TELEGRAM_CHAT_ID") || "";

  if (!token) {
    printWarning("No Telegram Bot Token configured on this machine.");
    console.log(`  ${C.dim}  Set one up first via the Install option.${C.reset}`);
    console.log("");
    await pressEnter();
    return;
  }

  const masked =
    token.length > 10
      ? token.slice(0, 6) + "…" + token.slice(-4)
      : "***";

  console.log(`  ${C.bold}${C.brightGreen}   📋 COPY INSTRUCTIONS${C.reset}`);
  console.log("");
  console.log(`  ${C.bold}Step 1:${C.reset} Copy the entire plugin folder to the new computer`);
  console.log(`  ${C.bold}Step 2:${C.reset} On the new computer, open terminal in that folder`);
  console.log(`  ${C.bold}Step 3:${C.reset} Run this command:\n`);
  console.log(`    ${C.brightYellow}node dist/cli.js install --token=${C.brightWhite}${token}${C.reset}${chatId ? ` \\\n    ${C.dim}--chat-id=${chatId}` : ""}`);
  console.log("");
  console.log(`  ${C.dim}  Token: ${masked}${C.reset}`);
  if (chatId) console.log(`  ${C.dim}  Chat ID: ${env.get("TELEGRAM_CHAT_ID")}${C.reset}`);
  console.log(`  ${C.bold}Step 4:${C.reset} Restart OpenCode`);
  console.log("");
  console.log(`  ${C.dim}  Alternatively, run the interactive menu on the new PC${C.reset}`);
  console.log(`  ${C.dim}  and choose "Install" — paste the token when asked.${C.reset}`);
  console.log("");
  await pressEnter();
}

async function actionAbout(): Promise<void> {
  clearScreen();
  printBanner();
  printSeparator();
  console.log(`  ${C.bold}${C.brightCyan}   ABOUT${C.reset}`);
  printSeparator();
  console.log("");
  console.log(`  ${C.bold}OpenCode Telegram Plugin${C.reset}`);
  console.log(`  ${C.dim}Mirror your OpenCode sessions to Telegram in real time${C.reset}`);
  console.log(`  ${C.dim}and control OpenCode remotely from your Telegram chat.${C.reset}`);
  console.log("");
  printSeparator("·");
  console.log("");
  console.log(`  ${C.bold}Features:${C.reset}`);
  console.log(`  ${C.green}•${C.reset} Real-time session mirroring to Telegram`);
  console.log(`  ${C.green}•${C.reset} Control OpenCode via Telegram messages`);
  console.log(`  ${C.green}•${C.reset} Inline keyboard buttons for quick commands`);
  console.log(`  ${C.green}•${C.reset} Permission Allow/Deny from Telegram`);
  console.log(`  ${C.green}•${C.reset} Multi-computer: install on any machine`);
  console.log("");
  printSeparator("·");
  console.log("");
  console.log(`  ${C.dim}Made with ❤️  for the OpenCode community${C.reset}`);
  console.log("");
  await pressEnter();
}

// ── Press Enter helper ──

async function pressEnter(): Promise<void> {
  await ask(`  ${C.dim}${C.cyan}Press Enter to continue...${C.reset} `);
}

// ── Main Menu ──

async function showMenu(): Promise<void> {
  for (;;) {
    clearScreen();
    printBanner();
    printSeparator();
    console.log(`  ${C.bold}${C.brightWhite}   MAIN MENU${C.reset}`);
    printSeparator();
    console.log("");

    const paths = getConfigPaths();
    const env = paths ? readEnvFile(paths.envFile) : new Map();
    const hasToken = env.has("TELEGRAM_BOT_TOKEN") && env.get("TELEGRAM_BOT_TOKEN")!.trim().length > 0;
    const config = paths ? readConfig(paths.configFile) : {};
    const pluginPath = path.resolve(process.cwd(), "dist", "index.js").replace(/\\/g, "/");
    let registered = false;
    const pluginEntries = config.plugin as Array<string | [string, unknown]> | undefined;
    if (Array.isArray(pluginEntries)) {
      for (const entry of pluginEntries) {
        const p = typeof entry === "string" ? entry : entry[0];
        if (p === pluginPath || p.includes("telegram")) { registered = true; break; }
      }
    }

    // Status bar
    const tokenStatus = hasToken ? `${C.green}●${C.reset}` : `${C.red}○${C.reset}`;
    const regStatus = registered ? `${C.green}●${C.reset}` : `${C.red}○${C.reset}`;
    console.log(`  ${tokenStatus} Token  ${regStatus} Plugin  |  ${C.dim}${paths?.configDir || "No config"}${C.reset}`);
    console.log("");

    // Menu options
    console.log(`  ${C.bold}${C.brightCyan}[1]${C.reset} ${C.bold}Install${C.reset}        ${C.dim}Setup the plugin on this machine${C.reset}`);
    console.log(`  ${C.bold}${C.brightRed}[2]${C.reset} ${C.bold}Uninstall${C.reset}      ${C.dim}Remove the plugin from this machine${C.reset}`);
    console.log(`  ${C.bold}${C.brightGreen}[3]${C.reset} ${C.bold}Status${C.reset}         ${C.dim}Check if everything is configured${C.reset}`);
    console.log(`  ${C.bold}${C.brightMagenta}[4]${C.reset} ${C.bold}Export${C.reset}         ${C.dim}Show config to move to another PC${C.reset}`);
    console.log(`  ${C.bold}${C.brightBlue}[5]${C.reset} ${C.bold}About${C.reset}          ${C.dim}About this plugin${C.reset}`);
    console.log(`  ${C.bold}${C.brightRed}[0]${C.reset} ${C.bold}Exit${C.reset}           ${C.dim}Close this menu${C.reset}`);
    console.log("");

    const choice = await ask(`  ${C.brightYellow}Choose an option${C.reset} ${C.dim}[0-5]${C.reset}: `);
    console.log("");

    switch (choice.trim()) {
      case "1":
        await actionInstall();
        break;
      case "2":
        await actionUninstall();
        break;
      case "3":
        await actionStatus();
        break;
      case "4":
        await actionExport();
        break;
      case "5":
        await actionAbout();
        break;
      case "0":
      case "q":
      case "exit":
        clearScreen();
        closeReadline();
        console.log(`\n  ${C.brightCyan}Thanks for using the OpenCode Telegram Plugin!${C.reset}\n`);
        return;
      default:
        printWarning("Invalid option. Press Enter to try again.");
        await pressEnter();
    }
  }
}

// ── Entry ──

async function main(): Promise<void> {
  // Check if we're in the right directory
  const distIndex = path.resolve(process.cwd(), "dist", "index.js");
  if (!fs.existsSync(distIndex)) {
    console.error(`\n  ${C.brightRed}❌ Plugin not found in this directory.${C.reset}`);
    console.error(`  ${C.dim}Make sure you're in the plugin folder and have run 'npm run build'.${C.reset}\n`);
    process.exit(1);
  }

  await showMenu();
}

main().catch((err) => {
  console.error(`\n  ${C.brightRed}❌ Error:${C.reset} ${err.message}\n`);
  process.exit(1);
});
