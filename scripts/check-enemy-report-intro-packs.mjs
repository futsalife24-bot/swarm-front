import fs from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const sha = (b) => createHash("sha256").update(b).digest("hex");
const results = [];
function read(voice, version) {
  const bytes = fs.readFileSync(
    `public/assets/voice-packs/control-voice-${voice}-v${version}.bin`,
  );
  assert.equal(bytes.toString("ascii", 0, 4), "SFVP");
  assert.equal(bytes[4], 1);
  const n = bytes.readUInt32LE(8);
  const index = JSON.parse(bytes.subarray(12, 12 + n));
  assert.equal(index.format, 1);
  assert.equal(index.version, version);
  assert.equal(index.codec, "mp3");
  return {
    bytes,
    index,
    clip: (c) =>
      bytes.subarray(12 + n + c.offset, 12 + n + c.offset + c.length),
  };
}
for (const voice of ["hiromi", "hiyori", "yoko"]) {
  const before = read(voice, 3),
    after = read(voice, 4);
  const key = `voice-control-${voice}-v1/enemy-report-intro`;
  const added = after.index.clips.filter(
    (c) => !before.index.clips.some((b) => b.key === c.key),
  );
  assert.deepEqual(
    added.map((c) => c.key),
    [key],
  );
  for (const c of before.index.clips) {
    const same = after.index.clips.find((b) => b.key === c.key);
    assert.ok(same);
    assert.equal(sha(before.clip(c)), sha(after.clip(same)));
  }
  const input = fs.readFileSync(
    `C:/Users/futsa/bibi-bridge/inbox/voice-report-intro-20261116/${key}.wav`,
  );
  const source = fs.readFileSync(`assets-src/${key}.wav`);
  assert.deepEqual(source, input);
  assert.equal(source.readUInt16LE(22), 1);
  assert.equal(source.readUInt32LE(24), 44100);
  assert.equal(source.readUInt16LE(34), 16);
  results.push({
    voice,
    pack: `control-voice-${voice}-v4.bin`,
    format: 1,
    codec: "mp3",
    bitrate: "64kbps",
    version: 4,
    before: before.index.clips.length,
    after: after.index.clips.length,
    added: added.map((c) => ({ ...c, sha256: sha(after.clip(c)) })),
    unchanged: before.index.clips.length,
    sourceSha256: sha(source),
    bytes: after.bytes.length,
    sha256: sha(after.bytes),
    manifest: after.index,
  });
}
fs.writeFileSync(
  "docs/evidence/enemy-report-intro-20261116/pack-results.json",
  JSON.stringify(results, null, 2) + "\n",
);
console.log(
  JSON.stringify(
    results.map(({ manifest, ...r }) => r),
    null,
    2,
  ),
);
