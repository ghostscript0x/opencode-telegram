# OpenCode × Telegram Plugin

**Mirror your OpenCode sessions to Telegram — and control OpenCode remotely from your chat.**

<p align="center">
  <img src="https://img.shields.io/badge/node-%3E%3D18.0.0-339933?logo=node.js&style=flat" alt="Node >=18"/>
  <img src="https://img.shields.io/badge/license-MIT-blue?style=flat" alt="MIT License"/>
  <img src="https://img.shields.io/badge/maintained-2026-brightgreen?style=flat" alt="Maintained 2026"/>
  <img src="https://img.shields.io/badge/telegram-2CA5E0?logo=telegram&style=flat" alt="Telegram"/>
  <img src="https://img.shields.io/badge/opencode-v1.17.18-8B5CF6?style=flat" alt="OpenCode"/>
</p>

---

## Features

| Feature | Description |
|---------|-------------|
| **Real-time mirror** | Every message your AI assistant sends appears in Telegram as it streams |
| **Text streaming** | Messages update live — like watching the assistant type |
| **Commands via chat** | `/fork`, `/compact`, `/abort`, `/interrupt`, `/help` — right from Telegram |
| **Prompt from chat** | Just type a message — it gets sent as a prompt to your active session |
| **Permission buttons** | Allow/Deny tool requests with a single tap |
| **Multi-PC** | Install on any machine, control from the same Telegram chat |
| **Interactive setup** | Double-click `setup-telegram.cmd` — no terminal skills needed |

---

## Quick Start

### 1. Get a Bot Token

Open Telegram, message [@BotFather](https://t.me/BotFather), and run:

```
/newbot
```

Follow the prompts. You'll get a token like:
```
1234567890:ABC-DEF1234ghIkl-zyxW7v_s0P
```

### 2. Get your Chat ID

Message [@userinfobot](https://t.me/userinfobot) on Telegram — it will reply with your numerical `Id`.

### 3. Install the Plugin

#### Option A — Double-click (Windows)

Just double-click **`setup-telegram.cmd`**. It will:
1. Check Node.js is installed
2. Auto-install dependencies on first run
3. Auto-build the plugin
4. Launch the interactive menu

Pick **Install** from the menu, paste your bot token, and done.

#### Option B — Terminal (any OS)

```bash
# Install dependencies (first time)
npm install
npm run build

# Launch the interactive menu
npm run menu

# Or use the CLI directly:
node dist/cli.js install --token=1234567890:ABC-DEF1234ghIkl-zyxW7v_s0P --chat-id=123456789
```

### 4. Restart OpenCode

Close and reopen OpenCode. The plugin loads automatically. Send `/start` to your bot on Telegram — you should see a welcome message.

---

## The Interactive Menu

```
╔═══════════════════════════════════════════════╗
║        OPENCODE × TELEGRAM                    ║
║        Plugin Manager                         ║
╚═══════════════════════════════════════════════╝

● Token  ● Plugin  |  C:\Users\...\.config\opencode

[1] Install         Setup the plugin on this machine
[2] Uninstall       Remove the plugin from this machine
[3] Status          Check if everything is configured
[4] Export          Show config to move to another PC
[5] About           About this plugin
[0] Exit            Close this menu
```

Launch it with:
```bash
npm run menu          # or
node dist/menu.js     # or
setup-telegram.cmd    # Windows double-click
```

---

## CLI Reference

```bash
node dist/cli.js install                     # Interactive setup
node dist/cli.js install --token=XXX         # Non-interactive
node dist/cli.js install --token=X --chat-id=Y  # Full non-interactive
node dist/cli.js uninstall                   # Remove the plugin
node dist/cli.js status                      # Check installation
node dist/cli.js export                      # Copy config to another PC
```

Environment variables can replace flags:
```bash
TELEGRAM_BOT_TOKEN=XXX TELEGRAM_CHAT_ID=YYY node dist/cli.js install
```

---

## Telegram Commands

| Command | Action |
|---------|--------|
| `/start` | Welcome message and connection test |
| `/menu` | Show inline keyboard with all commands |
| `/status` | Show active session info |
| `/sessions` | List all sessions |
| `/use <id>` | Switch to a specific session |
| `/new <prompt>` | Create a new session with a prompt |
| `/fork` | Fork the current session |
| `/compact` | Compact the current session |
| `/abort` | Abort the current generation |
| `/interrupt` | Interrupt the current generation |
| `/help` | Show this command list |
| *any text* | Send as a prompt to the active session |

---

## Moving to Another Computer

```bash
# Copy the plugin folder to the new machine, then:
node dist/cli.js install --token=YOUR_TOKEN --chat-id=YOUR_CHAT_ID
```

Or just copy the whole folder and run `setup-telegram.cmd` — the interactive menu will walk you through it.

---

## Files

```
plugin/
├── src/
│   ├── index.ts              # Plugin entry point
│   ├── config.ts             # Env var loading + validation
│   ├── types.ts              # TypeScript types
│   ├── state.ts              # Plugin state factory
│   ├── cli.ts                # CLI tool (install/uninstall/status)
│   ├── menu.ts               # Interactive terminal menu
│   ├── telegram/
│   │   ├── client.ts         # Telegram Bot API wrappers
│   │   └── keyboard.ts       # Inline keyboard builders
│   ├── inbound/
│   │   ├── index.ts          # Polling + message router
│   │   └── commands.ts       # Command handlers
│   └── outbound/
│       ├── index.ts          # Event dispatcher
│       ├── text-stream.ts    # Text streaming handler
│       └── notices.ts        # One-line event notices
├── dist/                     # Built output
├── setup-telegram.cmd        # Windows one-click launcher
├── package.json
├── tsconfig.json
├── LICENSE
└── README.md
```

---

## License

MIT License — see [LICENSE](LICENSE) for full terms.

Copyright (c) 2026 [ghostscript0x](https://github.com/ghostscript0x)

---

<p align="center">
  Built for the <a href="https://github.com/opencode-ai">OpenCode</a> ecosystem.
</p>
