import { createServer } from "vite";
import fs from "node:fs";
import path from "node:path";
import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";

const started = performance.now();
const out = `dist-validation/save-regression/${new Date().toISOString().replace(/[:.]/g, "-")}`;
fs.mkdirSync(out, { recursive: true });
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
function sourceHashes() {
  const files = git("ls-files", "src", "server").split("\n");
  files.push(
    "scripts/check-save-safety.mjs",
    "scripts/check-battle-checkpoint.mjs",
    "scripts/check-save-fixtures.mjs",
    "scripts/check-recovery-receipts.mjs",
    "scripts/run-save-regression.mjs",
  );
  for (const file of fs.readdirSync("tests/fixtures/save-regression"))
    files.push(`tests/fixtures/save-regression/${file}`);
  return Object.fromEntries(
    files.map((file) => [
      file,
      createHash("sha256").update(fs.readFileSync(file)).digest("hex"),
    ]),
  );
}
const results = {
  startedAt: new Date().toISOString(),
  head: git("rev-parse", "HEAD"),
  status: git("status", "--short"),
  node: process.version,
  platform: process.platform,
  sources: sourceHashes(),
  commands: [],
  passed: false,
};
let server;
try {
  // Allocate an isolated loopback port; never reuse another task's dev server.
  server = await createServer({
    server: { host: "127.0.0.1", port: 0, strictPort: true },
    clearScreen: false,
  });
  await server.listen();
  const origin = server.resolvedUrls.local[0].replace(/\/$/, "");
  results.origin = origin;
  for (const [name, script] of [
    ["safety", "scripts/check-save-safety.mjs"],
    ["fixtures", "scripts/check-save-fixtures.mjs"],
    ["receipts", "scripts/check-recovery-receipts.mjs"],
    ["checkpoint", "scripts/check-battle-checkpoint.mjs"],
  ]) {
    const caseOut = `${out}/${name}`;
    fs.mkdirSync(caseOut, { recursive: true });
    const logFile = `${out}/${name}.log`;
    const fd = fs.openSync(logFile, "w");
    const before = performance.now();
    let code;
    try {
      code = await new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [script, origin, caseOut], {
          stdio: ["ignore", fd, fd],
          windowsHide: true,
        });
        child.once("error", reject);
        child.once("exit", resolve);
      });
    } finally {
      fs.closeSync(fd);
    }
    results.commands.push({
      script,
      exit: code,
      seconds: (performance.now() - before) / 1000,
      log: logFile,
    });
    console.log(
      `${name}: ${code === 0 ? "PASS" : "FAIL"} (${results.commands.at(-1).seconds.toFixed(1)}s)`,
    );
    if (code !== 0) {
      console.error(fs.readFileSync(logFile, "utf8").slice(-6000));
      throw Error(`${name} failed: ${code}`);
    }
  }
  if (JSON.stringify(sourceHashes()) !== JSON.stringify(results.sources))
    throw Error("Source changed during browser checks");
  if (git("rev-parse", "HEAD") !== results.head)
    throw Error("HEAD changed during browser checks");
  results.passed = true;
} catch (error) {
  results.failure = String(error.stack || error);
  process.exitCode = 1;
} finally {
  if (server) await server.close();
  results.finishedAt = new Date().toISOString();
  results.seconds = (performance.now() - started) / 1000;
  fs.writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
  console.log(`Evidence: ${path.resolve(out)}`);
}
