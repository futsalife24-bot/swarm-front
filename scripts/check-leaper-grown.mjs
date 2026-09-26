// PR91 F1: reproducible evidence for the shipped LEAPER v3 (grown-shell) model and motion.
//   node scripts/check-leaper-grown.mjs
// 1. SHA-256 / size links: public GLB, candidate GLB/.blend, generator, shared library textures.
// 2. The game's own loader (loadEnemyMotion "leaper": validation + procedural Idle / wind-up)
//    and skinned vertices for all four clips: finite, grounded, loop seams.
// 3. The real Renderer driven through Idle -> wind-up -> Leap -> landing -> run, with the
//    controller state per frame, screenshots and a short video.
// Writes only docs/evidence/leaper-grown-v1/. Never edits public/, src/ or saves.
import { createServer } from "vite";
import { chromium } from "@playwright/test";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { execSync, spawnSync } from "node:child_process";
import os from "node:os";

const out = "docs/evidence/leaper-grown-v1";
fs.mkdirSync(out, { recursive: true });
const sha = (file) => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const glbImages = (file) => {
  const b = fs.readFileSync(file);
  const json = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)));
  const bin = 20 + b.readUInt32LE(12) + 8;
  return Object.fromEntries(
    (json.images ?? []).map((im) => {
      const v = json.bufferViews[im.bufferView];
      const start = bin + (v.byteOffset ?? 0);
      return [im.name, createHash("sha256").update(b.subarray(start, start + v.byteLength)).digest("hex")];
    }),
  );
};

// ---------------------------------------------------------------- 1. provenance
const C = "assets/blender/candidates/hound/grown-v1";
const L = "assets/blender/library/anomaly-hardshell-v1/textures";
const files = [
  "public/assets/enemies/leaper_motion_v3.glb",
  `${C}/leaper/leaper_grown_v1.glb`,
  `${C}/leaper/leaper_grown_v1.blend`,
  `${C}/build_candidate.py`,
  "assets/blender/source/hound_motion_v1.blend",
  "public/assets/enemies/leaper_motion_v2.glb",
  "public/assets/enemies/hound_motion_v1.glb",
];
const provenance = {
  head: execSync("git rev-parse HEAD").toString().trim(),
  dirty: execSync("git status --short -- public src assets/blender/candidates/hound assets/blender/library").toString().trim(),
  files: Object.fromEntries(files.map((f) => [f, { bytes: fs.statSync(f).size, sha256: sha(f) }])),
  validationJson: JSON.parse(fs.readFileSync(`${C}/leaper/validation.json`, "utf8")),
};
assert.equal(provenance.files[files[0]].sha256, provenance.files[files[1]].sha256, "public v3 != candidate GLB");
assert.equal(provenance.validationJson.sha256, provenance.files[files[0]].sha256, "validation.json is stale");
const v2 = glbImages("public/assets/enemies/leaper_motion_v2.glb");
const v3 = glbImages("public/assets/enemies/leaper_motion_v3.glb");
provenance.textures = fs.readdirSync(L).sort().map((file) => {
  // v2 embeds them as HOUND_<role>_<map>; v3 keeps the library file name.
  const base = file.replace(/\.png$/, "");
  const lib = sha(path.join(L, file));
  return { file, sha256: lib, equalsV2: v2["HOUND_" + base] === lib, equalsV3: v3[base] === lib };
});
for (const t of provenance.textures) assert.ok(t.equalsV2 && t.equalsV3, `texture ${t.file} differs`);
assert.equal(provenance.textures.length, 9);

// ---------------------------------------------------------------- 2 + 3. browser checks
const server = await createServer({ server: { hmr: false, port: 5411, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ channel: "chrome", args: ["--use-angle=d3d11", "--ignore-gpu-blocklist"] });
const M = "/scripts/leaper-evidence-page.ts";
let loader, log, video;
const errors = [];
try {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:5411/e2e/structure-fixture.html?drone=1&clean=1&droneRadius=7.5&droneHeight=2.4&droneYaw=90&droneSpeed=0");
  loader = await page.evaluate(async (M) => (await import(M)).inspectLoader(), M);
  assert.equal(loader.meshes, 4);
  assert.equal(loader.bones, 20);
  assert.ok(loader.boneNamesEqualV2 && loader.sameBinding);
  assert.deepEqual(Object.keys(loader.ranges).sort(), ["Idle", "Leap", "Locomotion", "Lunge"]);
  for (const [name, r] of Object.entries(loader.clips)) {
    assert.equal(r.nonFinite, 0, name);
    assert.ok(r.maxMove > 0.01, `${name} does not move`);
    // Grounded clips keep every vertex at or above the contact plane (1 cm tolerance).
    // Leap is airborne: the game lifts the body, so its in-place minimum is only recorded.
    if (name !== "Leap") assert.ok(r.minY > -0.01, `${name} sinks ${r.minY}`);
    // Leap starts and ends on the ground: take-off / touch-down frames stay above it.
    else assert.ok(r.startMinY > -0.01 && r.endMinY > -0.01, `Leap ground contact ${r.startMinY} / ${r.endMinY}`);
  }
  for (const name of ["Idle", "Locomotion"]) assert.ok(loader.clips[name].loopSeam < 0.001, `${name} loop seam`);

  await page.evaluate(async (M) => { await (await import(M)).setupScene(); }, M);
  const phases = [["idle", 1.5], ["windup", 0.45], ["impact", 0.75], ["idle2", 0.4], ["leap", 0.9], ["landing", 0.65], ["run", 1.5]];
  // One screenshot per simulated frame -> 30 fps video (system ffmpeg), plus a still per phase.
  const frameDir = fs.mkdtempSync(path.join(os.tmpdir(), "leaper-frames-"));
  let n = 0;
  for (const [phase, seconds] of phases) {
    const total = Math.round(seconds * 30);
    for (let f = 0; f < total; f++) {
      await page.evaluate(async ([M, a]) => (await import(M)).runPhase(...a), [M, [phase, f, 1, total]]);
      const shot = await page.screenshot({ path: path.join(frameDir, `f${String(n++).padStart(4, "0")}.png`) });
      if (f === Math.floor(total / 2)) fs.writeFileSync(`${out}/renderer-${phase}.png`, shot);
    }
  }
  log = await page.evaluate(async (M) => (await import(M)).sequenceLog(), M);
  video = frameDir;
  await context.close();
} finally {
  await browser.close();
  await server.close();
}
assert.deepEqual(errors, []);
// Clip order through the sequence: every transition the LEAPER controller made.
const transitions = log.filter((r, i) => i === 0 || r.clip !== log[i - 1].clip).map((r) => `${r.phase}:${r.clip}`);
const clipIn = (phase) => new Set(log.filter((r) => r.phase === phase).map((r) => r.clip));
assert.deepEqual([...clipIn("idle")], ["Idle"]);
assert.deepEqual([...clipIn("windup")], ["Lunge"]);
assert.deepEqual([...clipIn("leap")], ["Leap"]);
assert.ok(clipIn("run").has("Locomotion"));
const leapRows = log.filter((r) => r.phase === "leap");
for (const r of leapRows) assert.ok(Math.abs(r.time - (0.001 + 0.9 * (r.frame / 27)) ) < 0.002, `leap time ${r.time}`);
const webm = `${out}/renderer-sequence.mp4`;
const ff = spawnSync(process.env.FFMPEG ?? "ffmpeg", ["-y", "-loglevel", "error", "-framerate", "30", "-i", path.join(video, "f%04d.png"),
  "-vf", "scale=960:-2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "30", webm], { encoding: "utf8" });
assert.equal(ff.status, 0, ff.stderr);
fs.rmSync(video, { recursive: true, force: true });

const report = {
  generatedBy: "scripts/check-leaper-grown.mjs",
  provenance,
  loader,
  sequence: { transitions, frames: log.length, log },
  video: { file: webm, bytes: fs.statSync(webm).size, sha256: sha(webm) },
  pass: true,
};
fs.writeFileSync(`${out}/checks.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify({ pass: true, head: provenance.head, glb: provenance.files[files[0]].sha256, clips: Object.fromEntries(Object.entries(loader.clips).map(([k, v]) => [k, { minY: +v.minY.toFixed(4), start: +v.startMinY.toFixed(4), end: +v.endMinY.toFixed(4), seam: +v.loopSeam.toFixed(5) }])), transitions }));
