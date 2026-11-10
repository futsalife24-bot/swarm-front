// Update only the four named CATENA scenario snapshots after baseline causality.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";

const evidencePath = "docs/evidence/catena-resume-20261110/step-causality.json";
const snapshotPath = "tests/__snapshots__/game-step-equivalence.test.ts.snap";
const names = [
  "通常・2人・WORMの波",
  "通常・全種を直接配置",
  "通常・高低差・全種を直接配置",
  "通常・洞窟・全種を直接配置",
];
const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));
assert.equal(evidence.baseHead, "aca371023cbb1db5dbf68ee0364b688f45bfb676");
let source = readFileSync(snapshotPath, "utf8");

for (const comparison of evidence.comparisons) {
  const marker = `exports[\`step は同一seed・同一入力で毎tick同じ状態になる: ${comparison.scenario} 1\`] = \`\n`;
  const start = source.indexOf(marker);
  assert.ok(start >= 0, `snapshot not found: ${comparison.scenario}`);
  const bodyStart = start + marker.length;
  const end = source.indexOf("\n`;", bodyStart);
  assert.ok(end >= 0);
  const body = source.slice(bodyStart, end);
  const expected = JSON.parse(body.replace(/,(\s*[}\]])/g, "$1"));
  comparison.snapshotExpectedSha256 = expected.sha256;
  comparison.baselineMatchesSnapshot =
    JSON.stringify(expected) ===
    JSON.stringify(
      Object.fromEntries(
        Object.keys(expected).map((key) => [key, comparison.baseline[key]]),
      ),
    );

  if (!names.includes(comparison.scenario)) {
    assert.equal(comparison.firstDivergentTick, -1);
    assert.equal(comparison.baseline.sha256, comparison.candidate.sha256);
    comparison.snapshotAction = "preserve pre-existing mismatch";
    continue;
  }
  assert.ok(comparison.firstDivergentTick >= 0);
  assert.ok(
    comparison.baselineMatchesSnapshot,
    `${comparison.scenario}: PR297 snapshot differs from baseline`,
  );
  const updated = body.replace(/^  "([^"]+)": (.*),$/gm, (_, key) => {
    assert.ok(Object.hasOwn(comparison.candidate, key));
    return `  "${key}": ${JSON.stringify(comparison.candidate[key])},`;
  });
  const parsed = JSON.parse(updated.replace(/,(\s*[}\]])/g, "$1"));
  assert.deepEqual(parsed, comparison.candidate);
  source = source.slice(0, bodyStart) + updated + source.slice(end);
  comparison.snapshotAction = "updated named CATENA scenario";
}

writeFileSync(snapshotPath, source);
writeFileSync(evidencePath, JSON.stringify(evidence, null, 2) + "\n");
console.log(
  JSON.stringify(
    evidence.comparisons.map((item) => ({
      scenario: item.scenario,
      baselineMatchesSnapshot: item.baselineMatchesSnapshot,
      snapshotAction: item.snapshotAction,
    })),
  ),
);
