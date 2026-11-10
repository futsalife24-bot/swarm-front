// CATENA-only filming overlay. The production renderer and the shared recorder
// source are never edited; Vite applies these changes to this local page only.
// Usage: node scripts/record-catena-report-20261111.mjs --trial|--record
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { chromium } from "@playwright/test";
import { createServer } from "vite";

const mode = process.argv[2];
assert.ok(["--trial", "--record"].includes(mode));
const port = 5210;
const origin = `http://127.0.0.1:${port}`;
const out = "dist-validation/catena-report-film-20261111";
const evidence = "docs/evidence/catena-report-20261111";
const video = "public/assets/encounters/report-v3/worm-20261111.mp4";
const filemap = "src/client/encounter-film-files.ts";
mkdirSync(out, { recursive: true });
mkdirSync(evidence, { recursive: true });
const replace = (source, before, after) => {
  assert.ok(
    source.includes(before),
    `filming source changed: ${before.slice(0, 60)}`,
  );
  return source.replace(before, after);
};
function filmingSource(source) {
  source = `import { stepOmega, omegaPhase, planOmega } from "../src/shared/catena-omega";\nimport { wormNodes } from "../src/shared/worm";\n${source}`;
  source = replace(
    source,
    "let recording = false;",
    `let recording = false;
let visualWorld: World | undefined;
let visualEnemy: Enemy | undefined;
let visualGround: number[] = [];
let visualPhases: string[] = [];
let visualMaxLift = 0;
let visualPads = 0;
let idleStart: number[] | undefined;
let idleEnd: number[] | undefined;
function resetCatenaFilm(current: Scene) {
  visualWorld = structuredClone(current.world);
  visualEnemy = visualWorld!.enemies.find((item) => item.id === current.enemy.id)!;
  visualEnemy.omegaReadyAt = 1.2;
  visualGround = wormNodes(visualEnemy).map((node) => node.y);
  visualPhases = [];
  visualMaxLift = 0;
  visualPads = 0;
  idleStart = undefined;
  idleEnd = undefined;
}
function catenaFilmEvidence() {
  const idlePoseDelta = idleStart && idleEnd
    ? idleStart.reduce((sum, value, i) => sum + Math.abs(value - idleEnd![i]), 0)
    : 0;
  return { segments: visualEnemy?.segments?.length, phases: visualPhases,
    maxLift: visualMaxLift, maxWarningPads: visualPads,
    idlePoseDelta, idleAnimated: idlePoseDelta > 0.02,
    source: "shared stepOmega + production FoundryWormView + OmegaWarning" };
}`,
  );
  source = replace(
    source,
    "  if (!enemy) throw Error(`出現に失敗: ${key}`);",
    `  if (!enemy) throw Error(\`出現に失敗: \${key}\`);
  if (key === "worm") {
    const nodes = wormNodes(enemy);
    const unit = (enemy.size ?? 1) * 3.2;
    for (const [i, node] of nodes.entries()) {
      node.x = origin.x;
      node.z = origin.z - i * unit;
      node.y = supportHeight(node.x, node.z, mapFor(world).blocks);
      node.heading = 0;
    }
    if (!planOmega(world, enemy)) throw Error("CATENA film has no valid jump plan");
  }`,
  );
  source = replace(
    source,
    `  return encounterCamera(
    camera,
    current.focus,
    front,
    choice.distance,
    current.key === "harrow" ? 0 : 0.14,
  );`,
    `  if (current.key === "worm") {
    // Show the full 14-part chain and the head-to-tail leap in one frame.
    const side = new T.Vector3(front.z, 0, -front.x);
    const direction = front.clone().multiplyScalar(0.42).addScaledVector(side, 0.91).normalize();
    const end = view.camera.clone();
    end.position.copy(current.focus).addScaledVector(direction, choice.distance);
    end.position.y = current.focus.y + choice.distance * 0.16;
    end.lookAt(current.focus);
    const begin = end.clone();
    begin.position.copy(current.focus).addScaledVector(direction, choice.distance * 1.32);
    begin.position.y = end.position.y + 5;
    begin.lookAt(current.focus);
    const pose = end.clone();
    return (time: number) => {
      pose.position.lerpVectors(begin.position, end.position, time);
      pose.quaternion.slerpQuaternions(begin.quaternion, end.quaternion, time);
      return pose;
    };
  }
  return encounterCamera(camera, current.focus, front, choice.distance, current.key === "harrow" ? 0 : 0.14);`,
  );
  source = replace(
    source,
    "  const bodyBounds = animatedBodyBounds(enemy, idle);",
    `  const bodyBounds = animatedBodyBounds(enemy, idle);
  if (key === "worm") {
    const plan = planOmega(world, enemy)!;
    const lift = Math.max(...plan.peak.map((node, i) => node.y - plan.ground[i].y)) * 0.9;
    bodyBounds.max.y += lift;
  }`,
  );
  source = replace(
    source,
    "  scene = current;",
    '  scene = current;\n  if (key === "worm") resetCatenaFilm(current);',
  );
  source = replace(
    source,
    "  current.idle.update(Math.max(0, time - 1.7));",
    `  if (current.key === "worm") {
    if (!visualWorld || !visualEnemy) resetCatenaFilm(current);
    const clock = Math.max(0, time - 1.7);
    visualWorld!.time = clock;
    stepOmega(visualWorld!, visualEnemy!);
    const phase = omegaPhase(visualEnemy!, clock);
    const state = phase ?? (visualPhases.includes("flight") ? "landed" : "idle");
    if (!visualPhases.includes(state)) visualPhases.push(state);
    visualMaxLift = Math.max(visualMaxLift, ...wormNodes(visualEnemy!).map((node, i) => node.y - visualGround[i]));
    view.foundryWorms.get(current.enemy.id)!.view!.update(visualEnemy!, clock);
    current.idle.update(clock);
    const idleOrgan = (view.foundryWorms.get(current.enemy.id)!.view as any).lasers[0].quaternion;
    if (Math.abs(time - 2) < 0.00001) idleStart = idleOrgan.toArray();
    if (Math.abs(time - 2.4) < 0.00001) idleEnd = idleOrgan.toArray();
    (view as any).omegaWarning.update([visualEnemy!], clock);
    visualPads = Math.max(visualPads, (view as any).omegaWarning.mesh.count);
  } else current.idle.update(Math.max(0, time - 1.7));`,
  );
  source = replace(
    source,
    "    current.idle.update(0);",
    `    current.idle.update(0);
    if (key === "worm") resetCatenaFilm(current);`,
  );
  source = replace(
    source,
    "      camera: choiceFor(key, current.enemy),",
    `      camera: choiceFor(key, current.enemy),
      catena: key === "worm" ? catenaFilmEvidence() : undefined,`,
  );
  source = replace(
    source,
    "    if (!metadata.worldFrozen || metadata.errors.length)",
    `    if (key === "worm") {
      assertCatenaFilm(metadata.catena!);
    }
    if (!metadata.worldFrozen || metadata.errors.length)`,
  );
  source += `
function assertCatenaFilm(check: ReturnType<typeof catenaFilmEvidence>) {
  if (check.segments !== 14 || check.maxWarningPads !== 15 || check.maxLift < 0.5 || !check.idleAnimated ||
      !["brace", "warn", "flight", "landed"].every((phase) => check.phases.includes(phase)))
    throw Error("CATENA motion check failed: " + JSON.stringify(check));
}
(window as any).__catenaTrial = () => {
  const current = scene!;
  resetCatenaFilm(current);
  const frames = [];
  const picks = new Set([60, 72, 105, 135, 150, 165, 180, 195, 225]);
  const small = document.createElement("canvas"); small.width = 640; small.height = 360;
  const smallCtx = small.getContext("2d")!;
  for (let i = 0; i <= 225; i++) {
    renderAt(current, i / 30);
    if (picks.has(i)) { smallCtx.drawImage(film, 0, 0, 640, 360);
      frames.push({ index: i, image: small.toDataURL("image/png") }); }
  }
  return { frames, check: catenaFilmEvidence(), worldFrozen: JSON.stringify(current.world) === current.frozen };
};
`;
  return source;
}
const server = await createServer({
  configFile: false,
  cacheDir: `${out}/vite-cache`,
  server: { host: "127.0.0.1", port, strictPort: true, hmr: false },
  plugins: [
    {
      name: "catena-local-film-transform",
      enforce: "pre",
      transform(source, id) {
        if (id.replaceAll("\\", "/").endsWith("/scripts/current-encounters.ts"))
          return filmingSource(source);
      },
    },
    {
      name: "catena-local-film-receiver",
      configureServer(vite) {
        vite.middlewares.use("/__current-film", (req, res) => {
          if (
            req.method !== "POST" ||
            req.headers.origin !== origin ||
            req.headers["x-encounter-key"] !== "worm"
          ) {
            res.writeHead(400).end("Invalid local recording");
            return;
          }
          const metadata = JSON.parse(
            decodeURIComponent(req.headers["x-encounter-metadata"]),
          );
          assert.equal(metadata.worldFrozen, true);
          assert.deepEqual(metadata.errors, []);
          assert.equal(metadata.catena.segments, 14);
          assert.equal(metadata.catena.maxWarningPads, 15);
          assert.equal(metadata.catena.idleAnimated, true);
          const chunks = [];
          let bytes = 0;
          req.on("data", (chunk) => {
            chunks.push(chunk);
            bytes += chunk.length;
            if (bytes > 80000000) req.destroy();
          });
          req.on("end", () => {
            const data = Buffer.concat(chunks);
            assert.equal(data.toString("ascii", 0, 4), "DKIF");
            assert.equal(data.toString("ascii", 8, 12), "VP90");
            writeFileSync(`${out}/worm.ivf`, data);
            writeFileSync(
              `${out}/worm.json`,
              JSON.stringify(metadata, null, 2),
            );
            res
              .writeHead(200, { "Content-Type": "application/json" })
              .end(JSON.stringify({ saved: true, bytes: data.length }));
          });
        });
      },
    },
  ],
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({
    channel: "chrome",
    args: ["--use-angle=d3d11"],
  });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
  });
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  await page.goto(`${origin}/scripts/current-encounters.html`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await page.locator("#kind").selectOption("worm");
  await page.waitForFunction(
    () => document.querySelector("#status")?.textContent?.includes("準備完了"),
    null,
    { timeout: 120000 },
  );
  if (mode === "--trial") {
    const trial = await page.evaluate(() => window.__catenaTrial());
    assert.equal(trial.worldFrozen, true);
    assert.equal(trial.check.segments, 14);
    assert.equal(trial.check.maxWarningPads, 15);
    assert.ok(trial.check.maxLift > 0.5);
    for (const frame of trial.frames)
      writeFileSync(
        `${out}/trial-${String(frame.index).padStart(3, "0")}.png`,
        Buffer.from(frame.image.split(",")[1], "base64"),
      );
    writeFileSync(
      `${out}/trial.json`,
      JSON.stringify({ check: trial.check, errors: pageErrors }, null, 2),
    );
    console.log(
      JSON.stringify({ mode, check: trial.check, errors: pageErrors }),
    );
  } else {
    await page.locator("#record").click();
    await page.waitForFunction(
      () => {
        const status = document.querySelector("#status")?.textContent ?? "";
        return (
          status.includes("保存完了") ||
          status.includes("Error") ||
          status.includes("失敗")
        );
      },
      null,
      { timeout: 300000 },
    );
    assert.match(await page.locator("#status").textContent(), /保存完了/);
    assert.deepEqual(pageErrors, []);
    console.log(
      JSON.stringify({
        mode,
        recorded: readFileSync(`${out}/worm.json`, "utf8").length,
        errors: pageErrors,
      }),
    );
  }
} finally {
  await browser?.close();
  await server.close();
}

if (mode === "--record") {
  const metadata = JSON.parse(readFileSync(`${out}/worm.json`, "utf8"));
  assert.equal(metadata.frameCount, 330);
  assert.deepEqual(metadata.catena.phases.slice(-4), [
    "brace",
    "warn",
    "flight",
    "landed",
  ]);
  const ffmpeg = process.env.FFMPEG ?? "ffmpeg";
  const run = (args) => {
    const result = spawnSync(ffmpeg, args, {
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: 8e6,
    });
    assert.equal(result.status, 0, result.stderr || String(result.error));
    return result;
  };
  run([
    "-y",
    "-i",
    `${out}/worm.ivf`,
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
    video,
  ]);
  const decoded = run(["-i", video, "-f", "null", "-"]).stderr;
  assert.match(decoded, /1280x720/);
  assert.match(decoded, /30 fps/);
  const probeResult = spawnSync(
    process.env.FFPROBE ?? "ffprobe",
    [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=width,height,r_frame_rate,nb_frames",
      "-show_entries",
      "format=duration",
      "-of",
      "json",
      video,
    ],
    { encoding: "utf8", windowsHide: true },
  );
  assert.equal(
    probeResult.status,
    0,
    probeResult.stderr || String(probeResult.error),
  );
  const probe = JSON.parse(probeResult.stdout);
  assert.deepEqual(
    [
      probe.streams[0].width,
      probe.streams[0].height,
      probe.streams[0].r_frame_rate,
      probe.streams[0].nb_frames,
      Number(probe.format.duration),
    ],
    [1280, 720, "30/1", "330", 11],
  );
  const idleFrames = run([
    "-i",
    video,
    "-vf",
    "select=eq(n\\,60)+eq(n\\,72)",
    "-fps_mode",
    "passthrough",
    "-f",
    "framemd5",
    "-",
  ])
    .stdout.split(/\r?\n/)
    .filter((line) => /^0,/.test(line));
  assert.equal(idleFrames.length, 2);
  const idleHashes = idleFrames.map((line) => line.split(",").at(-1).trim());
  assert.notEqual(idleHashes[0], idleHashes[1]);
  run([
    "-y",
    "-i",
    video,
    "-vf",
    "fps=1/2,scale=384:216,tile=3x2",
    "-frames:v",
    "1",
    `${evidence}/worm-contact.jpg`,
  ]);
  run([
    "-y",
    "-ss",
    "4.5",
    "-i",
    video,
    "-t",
    "2",
    "-vf",
    "fps=2,scale=384:216,tile=4x1",
    "-frames:v",
    "1",
    `${evidence}/worm-motion-contact.jpg`,
  ]);
  const sha256 = createHash("sha256").update(readFileSync(video)).digest("hex");
  let files = readFileSync(filemap, "utf8");
  const oldWorm =
    /^  worm: "assets\/encounters\/report-v3\/worm-(?:20261015|20261111)\.mp4\?v=[a-f0-9]{12}",$/m;
  assert.match(files, oldWorm);
  files = files.replace(
    oldWorm,
    `  worm: "assets/encounters/report-v3/worm-20261111.mp4?v=${sha256.slice(0, 12)}",`,
  );
  writeFileSync(filemap, files);
  const row = {
    key: "worm",
    name: metadata.name,
    file: video,
    sha256,
    bytes: statSync(video).size,
    duration: Number(probe.format.duration),
    stage: metadata.stage,
    camera: metadata.camera,
    assets: metadata.assets.map((asset) => ({
      file: "public" + new URL(asset.url, origin).pathname,
      sha256: asset.sha256,
    })),
    width: probe.streams[0].width,
    height: probe.streams[0].height,
    fps: Number(probe.streams[0].r_frame_rate.split("/")[0]),
    capture: metadata.capture,
    frameCount: Number(probe.streams[0].nb_frames),
    worldFrozen: metadata.worldFrozen,
    allDecoded: true,
    idleAnimated:
      metadata.catena.idleAnimated && idleHashes[0] !== idleHashes[1],
  };
  writeFileSync(
    `${evidence}/worm-manifest.json`,
    JSON.stringify(
      {
        file: video,
        sha256,
        bytes: statSync(video).size,
        width: 1280,
        height: 720,
        fps: 30,
        duration: 11,
        frameCount: 330,
        metadata,
        sourceScript: "scripts/record-catena-report-20261111.mjs",
        model: metadata.assets,
        oldFilmPreserved:
          "public/assets/encounters/report-v3/worm-20261015.mp4",
        oldFilmReference: "e3b73bd91414",
        idleDecodedFrames: { frames: [60, 72], md5: idleHashes },
        rows: [row],
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      video,
      sha256,
      bytes: statSync(video).size,
      frames: 330,
      checks: metadata.catena,
    }),
  );
}
