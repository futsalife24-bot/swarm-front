import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";

// node scripts/encode-current-encounters.mjs <ffmpeg> [--only=<key> --date=<YYYYMMDD>]
// --only は指定の1種だけを符号化し、既存の動画・一覧は変えずに追記する。
const args = process.argv.slice(2);
const option = (name) =>
  args.find((arg) => arg.startsWith(`--${name}=`))?.split("=")[1];
const ffmpeg = args.find((arg) => !arg.startsWith("--")) ?? "ffmpeg";
const only = option("only");
const date = option("date") ?? "20261015";
const raw = "dist-validation/current-encounters-20261015";
const evidence = only
  ? `docs/evidence/encounter-films-${only}-${date}`
  : "docs/evidence/encounter-films-current-20261015";
const target = "public/assets/encounters/report-v3";
const allKeys = [
  "crawler",
  "ant",
  "spider",
  "spitter",
  "boss",
  "hornet",
  "bastion",
  "worm",
  "calyx",
  "harrow",
];
assert.ok(!only || allKeys.includes(only), `unknown key: ${only}`);
const keys = only ? [only] : allKeys;
const hash = (file) =>
  createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const run = (args) => {
  const result = spawnSync(ffmpeg, args, {
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 8e6,
  });
  assert.equal(result.status, 0, result.stderr || String(result.error));
  return result;
};
fs.mkdirSync(evidence, { recursive: true });
fs.mkdirSync(target, { recursive: true });
const rows = [];
for (const key of keys) {
  const record = JSON.parse(fs.readFileSync(`${raw}/${key}.json`, "utf8"));
  assert.equal(record.worldFrozen, true);
  assert.deepEqual(record.errors, []);
  assert.equal(record.capture, "webcodecs-vp9-frames");
  assert.equal(record.frameCount, record.duration * 30);
  const ivf = fs.readFileSync(`${raw}/${key}.ivf`);
  assert.equal(ivf.toString("ascii", 0, 4), "DKIF");
  assert.equal(ivf.toString("ascii", 8, 12), "VP90");
  assert.equal(ivf.readUInt16LE(12), 1280);
  assert.equal(ivf.readUInt16LE(14), 720);
  assert.equal(ivf.readUInt32LE(16), 30);
  assert.equal(ivf.readUInt32LE(20), 1);
  assert.equal(ivf.readUInt32LE(24), record.frameCount);
  let offset = 32;
  for (let frame = 0; frame < record.frameCount; frame++) {
    assert.ok(offset + 12 <= ivf.length, `${key}: frame ${frame} header`);
    const bytes = ivf.readUInt32LE(offset);
    assert.equal(ivf.readBigUInt64LE(offset + 4), BigInt(frame));
    offset += 12 + bytes;
    assert.ok(bytes > 0 && offset <= ivf.length, `${key}: frame ${frame} data`);
  }
  assert.equal(offset, ivf.length);
  const assets = record.assets.map((asset) => {
    const local =
      "public" + new URL(asset.url, "http://127.0.0.1:5202").pathname;
    assert.equal(
      hash(local),
      asset.sha256,
      `${key}: recording uses current model`,
    );
    return { file: local, sha256: asset.sha256 };
  });
  const output = `${target}/${key}-${date}.mp4`;
  run([
    "-y",
    "-i",
    `${raw}/${key}.ivf`,
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
    "20",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    output,
  ]);
  const decode = run(["-i", output, "-f", "null", "-"]).stderr;
  assert.match(decode, /1280x720/);
  assert.match(decode, /30 fps/);
  const clock = /Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/.exec(decode);
  assert.ok(clock);
  const duration =
    Number(clock[1]) * 3600 + Number(clock[2]) * 60 + Number(clock[3]);
  assert.ok(
    duration >= record.duration - 0.5 && duration <= record.duration + 2,
    `${key}: complete recording duration ${duration}`,
  );
  const samples = run([
    "-i",
    output,
    "-vf",
    "select=eq(n\\,90)+eq(n\\,150)",
    "-fps_mode",
    "passthrough",
    "-f",
    "framemd5",
    "-",
  ])
    .stdout.split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#"));
  assert.equal(samples.length, 2);
  assert.notEqual(
    samples[0].split(",").at(-1),
    samples[1].split(",").at(-1),
    `${key}: idle is animated after camera settles`,
  );
  run([
    "-y",
    "-i",
    output,
    "-vf",
    "fps=1/2,scale=384:216,tile=3x2",
    "-frames:v",
    "1",
    `${evidence}/${key}-contact.jpg`,
  ]);
  rows.push({
    key,
    name: record.name,
    file: output,
    sha256: hash(output),
    bytes: fs.statSync(output).size,
    duration,
    stage: record.stage,
    camera: record.camera,
    assets,
    width: 1280,
    height: 720,
    fps: 30,
    capture: record.capture,
    frameCount: record.frameCount,
    worldFrozen: true,
    allDecoded: true,
    idleAnimated: true,
  });
  console.log(
    `${key}: ${duration}s, ${fs.statSync(output).size} bytes, current model verified`,
  );
}
fs.writeFileSync(
  `${evidence}/manifest.json`,
  JSON.stringify(
    {
      recorded: `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6)}`,
      rows,
    },
    null,
    2,
  ) + "\n",
);
const filesModule = "src/client/encounter-film-files.ts";
const entry = (row) =>
  row.file.replace("public/", "") + "?v=" + row.sha256.slice(0, 12);
let files = Object.fromEntries(rows.map((row) => [row.key, entry(row)]));
if (only) {
  // 既存の一覧に追記し、報告順に並べ直す。他の動画の参照は変えない。
  // 整形済み（キーの引用符なし）でも読めるよう、1行ずつ取り出す。
  const current = Object.fromEntries(
    [
      ...fs
        .readFileSync(filesModule, "utf8")
        .matchAll(/^\s*"?([a-z]+)"?:\s*"([^"]+)",?$/gm),
    ].map((m) => [m[1], m[2]]),
  );
  assert.ok(Object.keys(current).length >= 9, "existing film list");
  const merged = { ...current, ...files };
  files = Object.fromEntries(
    allKeys.filter((key) => key in merged).map((key) => [key, merged[key]]),
  );
}
fs.writeFileSync(
  filesModule,
  "// Generated by scripts/encode-current-encounters.mjs.\nexport const ENCOUNTER_FILM_FILES = " +
    JSON.stringify(files, null, 2) +
    " as const;\n",
);
