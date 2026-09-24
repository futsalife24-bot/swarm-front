import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const ffmpeg = path.resolve(process.argv[2] ?? "../pv/edit/ffmpeg.exe");
const directory = "dist-validation/harrow/film-v9";
const input = `${directory}/harrow.webm`;
const output = "public/assets/encounters/report-v2/harrow-v9.mp4";
const glb = "public/assets/enemies/harrow_motion_v9.glb";
assert.ok(fs.existsSync(glb), "HARROW v9 is required");
const run = (args) => {
  const result = spawnSync(ffmpeg, args, {
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 8e6,
  });
  assert.equal(result.status, 0, result.stderr || String(result.error));
  return result;
};
const hash = (file) =>
  createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const recording = JSON.parse(
  fs.readFileSync(`${directory}/recording.json`, "utf8"),
);
assert.equal(
  recording.glbSha256,
  hash(glb),
  "Recorded asset matches final runtime GLB",
);
assert.equal(recording.worldFrozen, true);
assert.deepEqual(recording.errors, []);
assert.equal(recording.scale, 1.95);
const probe = run(["-i", input, "-f", "null", "-"]);
const clock = /Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/.exec(probe.stderr);
assert.ok(clock, "Recording duration is available");
const duration =
  Number(clock[1]) * 3600 + Number(clock[2]) * 60 + Number(clock[3]);
assert.ok(
  duration >= 13.5 && duration <= 16,
  `Unexpected recording duration ${duration}`,
);
run([
  "-y",
  "-i",
  input,
  "-an",
  "-vf",
  "fps=30",
  "-c:v",
  "libx264",
  "-threads",
  "2",
  "-preset",
  "fast",
  "-crf",
  "19",
  "-pix_fmt",
  "yuv420p",
  "-movflags",
  "+faststart",
  output,
]);
const decoded = run(["-i", output, "-f", "null", "-"]);
assert.match(decoded.stderr, /1280x720/);
assert.match(decoded.stderr, /30 fps/);
const motion = run([
  "-i",
  output,
  "-vf",
  "select=eq(n\\,90)+eq(n\\,150)",
  "-fps_mode",
  "passthrough",
  "-f",
  "framemd5",
  "-",
]);
const frames = motion.stdout
  .split(/\r?\n/)
  .filter((line) => line && !line.startsWith("#"));
assert.equal(frames.length, 2);
assert.notEqual(
  frames[0].split(",").at(-1),
  frames[1].split(",").at(-1),
  "Flight moves after camera settles",
);
run([
  "-y",
  "-i",
  output,
  "-vf",
  "fps=4/7,scale=480:270,tile=4x2",
  "-frames:v",
  "1",
  `${directory}/contact.jpg`,
]);
for (const [label, time] of [
  ["flight-a", 3],
  ["flight-b", 5],
])
  run([
    "-y",
    "-ss",
    String(time),
    "-i",
    output,
    "-frames:v",
    "1",
    `${directory}/${label}.png`,
  ]);
const result = {
  version: "harrow-v9",
  source: input,
  sourceSha256: hash(input),
  glb,
  glbSha256: hash(glb),
  output,
  sha256: hash(output),
  bytes: fs.statSync(output).size,
  duration,
  width: 1280,
  height: 720,
  fps: 30,
  allDecoded: true,
  flightFrameChanges: true,
  visualInspection: "pending",
};
fs.writeFileSync(
  `${directory}/verification.json`,
  JSON.stringify(result, null, 2),
);
console.log(JSON.stringify(result));
