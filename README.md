# FAAH! Sound — AI Reply, Error & Terminal Alerts

The **first VS Code sound extension that goes beyond errors.** Get notified when Claude CLI replies, asks for permission, or when anything fails in your terminal.

> Other extensions only play sounds on errors. This one alerts you when your AI is done thinking too.

## Features

- **AI / LLM Reply Detection** — hear a sound when Claude CLI, Copilot Chat, or any terminal LLM responds
- **Permission Prompt Detection** — hear a sound when Claude CLI asks to run a tool (Allow / Deny)
- **Terminal Error Detection** — classic FAAH on `exit 1`, `npm ERR!`, `FAILED`, etc.
- **Task Failure Detection** — sounds when VS Code tasks exit with errors
- **Diagnostic Error Detection** — sounds on TypeScript / JavaScript compile errors
- **Per-category toggles** — enable only the alerts you want
- **Separate cooldowns** — no overlapping sound spam
- **Volume control** — 0-100 range
- **Custom sound files** — swap in your own sounds per category
- **Status bar toggle** — one-click mute/unmute
- **One-click setup** — auto-configures everything for you

## Getting Started

### Step 1: Install the extension

Install from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=khavjhav.faah-ai-reply-error-terminal-sound) or search "FAAH" in VS Code Extensions.

### Step 2: Enable Claude Reply Detection

After installing, you'll see a **"FAAH: Enable AI detection"** button in the status bar (bottom right).

**Click it → "Enable & Restart"** — that's it! The extension automatically:
1. Updates your VS Code runtime config (`argv.json`)
2. Restarts VS Code
3. Full AI reply detection is now active

> **What does this do?** It adds one line to VS Code's `argv.json` to enable terminal output reading. This is a standard VS Code setting — safe, reversible, and only affects this extension.

### Manual Setup (if auto-setup doesn't work)

1. Open Command Palette: `Ctrl+Shift+P`
2. Type: **"Preferences: Configure Runtime Arguments"**
3. Add this line inside the JSON (before the closing `}`):

```json
"enable-proposed-api": ["khavjhav.faah-ai-reply-error-terminal-sound"]
```

4. Save the file and restart VS Code

### Step 3: Test it

Open a terminal and try:

```bash
exit 1
```

Or use Command Palette → **"FAAAAH Claude: Test Error Sound"**

With Claude CLI:
```bash
claude "hello"    # reply sound when Claude responds
```

## Sound Files

Ships with `fahhhhh.mp3` as the **default sound for all events** — works out of the box, zero config.

Want different sounds per category? Drop these into the extension's `media/` folder:

| File | Used for | Fallback |
|------|----------|----------|
| `error.mp3` | Terminal errors, task failures, diagnostics | `fahhhhh.mp3` |
| `reply.mp3` | AI / LLM replies | `fahhhhh.mp3` |
| `permission.mp3` | Permission prompts | `fahhhhh.mp3` |

Any missing file automatically falls back to `fahhhhh.mp3`.

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `faahClaude.enable` | `true` | Master on/off |
| `faahClaude.enableClaudeReply` | `true` | Sound on AI / LLM replies |
| `faahClaude.enablePermissionPrompt` | `true` | Sound on permission prompts |
| `faahClaude.enableTerminalErrors` | `true` | Sound on terminal errors |
| `faahClaude.enableTaskFailures` | `true` | Sound on task failures |
| `faahClaude.enableDiagnosticErrors` | `true` | Sound on compile errors |
| `faahClaude.cooldown` | `2000` | Error sound cooldown (ms) |
| `faahClaude.cooldownClaudeReply` | `3000` | Reply sound cooldown (ms) |
| `faahClaude.cooldownPermission` | `1000` | Permission sound cooldown (ms) |
| `faahClaude.volume` | `100` | Volume (0-100) |
| `faahClaude.claudeReplyPatterns` | `[]` | Extra regex patterns for reply detection |
| `faahClaude.permissionPatterns` | `[]` | Extra regex patterns for permission detection |

## Commands

Open Command Palette (`Ctrl+Shift+P`) and search:

- **FAAAAH Claude: Toggle Sounds On/Off**
- **FAAAAH Claude: Test Error Sound**
- **FAAAAH Claude: Test Reply Sound**
- **FAAAAH Claude: Test Permission Sound**
- **FAAH!: Enable Claude Reply Detection** (one-time setup)

## How Detection Works

Terminal output is buffered (300ms window), ANSI codes are stripped, then matched:

- **Permission prompts**: `Allow once/always`, `(Y/n)`, `Run this command?`, `Approve/Deny`
- **AI replies**: response markers, phrasing patterns (`I'll`, `Let me`, `Here's`), prompt returns
- **Errors**: `exit code N`, `ERR!`, `FAILED`, `Error:`, `fatal:`

Priority: permission > reply > error (one sound per buffer flush).

## What Works Without Setup vs With Setup

| Feature | Without setup | After one-click setup |
|---------|:---:|:---:|
| Test commands | Yes | Yes |
| Terminal error exit codes | Yes | Yes |
| Task failure detection | Yes | Yes |
| Diagnostic/compile errors | Yes | Yes |
| **Claude CLI reply detection** | No | **Yes** |
| **Permission prompt detection** | No | **Yes** |
| **Any terminal output matching** | No | **Yes** |

## Requirements

- VS Code 1.75.0+
- On Linux: `mpg123` (`sudo apt install mpg123`)

## License

MIT
