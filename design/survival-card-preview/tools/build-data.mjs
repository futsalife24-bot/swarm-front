// export-card-data.ts を esbuild で一時的に束ね、cards-data.js（classic script）を生成する。
// 実行（リポジトリのルートで）: node design/survival-card-preview/tools/build-data.mjs
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "survival-card-data-"));
const bundle = path.join(tmp, "export.mjs");
try {
  await build({
    entryPoints: [path.join(here, "export-card-data.ts")],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: bundle,
    loader: { ".css": "empty" },
    define: {
      "import.meta.env.BASE_URL": '"/"',
      "import.meta.env.DEV": "false",
    },
    logLevel: "warning",
  });
  const json = execFileSync(process.execPath, [bundle], { encoding: "utf8" });
  const data = JSON.parse(json);
  const out = path.join(here, "..", "cards-data.js");
  fs.writeFileSync(
    out,
    `// 生成ファイル（tools/build-data.mjs）。手で編集しない。出典: ${data.source}\nwindow.SURVIVAL_CARD_DATA = ${JSON.stringify(data, null, 1)};\n`,
  );
  console.log(`cards-data.js: ${data.cards.length}枚`);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
