import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const base = "206f000b857844f2fc4d284a02f4bac75e748ead",
  head = git("rev-parse", "HEAD");
const root = `dist-validation/continuity-audit-${head.slice(0, 7)}`;
fs.mkdirSync(root, { recursive: true });
const files = git(
  "ls-files",
  "src",
  "server",
  "tests",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "tsconfig.worker.json",
  "vite.config.ts",
  "vitest*.ts",
  "wrangler.production.jsonc",
  "index.html",
  "AGENTS.md",
  "docs/WORKFLOW.md",
  "docs/PLAYER-CONTINUITY-DEFENSE.md",
  "docs/SwarmFront_grilling_playtest_spec_v1.md",
  "scripts/check-continuity-ui.mjs",
  "scripts/check-cloud-client.mjs",
  "scripts/check-cloud-vault.mjs",
  "scripts/check-daily-defense.mjs",
  "scripts/check-battle-checkpoint.mjs",
).split(/\r?\n/);
files.push(
  ...git(
    "ls-files",
    "assets/blender/source/defense",
    "assets/blender/scripts/build_defense_assets.py",
    "public/assets/maps/*v2.glb",
    "docs/DEFENSE-ART-V2.md",
    "docs/evidence/defense-art-v2",
    "scripts/check-defense-environments.mjs",
  ).split(/\r?\n/),
);
for (const file of files.filter(Boolean)) {
  const dest = path.join(root, file);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(file, dest);
}
for (const dir of [
  "continuity-ui",
  "continuity-ui-win",
  "cloud-client",
  "cloud-vault",
  "daily-defense",
  "battle-checkpoint",
  "defense-environments",
]) {
  const source = `dist-validation/${dir}`;
  if (fs.existsSync(source)) {
    const destination = path.join(root, "evidence", dir);
    fs.mkdirSync(destination, { recursive: true });
    for (const file of fs.readdirSync(source)) {
      if (fs.statSync(path.join(source, file)).isFile())
        fs.copyFileSync(path.join(source, file), path.join(destination, file));
    }
  }
}
// Binary originals are included directly, rather than inflated git binary patches.
fs.writeFileSync(
  path.join(root, "changes.patch"),
  execFileSync("git", ["diff", base, head], {
    encoding: "utf8",
    maxBuffer: 10_000_000,
  }),
);
fs.writeFileSync(
  path.join(root, "AUDIT.txt"),
  `Swarm Front PR32\nBASE ${base}\nHEAD ${head}\nUncommitted: ${git("status", "--porcelain")}\nEvidence: real Chrome and local Worker SQLite, no API mock. Victory/defeat UI uses DEV-only terminal-condition fixture, not balance testing. Current art change: typecheck, playtest 51 tests, both builds, six environments/flat-ground ray checks and daily model-download failure/retry passed. Earlier continuity checks: affected core 68 tests and production dry-run passed. New Blender originals and runtime GLBs are included. References and regeneration requirements: docs/DEFENSE-ART-V2.md. Older continuity cinematic images show the previous procedural art; defense-art-v2 and defense-environments contain current model evidence. Real mobile, full 3-minute balance, browser-closed co-op reconnect not tested. Prior base dashboard direct-main changes not independently audited; this PR does not certify them. See docs/PLAYER-CONTINUITY-DEFENSE.md.\n`,
);
console.log(root);
