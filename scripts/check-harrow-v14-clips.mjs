import fs from "node:fs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
const loader = new GLTFLoader().register(() => ({
  name: "GEOMETRY_ONLY",
  loadTexture: async () => new T.Texture(),
}));
async function read(b) {
  const asset = await loader.parseAsync(
    b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
    "",
  );
  const clips = Object.fromEntries(
    asset.animations.map((c) => [
      c.name,
      createHash("sha256")
        .update(
          JSON.stringify({
            duration: c.duration,
            tracks: c.tracks.map((t) => ({
              name: t.name,
              times: Array.from(t.times),
              values: Array.from(t.values),
            })),
          }),
        )
        .digest("hex"),
    ]),
  );
  return { sha256: createHash("sha256").update(b).digest("hex"), clips };
}
const before = await read(
  fs.readFileSync("public/assets/enemies/harrow_motion_v13.glb"),
);
const after = await read(
  fs.readFileSync("public/assets/enemies/harrow_motion_v14.glb"),
);
assert.deepEqual(Object.keys(after.clips), Object.keys(before.clips));
const changed = Object.keys(after.clips).filter(
  (c) => before.clips[c] !== after.clips[c],
);
assert.deepEqual(changed.slice().sort(), [
  "Flight",
  "Takeoff",
  "TakeoffB",
  "TakeoffC",
  "TakeoffD",
]);
const result = { pass: true, before, after, changed };
fs.mkdirSync("dist-validation/harrow-v14", { recursive: true });
fs.writeFileSync(
  "dist-validation/harrow-v14/clip-comparison.json",
  JSON.stringify(result, null, 2),
);
console.log(
  JSON.stringify({
    pass: true,
    before: before.sha256,
    after: after.sha256,
    changed,
  }),
);
