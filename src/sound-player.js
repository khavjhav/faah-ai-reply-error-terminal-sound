// ---------------------------------------------------------------------------
// Cross-platform sound player (no npm dependencies)
// ---------------------------------------------------------------------------
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");

class SoundPlayer {
  constructor(mediaDir) {
    this.mediaDir = mediaDir;
    this.platform = process.platform;
  }

  /**
   * Play a sound file from the media/ directory.
   * Falls back to fahhhhh.mp3 if the requested file doesn't exist.
   * @param {string} filename  e.g. "error.mp3"
   * @param {number} volume    0-100
   */
  play(filename, volume = 100) {
    let filePath = path.join(this.mediaDir, filename);

    // Fall back to the default sound if category-specific file is missing
    if (!fs.existsSync(filePath)) {
      const fallback = path.join(this.mediaDir, "fahhhhh.mp3");
      if (!fs.existsSync(fallback)) {
        console.warn(`[faah-claude] No sound file found: ${filePath} or fahhhhh.mp3`);
        return;
      }
      filePath = fallback;
    }

    // Normalise volume to 0-100 range
    const vol = Math.max(0, Math.min(100, volume));

    if (this.platform === "win32") {
      // Use PowerShell script file to avoid escaping issues
      const scriptPath = path.join(__dirname, "play.ps1");
      const safeFilePath = filePath.replace(/\\/g, "/");
      exec(
        `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}" -FilePath "${safeFilePath}" -Volume ${vol / 100}`,
        { windowsHide: true }
      );
    } else if (this.platform === "darwin") {
      // macOS — afplay is pre-installed
      exec(`afplay -v ${vol / 100} "${filePath}"`);
    } else {
      // Linux — try mpg123, then paplay, then aplay
      exec(
        `mpg123 -q "${filePath}" 2>/dev/null || paplay "${filePath}" 2>/dev/null || aplay "${filePath}" 2>/dev/null`
      );
    }
  }
}

module.exports = SoundPlayer;
