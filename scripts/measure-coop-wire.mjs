import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const out = "dist-validation/coop-comfort-20261030";
fs.mkdirSync(out, { recursive: true });
const bundle = path.resolve(out, "wire-fixture.mjs");
await build({
  stdin: {
    contents: `export { denseWireFixture } from './scripts/state-wire-fixture'; export { prepareState } from './src/shared/state-wire';`,
    resolveDir: process.cwd(),
    loader: "ts",
  },
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: bundle,
});
const { denseWireFixture, prepareState } = await import(pathToFileURL(bundle));
const bytes = (value) => Buffer.byteLength(JSON.stringify(value));
const results = [];
for (const count of [180, 280, 400]) {
  const { w, ids, metadata } = denseWireFixture(count);
  const state = prepareState(w, 0, metadata);
  const full = JSON.parse(state.packet(ids[0], false, -1, undefined, false));
  const partial = JSON.parse(state.packet(ids[0]));
  results.push({
    projectiles: count,
    fullBytes: bytes(full),
    partialBytes: bytes(partial),
    enemiesTotal: w.enemies.length,
    enemiesSent: partial.world.enemies.length,
    enemiesOmitted: partial.omitted?.enemies?.length ?? 0,
    fields: Object.fromEntries(
      Object.entries(full.world).map(([k, v]) => [k, bytes(v)]),
    ),
    pleatBytes: full.world.enemies.reduce(
      (sum, e) => sum + (e.pleat ? bytes(e.pleat) : 0),
      0,
    ),
  });
}
fs.writeFileSync(
  `${out}/wire-pressure-baseline.json`,
  JSON.stringify(results, null, 2),
);
console.log(JSON.stringify(results));
