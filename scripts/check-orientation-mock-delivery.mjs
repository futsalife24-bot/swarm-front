import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";

// Never probes the production Worker. Supply the URL printed by the mock deploy.
const origin = new URL(process.argv[2] ?? "http://127.0.0.1:5197");
assert.ok(
  origin.origin === "http://127.0.0.1:5197" ||
    (origin.protocol === "https:" &&
      /^swarm-front-orientation-mock\.[a-z0-9-]+\.workers\.dev$/.test(
        origin.hostname,
      )),
  "Only the dedicated mock origin is allowed",
);
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const root = new URL("../dist-orientation-mock/", import.meta.url);
const files = [
  "index.html",
  "icon-swarm-v2-512.png",
  "assets/ui/title-atmosphere-v1.png",
  "assets/fonts/rajdhani/Rajdhani-Bold.ttf",
  ...readdirSync(new URL("assets/", root))
    .filter((p) => /^orientation-mock-.*\.(js|css)$/.test(p))
    .map((p) => `assets/${p}`),
];
const results = [];
for (const path of files) {
  const response = await fetch(
    new URL(path === "index.html" ? "/" : path, origin),
  );
  assert.equal(response.status, 200, path);
  const actual = hash(new Uint8Array(await response.arrayBuffer())),
    expected = hash(readFileSync(new URL(path, root)));
  assert.equal(actual, expected, path);
  if (path === "index.html" && origin.protocol === "https:") {
    assert.match(
      response.headers.get("content-security-policy") ?? "",
      /worker-src 'none'/,
    );
    assert.match(response.headers.get("x-robots-tag") ?? "", /noindex/);
  }
  results.push({ path, status: response.status, sha256: actual });
}
for (const path of [
  "/api",
  "/api/health",
  "/sw.js",
  "/manifest.webmanifest",
  "/front.html",
]) {
  const response = await fetch(new URL(path, origin));
  assert.equal(response.status, 404, path);
  results.push({ path, status: response.status });
}
if (origin.protocol === "https:") {
  const response = await fetch(origin, {
    method: "POST",
    body: "mock-isolation-check",
  });
  assert.ok(
    [404, 405].includes(response.status),
    `Unexpected POST status: ${response.status}`,
  );
  results.push({ path: "/", method: "POST", status: response.status });
}
mkdirSync("dist-validation/orientation-mock", { recursive: true });
writeFileSync(
  "dist-validation/orientation-mock/delivery.json",
  JSON.stringify(
    { origin: origin.origin, checkedAt: new Date().toISOString(), results },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({
    origin: origin.origin,
    checks: results.length,
    matched: files.length,
  }),
);
