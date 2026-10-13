import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const base = "https://swarm-front.melosalife-24.workers.dev";
const output =
  process.argv[2] || "dist-validation/anomaly-voices-20261013/delivery.json";
const version = process.argv[3] || "未指定";
const source = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");

// These are the eight motion assets selected by the production model loader.
const models = {
  hound: "v1",
  leaper: "v3",
  pleat: "v5",
  prism: "v1",
  ray: "v1",
  foundry_zero: "v1",
  calyx: "v1",
  harrow: "v14",
};
const voices = [
  "ant",
  "spider",
  "crawler",
  "spitter",
  "hornet",
  "boss",
  "calyx",
  "harrow",
];
const audioRoot = "assets/audio/anomaly-voice-v1";
const voiceFiles = voices.flatMap((name) =>
  [0, 1].map((variant) => `${name}-${variant}.wav`),
);
const files = [
  "index.html",
  "front.html",
  "anomaly-voices.html",
  ...Object.entries(models).map(
    ([name, version]) => `assets/enemies/${name}_motion_${version}.glb`,
  ),
  `${audioRoot}/manifest.json`,
  `${audioRoot}/CREDITS.txt`,
  ...voiceFiles.map((file) => `${audioRoot}/${file}`),
];
for (const file of fs.readdirSync("dist/assets")) {
  if (/\.(js|css)$/.test(file)) files.push(`assets/${file}`);
}

const manifest = JSON.parse(fs.readFileSync(`dist/${audioRoot}/manifest.json`));
const listed = new Map(manifest.files.map(({ file, sha256 }) => [file, sha256]));
const manifestMatches =
  listed.size === voiceFiles.length &&
  voiceFiles.every(
    (file) =>
      listed.get(file) === sha(fs.readFileSync(`dist/${audioRoot}/${file}`)),
  );

const checks = [];
for (const file of files) {
  const url = file === "front.html" ? `${base}/front` : `${base}/${file}`;
  const local = sha(fs.readFileSync(`dist/${file}`));
  try {
    const response = await fetch(url, { cache: "no-store" });
    const remote = sha(Buffer.from(await response.arrayBuffer()));
    checks.push({
      file,
      status: response.status,
      local,
      remote,
      pass: response.ok && local === remote,
    });
  } catch (error) {
    checks.push({ file, local, pass: false, error: String(error) });
  }
}

let health;
try {
  const response = await fetch(`${base}/api/health`, { cache: "no-store" });
  health = { status: response.status, body: await response.json() };
} catch (error) {
  health = { status: null, error: String(error) };
}
const result = {
  at: new Date().toISOString(),
  base,
  source,
  version,
  manifestMatches,
  health,
  pass:
    manifestMatches &&
    checks.every((check) => check.pass) &&
    health.status === 200 &&
    health.body?.ok === true,
  checks,
};
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(result, null, 2));
console.log(
  JSON.stringify({
    pass: result.pass,
    files: checks.length,
    manifestMatches,
    health,
    source,
    version,
    output,
  }),
);
if (!result.pass) process.exitCode = 1;
