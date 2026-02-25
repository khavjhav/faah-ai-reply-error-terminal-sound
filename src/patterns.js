// ---------------------------------------------------------------------------
// Terminal output patterns for detecting Claude CLI events
// ---------------------------------------------------------------------------

// Claude CLI permission / approval prompts
const PERMISSION_PATTERNS = [
  // Claude Code tool-use permission prompts
  /Allow\s+(once|always)/i,
  /Do you want to (run|allow|proceed|execute|approve)/i,
  /\(Y\/n\)/,
  /\(y\/N\)/,
  /Press Enter to allow/i,
  /Approve|Deny|Reject/,
  // Bash tool confirmation
  /Run this command\?/i,
  /Allow this (tool|action|edit|write|command)/i,
  // Edit / Write confirmations
  /Save changes\?/i,
];

// Claude CLI reply markers — these fire when Claude outputs a response.
// The terminal data arrives in chunks, so we look for distinctive markers
// that appear in Claude's formatted output.
const REPLY_PATTERNS = [
  // Claude often outputs ANSI-styled blocks; the ❯ prompt reappearing after
  // output is a solid signal that a reply just finished.
  /❯\s*$/m,
  // Tool result blocks
  /⏺/,
  // Claude's "I'll" / "Let me" phrasing at start of replies
  /^(I'll |Let me |Here's |I've |I can |Sure|Looking at)/m,
  // Finished marker when Claude is done
  /Done in /i,
];

// Terminal error patterns (same idea as the original FAAAAH extension)
const ERROR_PATTERNS = [
  // Shell exit codes
  /exit code [1-9]\d*/i,
  /exited with code [1-9]\d*/i,
  /returned exit code [1-9]\d*/i,
  // Common error prefixes
  /^error[:\s]/im,
  /^fatal[:\s]/im,
  /ERR!/,
  /FAILED/,
  /Command failed/i,
  /npm ERR!/,
  /Error:/,
];

function testPatterns(text, patterns) {
  return patterns.some((p) => p.test(text));
}

module.exports = {
  PERMISSION_PATTERNS,
  REPLY_PATTERNS,
  ERROR_PATTERNS,
  testPatterns,
};
