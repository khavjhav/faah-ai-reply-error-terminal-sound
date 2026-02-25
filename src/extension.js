// ---------------------------------------------------------------------------
// FAAH! Sound — VS Code Extension
// Plays sounds on: terminal errors, Claude CLI replies, permission prompts,
// task failures, and diagnostic errors.
//
// Uses onDidWriteTerminalData (proposed API) for Claude reply detection.
// Falls back to stable APIs for error/task/diagnostic detection.
// ---------------------------------------------------------------------------
const vscode = require("vscode");
const path = require("path");
const SoundPlayer = require("./sound-player");
const {
  PERMISSION_PATTERNS,
  REPLY_PATTERNS,
  ERROR_PATTERNS,
  testPatterns,
} = require("./patterns");

// Default sound file; category-specific files override if present
const SOUNDS = {
  error: "error.mp3",
  reply: "reply.mp3",
  permission: "permission.mp3",
};

/** @param {vscode.ExtensionContext} context */
function activate(context) {
  const mediaDir = path.join(context.extensionPath, "media");
  const player = new SoundPlayer(mediaDir);

  // Per-category cooldown trackers
  const lastPlayed = { error: 0, reply: 0, permission: 0 };

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------
  function cfg(key) {
    return vscode.workspace.getConfiguration("faahClaude").get(key);
  }

  function canPlay(category) {
    if (!cfg("enable")) return false;
    const now = Date.now();
    let cooldown;
    switch (category) {
      case "reply":
        cooldown = cfg("cooldownClaudeReply");
        break;
      case "permission":
        cooldown = cfg("cooldownPermission");
        break;
      default:
        cooldown = cfg("cooldown");
    }
    if (now - lastPlayed[category] < cooldown) return false;
    lastPlayed[category] = now;
    return true;
  }

  function playCategory(category) {
    if (!canPlay(category)) return;
    player.play(SOUNDS[category], cfg("volume"));
  }

  function mergePatterns(builtIn, settingsKey) {
    const extra = cfg(settingsKey) || [];
    const compiled = extra
      .map((s) => {
        try {
          return new RegExp(s, "im");
        } catch {
          return null;
        }
      })
      .filter(Boolean);
    return [...builtIn, ...compiled];
  }

  function stripAnsi(text) {
    // eslint-disable-next-line no-control-regex
    return text.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, "");
  }

  function analyseOutput(text) {
    const clean = stripAnsi(text);

    const permPatterns = mergePatterns(PERMISSION_PATTERNS, "permissionPatterns");
    if (cfg("enablePermissionPrompt") && testPatterns(clean, permPatterns)) {
      playCategory("permission");
      return;
    }

    const replyPatterns = mergePatterns(REPLY_PATTERNS, "claudeReplyPatterns");
    if (cfg("enableClaudeReply") && testPatterns(clean, replyPatterns)) {
      playCategory("reply");
      return;
    }

    if (cfg("enableTerminalErrors") && testPatterns(clean, ERROR_PATTERNS)) {
      playCategory("error");
    }
  }

  // ------------------------------------------------------------------
  // 1. Terminal output watcher — proposed API (onDidWriteTerminalData)
  //    Requires enabling proposed API in argv.json (see README).
  //    This is the ONLY way to detect Claude CLI replies in real-time.
  // ------------------------------------------------------------------
  let hasTerminalDataApi = false;

  try {
    if (typeof vscode.window.onDidWriteTerminalData === "function") {
      // Buffer terminal data per-terminal to match across chunks
      const termBuffers = new Map();
      const BUFFER_FLUSH_MS = 300;
      const BUFFER_MAX = 4096;

      const termDataSub = vscode.window.onDidWriteTerminalData((event) => {
        if (!cfg("enable")) return;

        const termKey = event.terminal.name;
        if (!termBuffers.has(termKey)) {
          termBuffers.set(termKey, { text: "", timer: null });
        }
        const buf = termBuffers.get(termKey);

        buf.text = (buf.text + event.data).slice(-BUFFER_MAX);

        if (buf.timer) clearTimeout(buf.timer);
        buf.timer = setTimeout(() => {
          analyseOutput(buf.text);
          buf.text = "";
        }, BUFFER_FLUSH_MS);
      });

      context.subscriptions.push(termDataSub);
      hasTerminalDataApi = true;
      console.log("[faah-claude] Terminal data API available — full detection enabled");
    }
  } catch {
    // Proposed API not available, fall through to stable APIs
  }

  // ------------------------------------------------------------------
  // 2. Stable fallback — shell execution output reading
  //    Works for individual commands but not interactive sessions.
  // ------------------------------------------------------------------
  if (!hasTerminalDataApi) {
    console.log("[faah-claude] Terminal data API not available — using stable API fallback");
    console.log("[faah-claude] For Claude reply detection, enable proposed API (see README)");

    if (vscode.window.onDidStartTerminalShellExecution) {
      const shellExecSub = vscode.window.onDidStartTerminalShellExecution(
        async (event) => {
          if (!cfg("enable")) return;
          try {
            const stream = event.execution.read();
            let buffer = "";
            for await (const data of stream) {
              buffer += data;
              if (buffer.length > 200) {
                analyseOutput(buffer);
                buffer = "";
              }
            }
            if (buffer.length > 0) {
              analyseOutput(buffer);
            }
          } catch {
            // Stream not available for this terminal
          }
        }
      );
      context.subscriptions.push(shellExecSub);
    }
  }

  // ------------------------------------------------------------------
  // 3. Terminal exit code detection (stable API)
  // ------------------------------------------------------------------
  if (vscode.window.onDidEndTerminalShellExecution) {
    const shellEndSub = vscode.window.onDidEndTerminalShellExecution((event) => {
      if (!cfg("enable") || !cfg("enableTerminalErrors")) return;
      if (event.exitCode !== undefined && event.exitCode !== null && event.exitCode !== 0) {
        playCategory("error");
      }
    });
    context.subscriptions.push(shellEndSub);
  }

  // ------------------------------------------------------------------
  // 4. Task failure watcher (stable API)
  // ------------------------------------------------------------------
  const taskEndSub = vscode.tasks.onDidEndTaskProcess((event) => {
    if (
      cfg("enable") &&
      cfg("enableTaskFailures") &&
      event.exitCode !== 0 &&
      event.exitCode !== undefined
    ) {
      playCategory("error");
    }
  });
  context.subscriptions.push(taskEndSub);

  // ------------------------------------------------------------------
  // 5. Diagnostic (compile error) watcher (stable API)
  // ------------------------------------------------------------------
  const diagSub = vscode.languages.onDidChangeDiagnostics((event) => {
    if (!cfg("enable") || !cfg("enableDiagnosticErrors")) return;
    for (const uri of event.uris) {
      const diags = vscode.languages.getDiagnostics(uri);
      const hasError = diags.some(
        (d) => d.severity === vscode.DiagnosticSeverity.Error
      );
      if (hasError) {
        playCategory("error");
        return;
      }
    }
  });
  context.subscriptions.push(diagSub);

  // ------------------------------------------------------------------
  // 6. Commands
  // ------------------------------------------------------------------
  context.subscriptions.push(
    vscode.commands.registerCommand("faahClaude.toggle", () => {
      const current = cfg("enable");
      vscode.workspace
        .getConfiguration("faahClaude")
        .update("enable", !current, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage(
        `FAAH! sounds ${!current ? "enabled" : "disabled"}`
      );
    }),
    vscode.commands.registerCommand("faahClaude.testError", () => {
      player.play(SOUNDS.error, cfg("volume"));
    }),
    vscode.commands.registerCommand("faahClaude.testReply", () => {
      player.play(SOUNDS.reply, cfg("volume"));
    }),
    vscode.commands.registerCommand("faahClaude.testPermission", () => {
      player.play(SOUNDS.permission, cfg("volume"));
    }),
    vscode.commands.registerCommand("faahClaude.enableProposedApi", async () => {
      const EXTENSION_ID = "khavjhav.faah-ai-reply-error-terminal-sound";
      const msg = await vscode.window.showInformationMessage(
        "Enable Claude CLI reply detection? This adds a one-time setting to VS Code and restarts.",
        "Enable & Restart",
        "Cancel"
      );
      if (msg !== "Enable & Restart") return;

      // Find argv.json path (works on Windows, macOS, Linux)
      const fs = require("fs");
      let argvPath;
      if (process.platform === "win32") {
        argvPath = path.join(process.env.APPDATA || "", "Code", "argv.json");
      } else if (process.platform === "darwin") {
        argvPath = path.join(process.env.HOME || "", "Library", "Application Support", "Code", "argv.json");
      } else {
        argvPath = path.join(process.env.HOME || "", ".vscode", "argv.json");
      }

      try {
        let content = "{}";
        if (fs.existsSync(argvPath)) {
          content = fs.readFileSync(argvPath, "utf8");
        }

        // Strip comments (argv.json allows // comments)
        const stripped = content.replace(/^\s*\/\/.*$/gm, "");
        let json;
        try {
          json = JSON.parse(stripped);
        } catch {
          // If parsing fails, try to preserve the file and just append
          json = {};
        }

        // Add or update the enable-proposed-api array
        const key = "enable-proposed-api";
        if (!Array.isArray(json[key])) {
          json[key] = [];
        }
        if (!json[key].includes(EXTENSION_ID)) {
          json[key].push(EXTENSION_ID);
        }

        // Re-read original to preserve comments, do a targeted insert
        if (fs.existsSync(argvPath)) {
          const original = fs.readFileSync(argvPath, "utf8");
          if (original.includes(EXTENSION_ID)) {
            vscode.window.showInformationMessage("Already enabled! Restarting VS Code...");
            vscode.commands.executeCommand("workbench.action.reloadWindow");
            return;
          }

          // Try to insert before the last closing brace
          const propLine = `\t"enable-proposed-api": ["${EXTENSION_ID}"]`;
          if (original.includes('"enable-proposed-api"')) {
            // Key exists, add our ID to the array
            const updated = original.replace(
              /("enable-proposed-api"\s*:\s*\[)(.*?)(\])/s,
              (match, before, items, after) => {
                const trimmed = items.trim();
                const sep = trimmed.length > 0 ? ", " : "";
                return `${before}${items}${sep}"${EXTENSION_ID}"${after}`;
              }
            );
            fs.writeFileSync(argvPath, updated, "utf8");
          } else {
            // Insert new key before the last }
            const lastBrace = original.lastIndexOf("}");
            if (lastBrace !== -1) {
              const before = original.slice(0, lastBrace).trimEnd();
              const needsComma = before.match(/[}\]"'\d]$/);
              const updated = before + (needsComma ? "," : "") + "\n" + propLine + "\n}\n";
              fs.writeFileSync(argvPath, updated, "utf8");
            } else {
              fs.writeFileSync(argvPath, JSON.stringify(json, null, "\t") + "\n", "utf8");
            }
          }
        } else {
          // Create new argv.json
          fs.mkdirSync(path.dirname(argvPath), { recursive: true });
          fs.writeFileSync(argvPath, JSON.stringify(json, null, "\t") + "\n", "utf8");
        }

        vscode.window.showInformationMessage("AI reply detection enabled! Restarting VS Code...");
        setTimeout(() => {
          vscode.commands.executeCommand("workbench.action.reloadWindow");
        }, 1500);
      } catch (err) {
        vscode.window.showErrorMessage(
          `Could not update argv.json automatically: ${err.message}. ` +
          'Open Command Palette → "Preferences: Configure Runtime Arguments" and add: ' +
          `"enable-proposed-api": ["${EXTENSION_ID}"]`
        );
      }
    })
  );

  // ------------------------------------------------------------------
  // Status bar indicator
  // ------------------------------------------------------------------
  const statusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBar.text = "$(unmute) FAAH!";
  statusBar.tooltip = "Click to toggle FAAH! sounds";
  statusBar.command = "faahClaude.toggle";
  statusBar.show();
  context.subscriptions.push(statusBar);

  // Show hint if proposed API is not available
  if (!hasTerminalDataApi) {
    const statusHint = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      99
    );
    statusHint.text = "$(warning) FAAH: Enable AI detection";
    statusHint.tooltip = "Click to enable Claude CLI reply detection (one-time setup)";
    statusHint.command = "faahClaude.enableProposedApi";
    statusHint.show();
    context.subscriptions.push(statusHint);
  }

  console.log("[faah-claude] Extension activated successfully");
}

function deactivate() {}

module.exports = { activate, deactivate };
