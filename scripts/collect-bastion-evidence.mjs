// BASTION（仮称）のレビュー用証拠を docs/evidence/bastion-20261017/ へ集める。
//   node scripts/collect-bastion-evidence.mjs <インストール済みffmpeg.exe>
// 候補フォルダの PNG/動画はローカル専用（.gitignore）なので、ここで JPEG/WebM に
// まとめてコミット対象へ置き、全ファイルの SHA-256 を索引に残す。
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";

const ffmpeg = process.argv[2];
if (!ffmpeg || !existsSync(ffmpeg))
  throw Error("Pass the installed ffmpeg executable path");
const model = "assets/blender/candidates/bastion/model-v1";
const out = "docs/evidence/bastion-20261017";
mkdirSync(out, { recursive: true });
const run = (args) => {
  const r = spawnSync(ffmpeg, ["-y", "-v", "error", ...args], {
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(r.status, 0, r.stderr);
};
const sha = (f) => createHash("sha256").update(readFileSync(f)).digest("hex");

// 1) master の実レンダー（同じカメラ・照明）。
for (const name of ["states_sheet", "views_sheet", "silhouette_sheet"])
  run(["-i", join(model, "renders", `${name}.png`), "-q:v", "3", join(out, `master-${name}.jpg`)]);
// コンセプト（生成画像）と実モデルの並び。上段 concept-v4、下段 master 5状態。
run([
  "-i", "assets/blender/candidates/bastion/concept-v4/concept.png",
  "-i", join(model, "renders", "states_sheet.png"),
  "-filter_complex",
  "[0]scale=2560:-1,pad=2560:ih+16:0:0:color=white[a];[1]scale=2560:-1[b];[a][b]vstack",
  "-q:v", "3", join(out, "concept-vs-master.jpg"),
]);

// 2) 実ゲーム視点の5状態（同じカメラ）。距離12m／7m、横画面2寸法。
const states = ["normal", "hardened", "brace", "warn", "open"];
for (const size of ["1280x720", "844x390"]) {
  const inputs = [];
  for (const d of [12, 7])
    for (const s of states) inputs.push("-i", join(model, "game-view", `pose-${s}-${d}m-${size}.png`));
  const w = size === "1280x720" ? 640 : 422;
  const labels = states.map((_, i) => `[${i}]scale=${w}:-1[a${i}]`).join(";");
  const labels7 = states.map((_, i) => `[${i + 5}]scale=${w}:-1[b${i}]`).join(";");
  run([
    ...inputs,
    "-filter_complex",
    `${labels};${labels7};${states.map((_, i) => `[a${i}]`).join("")}hstack=inputs=5[r1];${states.map((_, i) => `[b${i}]`).join("")}hstack=inputs=5[r2];[r1][r2]vstack`,
    "-q:v", "3", join(out, `game-states-${size}.jpg`),
  ]);
}

// 3) 動作動画（固定30fps）と時刻別フレーム一覧。録画元のVP9 6Mbpsは大きいので、
//    過去の証拠と同じ H.264 MP4（CRF 28、faststart）へ変換してコミットする。
for (const f of readdirSync(join(model, "game-view"))) {
  if (/^motion-.*\.jpg$/.test(f)) copyFileSync(join(model, "game-view", f), join(out, f));
  if (/^motion-.*\.webm$/.test(f))
    run([
      "-i", join(model, "game-view", f),
      "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "28",
      "-pix_fmt", "yuv420p", "-movflags", "+faststart",
      join(out, f.replace(/\.webm$/, ".mp4")),
    ]);
}

// 4) 状態ログ・通信検証・素材の要約。
const capture = JSON.parse(readFileSync(join(model, "game-view", "capture-log.json"), "utf8"));
writeFileSync(join(out, "capture-log.json"), JSON.stringify(capture, null, 1));
if (existsSync("dist-validation/bastion/network.json"))
  copyFileSync("dist-validation/bastion/network.json", join(out, "network.json"));
for (const f of ["game-report.json", "master-report.json"])
  copyFileSync(join(model, f), join(out, f));

const files = readdirSync(out)
  .filter((f) => f !== "evidence-index.json")
  .map((f) => ({ file: f, bytes: statSync(join(out, f)).size, sha256: sha(join(out, f)) }));
const sources = [
  "public/assets/enemies/bastion_v1.glb",
  join(model, "bastion_v1.glb"),
  join(model, "bastion_master.blend"),
  join(model, "bastion_game.blend"),
  join(model, "build_bastion.py"),
].map((f) => ({ file: f, bytes: statSync(f).size, sha256: sha(f) }));
assert.equal(sources[0].sha256, sources[1].sha256, "runtime GLB matches candidate output");
writeFileSync(
  join(out, "evidence-index.json"),
  JSON.stringify({ generated: new Date().toISOString(), ffmpeg: "9.0.1-essentials_build-www.gyan.dev", files, sources }, null, 2),
);
console.log(JSON.stringify({ files: files.length, bytes: files.reduce((n, f) => n + f.bytes, 0) }));
