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

## Sound Files

Ships with `fahhhhh.mp3` as the **default sound for all events** — works out of the box, zero config.

Want different sounds per category? Drop these into the `media/` folder:

| File | Used for | Fallback |
|------|----------|----------|
| `error.mp3` | Terminal errors, task failures, diagnostics | `fahhhhh.mp3` |
| `reply.mp3` | AI / LLM replies | `fahhhhh.mp3` |
| `permission.mp3` | Permission prompts | `fahhhhh.mp3` |

Any missing file automatically falls back to `fahhhhh.mp3`.

## Quick Test

After installing, open a terminal and try:

```bash
# Test error detection
exit 1

# Test with Claude CLI (if installed)
claude "hello"    # reply sound when Claude responds
```

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

## How Detection Works

Terminal output is buffered (300ms window), ANSI codes are stripped, then matched:

- **Permission prompts**: `Allow once/always`, `(Y/n)`, `Run this command?`, `Approve/Deny`
- **AI replies**: `⏺` markers, response phrasing (`I'll`, `Let me`, `Here's`), prompt returns (`❯`)
- **Errors**: `exit code N`, `ERR!`, `FAILED`, `Error:`, `fatal:`

Priority: permission > reply > error (one sound per buffer flush).

## Requirements

- VS Code 1.75.0+
- On Linux: `mpg123` (`sudo apt install mpg123`)

## License

MIT
