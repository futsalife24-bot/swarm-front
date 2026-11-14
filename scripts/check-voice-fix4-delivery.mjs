import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const base = "https://swarm-front.melosalife-24.workers.dev/";
const files = ["index.html", "front.html"];
async function walk(dir) {
  for (const item of await readdir("dist/" + dir, { withFileTypes: true })) {
    const path = dir + "/" + item.name;
    if (item.isDirectory()) await walk(path);
    else if (/\.(js|css)$/.test(path) || path.startsWith("assets/voice-packs/"))
      files.push(path);
  }
}
await walk("assets");
const sha = (b) => createHash("sha256").update(b).digest("hex");
const results = [];
for (const path of files) {
  const local = await readFile("dist/" + path);
  const res = await fetch(base + path, { cache: "no-store" });
  const published = Buffer.from(await res.arrayBuffer());
  results.push({
    path,
    status: res.status,
    sha256: sha(local),
    published: sha(published),
    match: sha(local) === sha(published),
  });
}
const health = await fetch(base + "api/health").then((r) => r.json());
await mkdir("docs/evidence/voice-fix4-20261115", { recursive: true });
await writeFile(
  "docs/evidence/voice-fix4-20261115/published-files.json",
  JSON.stringify({ base, health, files: results }, null, 2),
);
assert.ok(health.ok);
assert.ok(results.every((r) => r.status === 200 && r.match));
console.log(JSON.stringify({ health, matched: results.length }));
