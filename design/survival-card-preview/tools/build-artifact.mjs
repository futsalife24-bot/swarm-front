// スマホで見るための公開版を書き出す（claude.aiの非公開ページ用）。ゲームのファイルは読むだけで変更しない。
// 実行（リポジトリのルートで）:
//   node design/survival-card-preview/tools/build-artifact.mjs --out <出力先> [--ffmpeg <ffmpeg.exeの場所>]
// 出力先には次を置く。
//   index.html … 公開先が文書の骨組みを足すので、head/body を持たない本文だけ
//   card.css / preview.css / artifact.css / *.js / assets/ … プレビュー本体の写し
//   upgrades/ … 既存のカード画像を縮小したもの（1枚256px、融合の切り出し画像は768px）。元は1〜2MBのものがある。
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const preview = path.resolve(here, "..");
const root = path.resolve(preview, "../..");
const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i < 0 ? null : process.argv[i + 1];
};
const out = path.resolve(
  arg("--out") || path.join(os.tmpdir(), "survival-card-artifact"),
);
const ffmpeg = arg("--ffmpeg") || process.env.FFMPEG || "ffmpeg";

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, "assets"), { recursive: true });
fs.mkdirSync(path.join(out, "upgrades"), { recursive: true });

// 画面幅の @media を #app の大きさで判定する @container stage に置き換える（artifact.css の説明を参照）。
// 動きを減らす設定などの @media は残す。置き換え漏れがあれば止める。
for (const f of ["card.css", "preview.css"]) {
  const css = fs
    .readFileSync(path.join(preview, f), "utf8")
    .replace(
      /@media \(max-width: (\d+)px\), \(max-height: (\d+)px\)/g,
      "@container stage (max-width: $1px) or (max-height: $2px)",
    )
    .replace(/@media \(max-width: (\d+)px\)/g, "@container stage (max-width: $1px)");
  const left = css.match(/@media[^{]*(width|height)[^{]*\{/g);
  if (left) throw new Error(`${f}: 置き換えていない @media があります: ${left}`);
  fs.writeFileSync(path.join(out, f), css);
}
for (const f of [
  "artifact.css",
  "card.js",
  "preview.js",
  "samples.js",
  "cards-data.js",
  "assets/battle-backdrop.jpg",
])
  fs.copyFileSync(path.join(preview, f), path.join(out, f));

const icons = path.join(root, "public/rebuild/upgrades");
for (const f of fs.readdirSync(icons).filter((n) => n.endsWith(".png"))) {
  const size = f === "fusion-atlas.png" ? 768 : 256;
  execFileSync(
    ffmpeg,
    [
      "-v",
      "error",
      "-y",
      "-i",
      path.join(icons, f),
      "-vf",
      `scale='min(${size},iw)':-2:flags=lanczos`,
      path.join(out, "upgrades", f),
    ],
    { stdio: "inherit" },
  );
}

const page = `<title>生存カード デザインプレビュー</title>
<link rel="stylesheet" href="card.css">
<link rel="stylesheet" href="preview.css">
<link rel="stylesheet" href="artifact.css">
<div id="app"></div>
<div id="pv-portrait" role="dialog" aria-modal="true" aria-label="横向きの案内" aria-describedby="pv-portrait-guide">
  <strong>SWARM FRONT</strong>
  <p id="pv-portrait-guide">端末を横向きにしてご覧ください</p>
  <button type="button" data-view="rotate">画面を回して横で見る</button>
  <button type="button" data-view="portrait">縦のまま見る</button>
  <small>ゲーム画面（横画面）の写しです。アプリなどで画面が回らないときは「画面を回して横で見る」を押し、端末を左に倒して横にしてください。</small>
</div>
<script>
  document.documentElement.lang = "ja";
  window.SC_PREVIEW = { iconBase: "upgrades/", syncUrl: false };
</script>
<script src="cards-data.js"></script>
<script src="samples.js"></script>
<script src="card.js"></script>
<script src="preview.js"></script>
<script>
  document.querySelectorAll("#pv-portrait [data-view]").forEach(function (b) {
    b.addEventListener("click", function () {
      document.body.dataset.view = b.dataset.view;
    });
  });
</script>
`;
fs.writeFileSync(path.join(out, "index.html"), page);

// 確認用：公開先と同じ骨組みを足した版（ローカルのブラウザーで開く）。公開には使わない。
fs.writeFileSync(
  path.join(out, "local.html"),
  `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style></head><body>\n${page}</body></html>\n`,
);

const total = (dir) =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .reduce(
      (s, e) =>
        s +
        (e.isDirectory()
          ? total(path.join(dir, e.name))
          : fs.statSync(path.join(dir, e.name)).size),
      0,
    );
console.log(`${out}  ${(total(out) / 1024 / 1024).toFixed(2)} MB`);
