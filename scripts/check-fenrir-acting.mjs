import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
const manifest = JSON.parse(
  readFileSync("assets-src/voice-fenrir-acting-v2/manifest.json", "utf8"),
);
const clips = manifest.clips.map((clip) => {
  const file = `public/assets/audio/voice-fenrir-v1/${clip.id}.wav`;
  const wav = readFileSync(file);
  const sha256 = createHash("sha256").update(wav).digest("hex");
  if (sha256 !== clip.previewSha256)
    throw Error(`Not approved preview: ${file}`);
  if (
    wav.readUInt32LE(28) !== 48000 ||
    wav.readUInt16LE(22) !== 1 ||
    wav.readUInt32LE(24) !== 24000
  )
    throw Error(`Invalid PCM: ${file}`);
  return { file, bytes: wav.length, sha256, matchesApprovedPreview: true };
});
mkdirSync("docs/evidence/fenrir-acting", { recursive: true });
writeFileSync(
  "docs/evidence/fenrir-acting/assets.json",
  JSON.stringify(clips, null, 2) + "\n",
);
console.log(`Approved preview hashes and PCM headers: ${clips.length}/6 match`);
