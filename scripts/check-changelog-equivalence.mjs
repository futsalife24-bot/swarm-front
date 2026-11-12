// 更新履歴の生成器を書き換えた時に、指定commit時点の生成器と現在の生成器が
// 同じ履歴から完全に同じ結果を返すことを確かめる。あわせて所要時間を出す。
// 使い方: node scripts/check-changelog-equivalence.mjs <旧生成器のcommit> [出力JSON]
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { generateChangelog } from "./automatic-changelog.mjs";

const [reference, out] = process.argv.slice(2);
if (!reference) throw new Error("旧生成器のcommitを指定してください");
const git = (...args) =>
  execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "changelog-check-"));
try {
  const file = path.join(directory, "automatic-changelog.mjs");
  fs.writeFileSync(
    file,
    git("show", `${reference}:scripts/automatic-changelog.mjs`),
  );
  const old = await import(pathToFileURL(file).href);
  const timed = (run) => {
    const started = performance.now();
    const value = run();
    return { value, seconds: (performance.now() - started) / 1000 };
  };
  const before = timed(() => old.generateChangelog(process.cwd()));
  const after = timed(() => generateChangelog(process.cwd()));
  assert.deepEqual(after.value, before.value);
  const result = {
    reference: git("rev-parse", reference).trim(),
    head: git("rev-parse", "HEAD").trim(),
    releases: after.value.length,
    items: after.value.reduce((sum, day) => sum + day.items.length, 0),
    sha256: createHash("sha256")
      .update(JSON.stringify(after.value))
      .digest("hex"),
    identical: true,
    secondsBefore: Number(before.seconds.toFixed(2)),
    secondsAfter: Number(after.seconds.toFixed(2)),
  };
  if (out) fs.writeFileSync(out, JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(result, null, 2));
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}
