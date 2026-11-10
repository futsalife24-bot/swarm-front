// Compare named step scenarios against the clean PR297 worktree, tick by tick.
// The original test and its snapshots are read only. Generated modules are
// removed after each run and never used to update snapshots.
import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
} from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";

const names = process.argv.slice(2);
assert.ok(names.length, "対象のシナリオ名を明示してください");
const baseRoot = resolve("../task-resume-support-rewards-20261110");
const baseHead = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: baseRoot,
  encoding: "utf8",
}).trim();
assert.equal(baseHead, "aca371023cbb1db5dbf68ee0364b688f45bfb676");
const currentHead = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
const root = resolve(".");
const out = resolve("docs/evidence/catena-resume-20261110/tmp/step-causality");
const resultPath = resolve(
  "docs/evidence/catena-resume-20261110/step-causality.json",
);
const generated = resolve("scripts/.catena-step-trace.test.ts");
const config = resolve("scripts/.catena-step-trace.config.ts");
const currentSource = readFileSync(
  "tests/game-step-equivalence.test.ts",
  "utf8",
);
const baseSource = readFileSync(
  resolve(baseRoot, "tests/game-step-equivalence.test.ts"),
  "utf8",
);
mkdirSync(out, { recursive: true });

function instrument(source, prefix) {
  const start = source.lastIndexOf("it.each(Object.keys(scenarios))(");
  assert.ok(start > 0, "stepシナリオの末尾が変わりました");
  let body = source.slice(0, start).replaceAll('"../src/', `"${prefix}`);
  const original = "    hash.update(canonical(state()));";
  assert.ok(body.includes(original), "tick直列化の位置が変わりました");
  body = body.replace(
    original,
    `    const live = state();
    const encoded = canonical(live);
    const trace = (globalThis as any).__catenaTrace;
    if (trace) {
      trace.hashes.push(createHash("sha256").update(encoded).digest("hex"));
      if (trace.captureTick === tick) trace.capture = inspect(live);
    }
    hash.update(encoded);`,
  );
  return `import { writeFileSync } from "node:fs";\n${body}
function inspect(value: unknown, ancestors: unknown[] = []): unknown {
  if (value === undefined) return { __kind: "undefined" };
  if (typeof value === "number" && !Number.isFinite(value))
    return { __number: String(value) };
  if (Object.is(value, -0)) return { __number: "-0" };
  if (value === null || typeof value !== "object") return value;
  const seen = ancestors.indexOf(value);
  if (seen >= 0) return { __cycle: ancestors.length - seen };
  ancestors.push(value);
  const result = Array.isArray(value)
    ? value.map((item) => inspect(item, ancestors))
    : Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, inspect(item, ancestors)]),
      );
  ancestors.pop();
  return result;
}
const traceNames: string[] = JSON.parse(process.env.CATENA_TRACE_NAMES ?? "[]");
it.each(traceNames)("CATENA tick trace: %s", (name) => {
  const trace = { hashes: [] as string[], captureTick: Number(process.env.CATENA_TRACE_CAPTURE ?? -1), capture: undefined as unknown };
  (globalThis as any).__catenaTrace = trace;
  const summary = scenarios[name]();
  (globalThis as any).__catenaTrace = undefined;
  writeFileSync(process.env.CATENA_TRACE_OUT!, JSON.stringify({ name, summary, ...trace }) + "\\n", { flag: "a" });
});
`;
}

writeFileSync(
  config,
  `import { defineConfig } from "vitest/config";
export default defineConfig({
  cacheDir: ${JSON.stringify(resolve(out, "vite-cache"))},
  server: { fs: { allow: [${JSON.stringify(root)}, ${JSON.stringify(baseRoot)}] } },
  test: { include: ["scripts/.catena-step-trace.test.ts"], fileParallelism: false, testTimeout: 120000 },
});
`,
);

function run(variant, selected, captureTick = -1) {
  const source = variant === "base" ? baseSource : currentSource;
  const prefix =
    variant === "base"
      ? "../../task-resume-support-rewards-20261110/src/"
      : "../src/";
  writeFileSync(generated, instrument(source, prefix));
  const tag = `${variant}-${captureTick < 0 ? "all" : `tick-${captureTick}`}`;
  const dataPath = resolve(out, `${tag}.jsonl`);
  const logPath = resolve(out, `${tag}.log`);
  writeFileSync(dataPath, "");
  const child = spawnSync(
    process.execPath,
    [
      resolve("node_modules/vitest/vitest.mjs"),
      "run",
      "--config",
      config,
      generated,
    ],
    {
      cwd: root,
      env: {
        ...process.env,
        CATENA_TRACE_NAMES: JSON.stringify(selected),
        CATENA_TRACE_CAPTURE: String(captureTick),
        CATENA_TRACE_OUT: dataPath,
      },
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
      timeout: 240000,
    },
  );
  writeFileSync(logPath, (child.stdout ?? "") + (child.stderr ?? ""));
  if (child.status !== 0)
    throw Error(`${tag} の追跡失敗: ${logPath} / exit ${child.status}`);
  return readFileSync(dataPath, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function firstField(a, b, path = "$", depth = 0) {
  if (Object.is(a, b)) return undefined;
  if (depth > 80 || !a || !b || typeof a !== "object" || typeof b !== "object")
    return { path, base: a, candidate: b };
  const left = Object.keys(a),
    right = Object.keys(b);
  for (const key of new Set([...left, ...right])) {
    if (!(key in a) || !(key in b))
      return { path: `${path}.${key}`, base: a[key], candidate: b[key] };
    const found = firstField(a[key], b[key], `${path}.${key}`, depth + 1);
    if (found) return found;
  }
  if (left.join("\0") !== right.join("\0"))
    return { path, base: left, candidate: right, reason: "key-order" };
  return undefined;
}

try {
  const baseline = new Map(run("base", names).map((item) => [item.name, item]));
  const candidate = new Map(
    run("candidate", names).map((item) => [item.name, item]),
  );
  const comparisons = [];
  for (const name of names) {
    const a = baseline.get(name),
      b = candidate.get(name);
    assert.ok(a && b, `追跡がありません: ${name}`);
    const tick = a.hashes.findIndex((hash, i) => hash !== b.hashes[i]);
    let field;
    if (tick >= 0) {
      const old = run("base", [name], tick)[0];
      const current = run("candidate", [name], tick)[0];
      field = firstField(old.capture, current.capture);
    }
    comparisons.push({
      scenario: name,
      firstDivergentTick: tick,
      field,
      baseline: a.summary,
      candidate: b.summary,
    });
  }
  writeFileSync(
    resultPath,
    JSON.stringify(
      {
        baseHead,
        currentHead,
        comparisons: [
          ...(existsSync(resultPath)
            ? JSON.parse(readFileSync(resultPath, "utf8")).comparisons.filter(
                (item) => !names.includes(item.scenario),
              )
            : []),
          ...comparisons,
        ],
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ baseHead, currentHead, comparisons }));
} finally {
  unlinkSync(generated);
  unlinkSync(config);
}
