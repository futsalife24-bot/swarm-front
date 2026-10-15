// Keep the original footage. Replace its burned-in title from frame 60 onward.
// Usage: node scripts/retitle-catena-film.mjs --ffmpeg <installed ffmpeg path>
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const executable = process.argv[process.argv.indexOf("--ffmpeg") + 1];
if (!process.argv.includes("--ffmpeg") || !executable)
  throw new Error("Specify --ffmpeg with the installed executable path");
const input = "public/assets/encounters/report-v2/worm.mp4";
const output = "public/assets/encounters/report-v2/worm-catena-v1.mp4";
const font = "public/assets/fonts/rajdhani/Rajdhani-Bold.ttf";
const enabled = "gte(t,2)";
const plateDirectory = new URL(
  "../.codex-remote-attachments/enemy-report-20261015/",
  import.meta.url,
);
mkdirSync(plateDirectory, { recursive: true });
const plate = fileURLToPath(new URL("catena-clean-plate.png", plateDirectory));
// The camera has finished its approach on frame 59. This panel region contains
// static scenery only, so its clean frame removes the old text without covering
// the specimen or painting an opaque box over the scene.
const extract = spawnSync(
  executable,
  [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    input,
    "-vf",
    "select=eq(n\\,59),crop=412:232:48:244",
    "-frames:v",
    "1",
    plate,
  ],
  { cwd: root, encoding: "utf8", windowsHide: true },
);
if (extract.status !== 0)
  throw new Error(extract.stderr || String(extract.error));
const filter = [
  `[0:v][1:v]overlay=48:244:shortest=1:enable='${enabled}'`,
  ...Array.from(
    { length: 12 },
    (_, i) =>
      `drawbox=x=${48 + i * 34}:y=244:w=${i === 11 ? 38 : 34}:h=232:color=0x0a191f@${(0.94 * (1 - i / 12)).toFixed(3)}:t=fill:enable='${enabled}'`,
  ),
  `drawbox=x=51:y=247:w=3:h=226:color=0xc8bb7d:t=fill:enable='${enabled}'`,
  `drawtext=fontfile=${font}:text='ANOMALY // FIRST CONTACT':fontsize=17:fontcolor=0xc8bb7d:x=70:y=268:enable='${enabled}'`,
  `drawtext=fontfile=${font}:text='CATENA':fontsize=76:fontcolor=0xf4f5e9:x=69:y=322:enable='${enabled}'`,
].join(",");
const result = spawnSync(
  executable,
  [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    input,
    "-loop",
    "1",
    "-framerate",
    "30",
    "-i",
    plate,
    "-an",
    "-filter_complex",
    filter,
    "-c:v",
    "libx264",
    "-threads",
    "2",
    "-preset",
    "slow",
    "-crf",
    "18",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    output,
  ],
  { cwd: root, encoding: "utf8", windowsHide: true },
);
if (result.status !== 0) throw new Error(result.stderr || String(result.error));
const sha = (path) =>
  createHash("sha256")
    .update(readFileSync(new URL(path, new URL("../", import.meta.url))))
    .digest("hex");
console.log(
  JSON.stringify({
    input,
    inputSha256: sha(input),
    output,
    outputSha256: sha(output),
    title: "CATENA",
    firstReplacedFrame: 60,
  }),
);
