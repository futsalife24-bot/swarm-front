import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const out = join(root, "dist-validation", "coop-comfort-regression");
const oldProjectile = "3e1dc640e15d747cc2a06ac72c59833db2072f74";
const oldOmission = "7c33c877ff87e4ca18043d902c14bb316d7e3067";
const cases = [
  {
    name: "projectile-before",
    revision: oldProjectile,
    paths: ["src/shared"],
    test: "player-projectile-pressure",
  },
  {
    name: "omission-before",
    revision: oldOmission,
    paths: ["src/shared", "src/client"],
    test: "coop-comfort-regression",
  },
];
const vitest = join(root, "node_modules", "vitest", "vitest.mjs");
const env = { ...process.env };

function git(...args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" });
}

function run(name, file) {
  const json = join(out, `${name}.json`);
  const config = join(out, `${name}.config.mjs`);
  writeFileSync(
    config,
    `export default { test: { include: [${JSON.stringify(file.replaceAll("\\", "/"))}], fileParallelism: false } };\n`,
  );
  const result = spawnSync(
    process.execPath,
    [
      vitest,
      "run",
      "--config",
      config,
      "--maxWorkers=1",
      "--reporter=json",
      `--outputFile=${json}`,
    ],
    {
      cwd: root,
      env,
      encoding: "utf8",
      timeout: 120000,
    },
  );
  if (result.error) throw result.error;
  writeFileSync(join(out, `${name}.log`), `${result.stdout}\n${result.stderr}`);
  return { exitCode: result.status, json: relative(root, json) };
}

mkdirSync(out, { recursive: true });
const results = [];
for (const item of cases) {
  const dir = join(out, item.name);
  for (const prefix of item.paths) {
    const paths = git("ls-tree", "-r", "--name-only", item.revision, prefix)
      .trim()
      .split("\n")
      .filter((path) => path.endsWith(".ts"));
    for (const path of paths) {
      const destination = join(dir, path);
      mkdirSync(dirname(destination), { recursive: true });
      writeFileSync(
        destination,
        execFileSync("git", ["show", `${item.revision}:${path}`], {
          cwd: root,
        }),
      );
    }
  }
  const testPath = join("tests", `${item.test}.test.ts`);
  const destination = join(dir, testPath);
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(join(root, testPath), destination);
  results.push({
    name: item.name,
    revision: item.revision,
    ...run(item.name, relative(root, destination)),
  });
}
for (const name of ["projectile", "omission"]) {
  const testPath = `tests/${name === "projectile" ? "player-projectile-pressure" : "coop-comfort-regression"}.test.ts`;
  results.push({
    name: `${name}-current`,
    revision: git("rev-parse", "HEAD").trim(),
    ...run(`${name}-current`, testPath),
  });
}
writeFileSync(
  join(out, "summary.json"),
  JSON.stringify(results, null, 2) + "\n",
);
for (const result of results)
  console.log(`${result.name}: exit=${result.exitCode}, ${result.json}`);
if (
  results.some(
    (result) => result.name.endsWith("current") && result.exitCode !== 0,
  ) ||
  results.some(
    (result) => result.name.endsWith("before") && result.exitCode === 0,
  )
)
  process.exitCode = 1;
