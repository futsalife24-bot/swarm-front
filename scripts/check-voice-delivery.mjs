import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const base = (
    process.argv[2] || "https://swarm-front.melosalife-24.workers.dev"
  ).replace(/\/$/, ""),
  source = process.argv[3],
  out = process.argv[4] || "docs/evidence/voice-fix2-20261115";
if (!source) throw Error("source SHA required");
await mkdir(out, { recursive: true });
const hash = (b) => createHash("sha256").update(b).digest("hex");
const paths = [
  "index.html",
  "front.html",
  ...(await readdir("dist/assets"))
    .filter((n) => /\.(js|css)$/.test(n))
    .map((n) => "assets/" + n),
  ...(await readdir("dist/assets/voice-packs"))
    .filter((n) => n.endsWith(".bin"))
    .map((n) => "assets/voice-packs/" + n),
];
const r = { source, base, files: [], sourceEmbedded: false };
for (const path of paths) {
  const local = await readFile("dist/" + path),
    response = await fetch(base + "/" + (path === "index.html" ? "" : path), {
      cache: "no-store",
    });
  assert.equal(response.status, 200, path);
  const remote = Buffer.from(await response.arrayBuffer());
  assert.equal(hash(local), hash(remote), path);
  r.files.push({ path, bytes: remote.length, sha256: hash(remote) });
  if (path.endsWith(".js") && remote.includes(Buffer.from(source)))
    r.sourceEmbedded = true;
}
assert.ok(r.sourceEmbedded, "source SHA missing");
const health = await fetch(base + "/api/health", { cache: "no-store" });
assert.equal(health.status, 200);
r.health = await health.json();
assert.equal(r.health.ok, true);
await writeFile(out + "/published-files.json", JSON.stringify(r, null, 2));
console.log(
  JSON.stringify({
    files: r.files.length,
    source,
    health: r.health.ok,
    sourceEmbedded: r.sourceEmbedded,
  }),
);
