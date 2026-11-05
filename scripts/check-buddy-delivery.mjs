import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
const origin =
  process.env.ORIGIN ?? "https://swarm-front.melosalife-24.workers.dev";
const out = "dist-validation/buddy-production/delivery.json";
const hash = (b) => createHash("sha256").update(b).digest("hex");
const files = fs
  .readdirSync("dist", { recursive: true })
  .filter(
    (name) =>
      fs.statSync(path.join("dist", name)).isFile() &&
      (/\.(html|js|css|json|webmanifest)$/.test(name) ||
        /(?:^|[\\/])buddy(?:[\\/]|-)/.test(name)),
  )
  .sort();
const checks = [];
for (const localPath of files) {
  const asset = localPath.replaceAll("\\", "/");
  const response = await fetch(`${origin}/${asset}`, { cache: "no-store" });
  const bytes = Buffer.from(await response.arrayBuffer());
  const local = hash(fs.readFileSync(path.join("dist", localPath)));
  const remote = hash(bytes);
  checks.push({
    asset,
    status: response.status,
    bytes: bytes.length,
    sha256: remote,
    pass: response.status === 200 && local === remote,
  });
}
const response = await fetch(origin + "/api/health", { cache: "no-store" });
const health = { status: response.status, body: await response.json() };
const js = files
  .filter((p) => p.endsWith(".js"))
  .map((p) => fs.readFileSync(path.join("dist", p), "utf8"))
  .join("\n");
const devReviewAbsent = !/swarmBuddyReview|data-buddy-kind|バディ外観検証/.test(
  js,
);
const designAbsent = !fs.existsSync("dist/design");
const result = {
  at: new Date().toISOString(),
  origin,
  health,
  devReviewAbsent,
  designAbsent,
  checks,
  pass:
    checks.every((c) => c.pass) &&
    health.status === 200 &&
    health.body.ok === true &&
    devReviewAbsent &&
    designAbsent,
};
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(result, null, 2));
console.log(
  JSON.stringify({
    pass: result.pass,
    files: checks.length,
    health: health.status,
    failed: checks.filter((c) => !c.pass),
  }),
);
if (!result.pass) process.exitCode = 1;
