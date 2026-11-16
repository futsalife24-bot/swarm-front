import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
const base =
  process.argv[2] || "https://swarm-front.melosalife-24.workers.dev/";
const source = process.argv[3];
const hash = (b) => createHash("sha256").update(b).digest("hex");
const files = ["index.html", "front.html"];
for (const name of fs.readdirSync("dist/assets"))
  if (/\.(js|css)$/.test(name)) files.push(`assets/${name}`);
for (const voice of ["hiromi", "hiyori", "yoko"])
  files.push(`assets/voice-packs/control-voice-${voice}-v4.bin`);
const results = [];
let sourceFound = false;
for (const file of files) {
  const expected = fs.readFileSync(path.join("dist", file));
  const response = await fetch(new URL(file, base), { cache: "no-store" });
  assert.equal(response.status, 200, file);
  const actual = Buffer.from(await response.arrayBuffer());
  assert.equal(hash(actual), hash(expected), file);
  if (file.endsWith(".js") && source && actual.includes(Buffer.from(source)))
    sourceFound = true;
  results.push({
    file,
    bytes: actual.length,
    sha256: hash(actual),
    status: response.status,
  });
}
assert.equal(sourceFound, true, "公開ソースSHA");
const response = await fetch(new URL("api/health", base));
assert.equal(response.status, 200);
const health = await response.json();
assert.equal(health.ok, true);
fs.writeFileSync(
  "docs/evidence/enemy-report-intro-20261116/delivery.json",
  JSON.stringify(
    { base, source, sourceFound, health, matched: results.length, results },
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify({ health, source, sourceFound, matched: results.length }),
);
