import { startVitest } from "vitest/node";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
if (resolve(process.cwd()) !== root)
  throw Error("リポジトリのルートから実行してください");
const target = "tests/maps-adopted-spawns.test.ts";
const out = resolve(root, "dist-validation/adopted-map-spawns-20261007");
const marker = resolve(out, "execution.json");
if (existsSync(marker))
  throw Error("今回の有限実行は既に開始済みです。反復しません");
mkdirSync(out, { recursive: true });
const sha256 = (path) =>
  createHash("sha256").update(readFileSync(path)).digest("hex");
const record = {
  startedAt: new Date().toISOString(),
  head: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  productBase: "1c2f4ba44348ab95558ca0362f4f50a561e900d0",
  target,
  candidateSha256: sha256(target),
  originalMapsSha256: sha256("tests/maps.test.ts"),
  existingConfigSha256: sha256("vitest.config.ts"),
  platform: process.platform,
  node: process.version,
  vitest: JSON.parse(readFileSync("node_modules/vitest/package.json", "utf8"))
    .version,
  invocationCount: 1,
  selection:
    "既存vitest.config.tsを使用。実行時includeとファイルフィルターだけを候補1ファイルに指定。",
  status: "running",
};
const save = () =>
  writeFileSync(marker, JSON.stringify(record, null, 2) + "\n");
save();
const observationReporter = {
  onUserConsoleLog(log) {
    const prefix = "ADOPTED_MAP_TRACE ";
    if (!log.content.startsWith(prefix)) return;
    const value = JSON.parse(log.content.slice(prefix.length).trim());
    writeFileSync(
      resolve(out, "observations.json"),
      JSON.stringify(value, null, 2) + "\n",
    );
  },
};
let context;
try {
  context = await startVitest(
    [target],
    {
      config: "vitest.config.ts",
      run: true,
      watch: false,
      reporters: ["default", "json", observationReporter],
      outputFile: resolve(out, "result.json"),
    },
    { test: { include: [target] } },
  );
  record.resolved = {
    testTimeout: context.config.testTimeout,
    fileParallelism: context.config.fileParallelism,
    environment: context.config.environment,
    include: context.config.include,
  };
  const result = JSON.parse(readFileSync(resolve(out, "result.json"), "utf8"));
  record.files = result.testResults.map(({ name }) => name);
  record.success = result.success;
  record.status = result.success ? "passed" : "failed";
  process.exitCode = result.success ? 0 : 1;
  if (record.files.length !== 1 || !record.files[0].endsWith(target)) {
    record.status = "unexpected-selection";
    process.exitCode = 2;
  }
} catch (error) {
  record.status = "error";
  record.error = String(error);
  process.exitCode = 2;
  console.error(error);
} finally {
  if (context) await context.close();
  record.finishedAt = new Date().toISOString();
  record.exitCode = process.exitCode ?? 0;
  record.candidateUnchanged = sha256(target) === record.candidateSha256;
  record.originalMapsUnchanged =
    sha256("tests/maps.test.ts") === record.originalMapsSha256;
  record.existingConfigUnchanged =
    sha256("vitest.config.ts") === record.existingConfigSha256;
  save();
}
