import { build } from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const result = await build({
  entryPoints: ["scripts/pixel-impact-preview.ts"],
  bundle: true,
  format: "iife",
  platform: "browser",
  write: false,
});
const html = await readFile("pixel-impact-preview.html", "utf8");
const model = await readFile("public/assets/enemies/hound_motion_v1.glb");
const script = `window.previewModel = ${JSON.stringify(model.toString("base64"))};\n${result.outputFiles[0].text}`;
const standalone = html.replace(
  '<script type="module" src="/scripts/pixel-impact-preview.ts"></script>',
  `<script>${script.replaceAll("</script", "<\\/script")}</script>`,
);
if (standalone === html)
  throw new Error("プレビューのスクリプト入口が見つかりません");
await mkdir("output/pixel-impact-preview", { recursive: true });
await writeFile("output/pixel-impact-preview/comparison.html", standalone);
console.log("output/pixel-impact-preview/comparison.html");
