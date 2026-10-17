// BASTION（仮称）の実ゲーム視点の静止画・動作動画・状態ログを撮る。
// 前提: worktreeで `npx vite --host 127.0.0.1 --port 5196 --strictPort` を起動済み。
//   node scripts/capture-bastion.mjs <インストール済みffmpeg.exe> [出力先]
// 動画は検証ページの record()（1/30秒ずつ step と描画を進める WebCodecs VP9）で作るので、
// ソフトウェア描画が遅くても実時間どおりの速さになる。ffmpeg は IVF→WebM の詰め替えと
// 全フレームのデコード確認・時刻別フレーム一覧の作成だけに使う。
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync, existsSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";

const ffmpeg = process.argv[2];
if (!ffmpeg || !existsSync(ffmpeg))
  throw Error("Pass the installed ffmpeg executable path");
const base = process.env.BASTION_PREVIEW ?? "http://127.0.0.1:5196";
const out =
  process.argv[3] ?? "assets/blender/candidates/bastion/model-v1/game-view";
const raw = "dist-validation/bastion/raw";
mkdirSync(out, { recursive: true });
mkdirSync(raw, { recursive: true });
const run = (args) => {
  const r = spawnSync(ffmpeg, args, { encoding: "utf8", windowsHide: true, maxBuffer: 1e8 });
  assert.equal(r.status, 0, r.stderr);
  return r.stderr;
};
const sha = (f) => createHash("sha256").update(readFileSync(f)).digest("hex");
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const log = {
  base,
  glb: sha("public/assets/enemies/bastion_v1.glb"),
  views: [],
  videos: [],
  errors: [],
  failedResources: [],
};

async function open(context, size) {
  const page = await context.newPage();
  await page.setViewportSize(size);
  page.on("pageerror", (e) => log.errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && log.errors.push(m.text()));
  await page.goto(base + "/scripts/bastion-preview.html", { timeout: 240000 });
  await page.waitForFunction(
    () => document.getElementById("status")?.textContent?.includes("GLB loaded"),
    null,
    { timeout: 120000 },
  );
  // 読込失敗した資源（URLと状態）を記録する。
  log.failedResources.push(
    ...(await page.evaluate(() =>
      performance
        .getEntriesByType("resource")
        .filter((e) => e.responseStatus >= 400)
        .map((e) => `${e.responseStatus} ${e.name}`),
    )),
  );
  await page.click("#hide");
  return page;
}
const status = (page) =>
  page.evaluate(() => JSON.parse(document.getElementById("status").textContent));

// 1) 静止: 同じカメラ・照明で5状態。標準距離12mと近距離7m、横画面2寸法。
//    姿勢と発光の補間は固定の描画時間（3秒）で落ち着かせてから撮る。
if (process.env.STILLS !== "0")
  for (const size of [
    { width: 1280, height: 720 },
    { width: 844, height: 390 },
  ]) {
    const context = await browser.newContext();
    const page = await open(context, size);
    for (const distance of [12, 7]) {
      for (const pose of ["normal", "hardened", "brace", "warn", "open"]) {
        const shot = await page.evaluate(
          ([p, d]) => window.__bastion.still(p, d),
          [pose, distance],
        );
        const file = `pose-${pose}-${distance}m-${size.width}x${size.height}.png`;
        writeFileSync(join(out, file), Buffer.from(shot.png.split(",")[1], "base64"));
        log.views.push({ file, pose, distance, size, view: shot.view, lanes: shot.lanes });
      }
    }
    await context.close();
  }

// 2) 動作: 実 step・実 Renderer の決定的な録画。
const SCENES = [
  ["smg", 12, "SMG連射：硬化→予備動作→赤予告→斉射→開放→回復→再硬化"],
  ["rifle", 12, "AR連射"],
  ["burst", 12, "AR断続（0.36秒撃って1.44秒休む）"],
  ["sniper", 6, "単発（スナイパー）：連続にならず硬化しない"],
  ["shotgun", 6, "散弾：1発ごとに最大1段まで"],
  ["multi", 12, "3体：硬化・照準弾は個体ごと"],
  ["dodge", 5, "赤予告を見てレーンの隙間へ横移動"],
  ["hit", 5, "レーン上に立ったまま被弾"],
  ["pause", 4, "赤予告中に1秒間一時停止（世界の時刻・弾・予告が止まる）"],
  ["death", 5, "予備動作中に撃破→発射なし→再出現は硬化0"],
];
for (const [mode, seconds, label] of SCENES) {
  const context = await browser.newContext();
  const page = await open(context, { width: 1280, height: 720 });
  const result = await page.evaluate(
    ([m, s, l]) => window.__bastion.record(m, s, l),
    [mode, seconds, label],
  );
  await context.close();
  assert.equal(result.frames, seconds * 30, `${mode}: frame count`);
  const ivf = join(raw, `motion-${mode}.ivf`);
  writeFileSync(ivf, Buffer.from(result.ivf, "base64"));
  const webm = join(out, `motion-${mode}.webm`);
  run(["-y", "-v", "error", "-i", ivf, "-c:v", "copy", "-an", webm]);
  // 全フレームを実際にデコードして数を照合する。
  const decoded = run(["-v", "info", "-i", webm, "-map", "0:v", "-f", "null", "-"]);
  const frames = Number([...decoded.matchAll(/frame=\s*(\d+)/g)].at(-1)?.[1]);
  assert.equal(frames, seconds * 30, `${mode}: decoded frames`);
  // 時刻別のフレーム一覧（15枚）。
  const sheet = join(out, `motion-${mode}-sheet.jpg`);
  run([
    "-y", "-v", "error", "-i", webm,
    "-vf", `fps=15/${seconds},scale=384:-1,tile=5x3`,
    "-frames:v", "1", "-q:v", "4", sheet,
  ]);
  log.videos.push({
    file: `motion-${mode}.webm`,
    sheet: `motion-${mode}-sheet.jpg`,
    mode,
    seconds,
    label,
    frames,
    bytes: statSync(webm).size,
    sha256: sha(webm),
    samples: result.samples,
    pageErrors: result.errors,
  });
  console.log(mode, frames, "frames");
}
await browser.close();
writeFileSync(join(out, "capture-log.json"), JSON.stringify(log, null, 1));
console.log(
  JSON.stringify(
    {
      views: log.views.length,
      videos: log.videos.map((v) => `${v.file} ${v.frames}f ${v.bytes}B`),
      errors: log.errors,
      failedResources: [...new Set(log.failedResources)],
    },
    null,
    1,
  ),
);
