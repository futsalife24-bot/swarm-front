import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const base = "https://swarm-front.melosalife-24.workers.dev";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const paths = [
  "index.html",
  "front.html",
  "sw.js",
  "asset-download-manifest.json",
  ...(await readdir("dist/assets"))
    .filter((name) => /\.(js|css)$/.test(name))
    .map((name) => `assets/${name}`),
];
const checks = [];
for (const path of paths) {
  const response = await fetch(
    `${base}/${path === "front.html" ? "front" : path}`,
    { cache: "no-store", signal: AbortSignal.timeout(30000) },
  );
  const remote = Buffer.from(await response.arrayBuffer());
  const local = await readFile(`dist/${path}`);
  checks.push({
    path,
    status: response.status,
    match: response.ok && hash(remote) === hash(local),
    localSha256: hash(local),
    publicSha256: hash(remote),
  });
}
const healthResponse = await fetch(`${base}/api/health`, {
  signal: AbortSignal.timeout(30000),
});
const health = {
  status: healthResponse.status,
  body: await healthResponse.json(),
};
const result = {
  checkedAt: new Date().toISOString(),
  source: "9e11e8c84fd4f406ce1fa47ebcf590fc87a4d6a4",
  workerVersion: "02233456-2641-463a-80d1-983c80c669ad",
  checks,
  health,
  passed:
    checks.every((c) => c.match) &&
    health.status === 200 &&
    health.body.ok === true,
};
await mkdir("output", { recursive: true });
await writeFile(
  "output/pixel-impact-delivery.json",
  JSON.stringify(result, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    passed: result.passed,
    files: checks.length,
    failed: checks.filter((c) => !c.match).map((c) => c.path),
    health,
  }),
);
if (!result.passed) process.exitCode = 1;
