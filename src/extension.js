// ---------------------------------------------------------------------------
// FAAAAH Claude Sound — VS Code Extension
// Plays sounds on: terminal errors, Claude CLI replies, permission prompts,
// task failures, and diagnostic errors.
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

// Default sound file for all categories is fahhhhh.mp3.
// Users can drop custom files (error.mp3, reply.mp3, permission.mp3) into
// media/ to override individual categories.
const DEFAULT_SOUND = "fahhhhh.mp3";
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

  /**
   * Build the full pattern list for a category, merging built-ins with any
   * user-defined extra patterns from settings.
   */
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

  // ------------------------------------------------------------------
  // 1. Terminal output watcher (Claude replies + permission + errors)
  // ------------------------------------------------------------------

  // Buffer terminal data per-terminal so we can match across chunks
  const termBuffers = new Map();
  const BUFFER_FLUSH_MS = 300; // flush buffer after 300 ms of silence
  const BUFFER_MAX = 4096; // max chars to keep per terminal

  const termDataSub = vscode.window.onDidWriteTerminalData((event) => {
    if (!cfg("enable")) return;

    const termKey = event.terminal.name;
    if (!termBuffers.has(termKey)) {
      termBuffers.set(termKey, { text: "", timer: null });
    }
    const buf = termBuffers.get(termKey);

    // Append new data, cap at max length
    buf.text = (buf.text + event.data).slice(-BUFFER_MAX);

    // Reset flush timer
    if (buf.timer) clearTimeout(buf.timer);
    buf.timer = setTimeout(() => {
      processBuffer(buf.text);
      buf.text = "";
    }, BUFFER_FLUSH_MS);
  });

  function processBuffer(text) {
    // Strip ANSI escape codes for cleaner matching
    const clean = text.replace(
      // eslint-disable-next-line no-control-regex
      /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g,
      ""
    );

    // Priority: permission > reply > error
    const permPatterns = mergePatterns(
      PERMISSION_PATTERNS,
      "permissionPatterns"
    );
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

  context.subscriptions.push(termDataSub);

  // ------------------------------------------------------------------
  // 2. Task failure watcher
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
  // 3. Diagnostic (compile error) watcher
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
        return; // one sound is enough per batch
      }
    }
  });
  context.subscriptions.push(diagSub);

  // ------------------------------------------------------------------
  // 4. Commands
  // ------------------------------------------------------------------
  context.subscriptions.push(
    vscode.commands.registerCommand("faahClaude.toggle", () => {
      const current = cfg("enable");
      vscode.workspace
        .getConfiguration("faahClaude")
        .update("enable", !current, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage(
        `FAAAAH Claude sounds ${!current ? "enabled" : "disabled"} 🔊`
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
    })
  );

  // ------------------------------------------------------------------
  // Status bar indicator
  // ------------------------------------------------------------------
  const statusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBar.text = "$(unmute) FAAAAH";
  statusBar.tooltip = "Click to toggle FAAAAH Claude sounds";
  statusBar.command = "faahClaude.toggle";
  statusBar.show();
  context.subscriptions.push(statusBar);

  console.log("[faah-claude] Extension activated");
}

function deactivate() {}

module.exports = { activate, deactivate };
