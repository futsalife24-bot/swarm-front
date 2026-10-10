import fs from "node:fs";
import { createHash } from "node:crypto";
const base = "https://swarm-front.melosalife-24.workers.dev";
const hash = (b) => createHash("sha256").update(b).digest("hex");
const files = [
  "index.html",
  "front.html",
  "sw.js",
  ...fs
    .readdirSync("dist/assets")
    .filter((x) => /\.(js|css)$/.test(x))
    .map((x) => "assets/" + x),
  "assets/ui/title-atmosphere-v1.png",
  ...fs
    .readdirSync("dist/assets/audio/voice-young-soldier-v1")
    .filter((x) => x.endsWith(".wav"))
    .map((x) => "assets/audio/voice-young-soldier-v1/" + x),
];
fs.mkdirSync("dist-validation/soldier-voice-audit-20261010", {
  recursive: true,
});
const checks = [];
for (const file of files) {
  const res = await fetch(base + "/" + file, { cache: "no-store" });
  const bytes = Buffer.from(await res.arrayBuffer());
  const local = hash(fs.readFileSync("dist/" + file));
  checks.push({
    file,
    status: res.status,
    local,
    remote: hash(bytes),
    pass: res.status === 200 && local === hash(bytes),
  });
}
const res = await fetch(base + "/api/health", { cache: "no-store" });
const health = { status: res.status, body: await res.json() };
const result = {
  at: new Date().toISOString(),
  base,
  health,
  pass:
    checks.every((x) => x.pass) &&
    health.status === 200 &&
    health.body.ok === true,
  checks,
};
fs.writeFileSync(
  process.env.DELIVERY_OUTPUT ||
    "dist-validation/soldier-voice-audit-20261010/delivery.json",
  JSON.stringify(result, null, 2),
);
console.log(
  JSON.stringify({
    pass: result.pass,
    health: health.status,
    files: checks.length,
    failed: checks.filter((x) => !x.pass),
  }),
);
if (!result.pass) process.exitCode = 1;
