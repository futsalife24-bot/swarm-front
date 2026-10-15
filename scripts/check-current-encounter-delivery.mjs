import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";

const evidence = "docs/evidence/encounter-films-current-20261015";
const { rows } = JSON.parse(readFileSync(`${evidence}/manifest.json`, "utf8"));
const root =
  process.env.DELIVERY_BASE ?? "https://swarm-front.melosalife-24.workers.dev/";
const results = [];
for (const row of rows) {
  const url = new URL(row.file.replace("public/", ""), root);
  url.searchParams.set("v", row.sha256.slice(0, 12));
  const response = await fetch(url);
  assert.equal(response.status, 200, row.key);
  assert.match(response.headers.get("content-type"), /^video\/mp4/i);
  const bytes = Buffer.from(await response.arrayBuffer());
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  assert.equal(sha256, row.sha256, row.key);
  results.push({
    key: row.key,
    status: response.status,
    bytes: bytes.length,
    sha256,
    match: true,
  });
}
writeFileSync(
  `${evidence}/delivery.json`,
  JSON.stringify(
    { base: root, checkedAt: new Date().toISOString(), results },
    null,
    2,
  ) + "\n",
);
console.log(
  `${results.length}/${rows.length} current films match the published bytes`,
);
