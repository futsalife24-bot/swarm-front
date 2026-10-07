import { startVitest } from "vitest/node";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const out = resolve("dist-validation/cave-foundry-release-20261007");
mkdirSync(out, { recursive: true });
const targets = [
  "tests/maps-adopted-spawns.test.ts",
  "tests/foundry-generation.test.ts",
  "tests/foundry-movement.test.ts",
  "tests/hornet.test.ts",
  "tests/enemy-size.test.ts",
  "tests/terrain.test.ts",
  "tests/game.test.ts",
];
const reporter = {
  onUserConsoleLog(log) {
    const prefix = "ADOPTED_MAP_TRACE ";
    if (!log.content.startsWith(prefix)) return;
    writeFileSync(
      resolve(out, "observations.json"),
      log.content.slice(prefix.length).trim() + "\n",
    );
  },
};
let ctx;
try {
  ctx = await startVitest(
    targets,
    {
      config: "vitest.config.ts",
      run: true,
      watch: false,
      reporters: ["default", "json", reporter],
      outputFile: resolve(out, "result.json"),
    },
    { test: { include: targets } },
  );
  const files = ctx.state.getFiles();
  process.exitCode =
    files.length === targets.length &&
    !ctx.state.getCountOfFailedTests() &&
    !ctx.state.getUnhandledErrors().length
      ? 0
      : 1;
} finally {
  if (ctx) await ctx.close();
}
