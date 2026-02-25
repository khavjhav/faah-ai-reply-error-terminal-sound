// ---------------------------------------------------------------------------
// FAAH! Sound — VS Code Extension
// Plays sounds on: terminal errors, Claude CLI replies, permission prompts,
// task failures, and diagnostic errors.
//
// Uses STABLE VS Code APIs only (no proposed APIs).
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

  /**
   * Strip ANSI escape codes from terminal text.
   */
  function stripAnsi(text) {
    // eslint-disable-next-line no-control-regex
    return text.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, "");
  }

  /**
   * Analyse a chunk of terminal output and play the appropriate sound.
   */
  function analyseOutput(text) {
    const clean = stripAnsi(text);

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

  // ------------------------------------------------------------------
  // 1. Terminal shell execution — read command output (stable API)
  //    Requires shell integration to be active in the terminal.
  // ------------------------------------------------------------------
  if (vscode.window.onDidStartTerminalShellExecution) {
    const shellExecSub = vscode.window.onDidStartTerminalShellExecution(
      async (event) => {
        if (!cfg("enable")) return;

        const execution = event.execution;
        // Read the output stream
        try {
          const stream = execution.read();
          let buffer = "";
          for await (const data of stream) {
            buffer += data;
            // Process in chunks to avoid too-frequent matching
            if (buffer.length > 200) {
              analyseOutput(buffer);
              buffer = "";
            }
          }
          // Process any remaining buffer
          if (buffer.length > 0) {
            analyseOutput(buffer);
          }
        } catch {
          // Stream may not be available for all terminals
        }
      }
    );
    context.subscriptions.push(shellExecSub);
  }

  // ------------------------------------------------------------------
  // 2. Terminal shell execution end — detect exit code errors
  // ------------------------------------------------------------------
  if (vscode.window.onDidEndTerminalShellExecution) {
    const shellEndSub = vscode.window.onDidEndTerminalShellExecution(
      (event) => {
        if (!cfg("enable") || !cfg("enableTerminalErrors")) return;
        if (
          event.exitCode !== undefined &&
          event.exitCode !== null &&
          event.exitCode !== 0
        ) {
          playCategory("error");
        }
      }
    );
    context.subscriptions.push(shellEndSub);
  }

  // ------------------------------------------------------------------
  // 3. Task failure watcher
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
  // 4. Diagnostic (compile error) watcher
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
  // 5. Commands
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

  console.log("[faah-claude] Extension activated successfully");
}

function deactivate() {}

module.exports = { activate, deactivate };
