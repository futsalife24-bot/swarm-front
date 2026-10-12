import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const base = "https://swarm-front.melosalife-24.workers.dev";
const output = process.argv[2] || "dist-validation/harrow-v14/delivery.json";
const version = process.argv[3] || "未指定";
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const files = [
  "index.html",
  "front.html",
  "assets/enemies/harrow_motion_v14.glb",
];
for (const file of fs.readdirSync("dist/assets")) {
  if (/\.(js|css)$/.test(file)) files.push(`assets/${file}`);
}
const checks = [];
for (const file of files) {
  const url = file === "front.html" ? `${base}/front` : `${base}/${file}`;
  const response = await fetch(url, { cache: "no-store" });
  const bytes = Buffer.from(await response.arrayBuffer());
  const local = sha(fs.readFileSync(`dist/${file}`));
  const remote = sha(bytes);
  checks.push({
    file,
    status: response.status,
    local,
    remote,
    pass: response.ok && local === remote,
  });
}
const healthResponse = await fetch(`${base}/api/health`, { cache: "no-store" });
const health = {
  status: healthResponse.status,
  body: await healthResponse.json(),
};
const result = {
  at: new Date().toISOString(),
  base,
  source: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  version,
  health,
  pass:
    checks.every((c) => c.pass) &&
    health.status === 200 &&
    health.body.ok === true,
  checks,
};
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(result, null, 2));
console.log(
  JSON.stringify({
    pass: result.pass,
    files: checks.length,
    health,
    source: result.source,
    version,
  }),
);
if (!result.pass) process.exitCode = 1;
