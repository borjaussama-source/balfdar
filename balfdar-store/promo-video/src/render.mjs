import { spawnSync } from "node:child_process";
import ffmpegPath from "ffmpeg-static";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
if (!ffmpegPath) throw new Error("ffmpeg-static did not provide an FFmpeg executable for this platform.");

const pythonCandidates = process.env.PYTHON
  ? [{ command: process.env.PYTHON, args: [] }]
  : process.platform === "win32"
    ? [{ command: "py", args: ["-3"] }, { command: "python", args: [] }]
    : [{ command: "python3", args: [] }, { command: "python", args: [] }];

let result;
for (const candidate of pythonCandidates) {
  result = spawnSync(candidate.command, [...candidate.args, path.join(root, "src", "render.py")], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, FFMPEG_PATH: ffmpegPath },
  });
  if (result.error?.code === "ENOENT") continue;
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}
throw new Error("Python 3 was not found. Install Python 3 and Pillow, or set PYTHON to its executable path.");
