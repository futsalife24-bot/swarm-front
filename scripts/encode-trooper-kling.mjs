import fs from "node:fs";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
const ff = process.argv[2];
assert.ok(ff, "Pass installed ffmpeg path");
const dir = "dist-validation/trooper-kling",
  reports = JSON.parse(fs.readFileSync(dir + "/game-recording.json"));
const segments = [
  ["A - WALK", "rifle", "A-walk", 1.05, 1.3],
  ["B - COMBAT RUN", "rifle", "B-run", 0.9, 1.2],
  ["C - AR READY / AIM / READY", "rifle", "C-AR-aim", 0.85, 2.15],
  ["C - SG READY / AIM / READY", "rifle", "C-SG-aim", 0.8, 2.1],
  ["D - AR WALK / RUN / AIM", "rifle", "D-run-aim", 2.3, 2.7],
  ["E - ROCKET LAUNCHER MOVEMENT", "rocket", "E-run", 2.8, 3.2],
];
const names = [];
for (const [i, [title, kind, stage, lead, duration]] of segments.entries()) {
  const records = ["before", "after"].map((version) =>
    reports.find((r) => r.version === version && r.kind === kind),
  );
  const args = ["-y", "-v", "error"];
  for (const [j, version] of ["before", "after"].entries()) {
    const at = records[j].stages.find((s) => s.label === stage).time;
    args.push(
      "-ss",
      String(Math.max(0, at - lead)),
      "-i",
      `${dir}/${version}-${kind}-canvas.webm`,
    );
  }
  const font = "fontfile='C\\:/Windows/Fonts/arial.ttf'";
  const filter = `[0:v]fps=30,scale=960:540,setsar=1,setpts=PTS-STARTPTS[a];[1:v]fps=30,scale=960:540,setsar=1,setpts=PTS-STARTPTS[b];[a][b]hstack=inputs=2,pad=1920:590:0:50:color=0x172127,drawtext=${font}:text='${title}':fontsize=23:fontcolor=white:x=680:y=14,drawtext=${font}:text='BEFORE - v9':fontsize=23:fontcolor=white:x=22:y=14,drawtext=${font}:text='AFTER - v10':fontsize=23:fontcolor=0x83ddca:x=1660:y=14[v]`;
  const name = `comparison-${i + 1}.mp4`;
  args.push(
    "-filter_complex",
    filter,
    "-map",
    "[v]",
    "-an",
    "-t",
    String(duration),
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-crf",
    "19",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    `${dir}/${name}`,
  );
  const r = spawnSync(ff, args, { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  names.push(name);
}
fs.writeFileSync(
  dir + "/comparison-list.txt",
  names.map((n) => `file '${n}'`).join("\n"),
);
const r = spawnSync(
  ff,
  [
    "-y",
    "-v",
    "error",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    dir + "/comparison-list.txt",
    "-c",
    "copy",
    "-movflags",
    "+faststart",
    dir + "/trooper-before-after.mp4",
  ],
  { encoding: "utf8" },
);
assert.equal(r.status, 0, r.stderr);
console.log("Encoded", names.length, "A-E comparison segments");
