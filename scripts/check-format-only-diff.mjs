// 整形だけのつもりの差分が、空白・改行・括弧の位置以外を変えていないことを確かめる。
// 基準commitと作業ツリーの各ファイルを esbuild で空白除去し、出力が同一かを比べる。
// 使い方: node scripts/check-format-only-diff.mjs <基準commit> <ファイル...>
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { transform } from "esbuild";

const [base, ...files] = process.argv.slice(2);
if (!base || !files.length)
  throw new Error("基準commitと対象ファイルを指定してください");
const sha = (text) => createHash("sha256").update(text).digest("hex");
const results = [];
for (const file of files) {
  const loader = file.endsWith(".css") ? "css" : "ts";
  const normalize = async (source) =>
    (
      await transform(source, {
        loader,
        // CSSは数値表記（.28em と 0.28em）も整形で変わるため、値まで正規化する。
        ...(loader === "css" ? { minify: true } : { minifyWhitespace: true }),
        charset: "utf8",
      })
    ).code;
  const before = execFileSync("git", ["show", `${base}:${file}`], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const after = fs.readFileSync(file, "utf8");
  const [a, b] = [await normalize(before), await normalize(after)];
  results.push({
    file,
    sourceChanged: before !== after,
    normalizedSha256: sha(b),
    identical: a === b,
  });
}
console.log(JSON.stringify({ base, results }, null, 2));
if (results.some((r) => !r.identical)) {
  console.error("空白以外の差分があります");
  process.exit(1);
}
