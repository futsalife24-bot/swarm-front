import * as T from "three";

// Hand-drawn, 16-pixel silhouettes. Shared textures keep instanced arrivals
// and pooled combat effects on the same pre-warmed material programs.
function texture(rows: readonly string[], alpha = [0, 255, 255, 255]) {
  const bytes = new Uint8Array(16 * 16 * 4);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const value = Number(rows[y][x]);
      if (!value) continue;
      const i = (y * 16 + x) * 4;
      bytes[i] = bytes[i + 1] = bytes[i + 2] = [0, 158, 210, 255][value];
      bytes[i + 3] = alpha[value];
    }
  }
  const result = new T.DataTexture(bytes, 16, 16, T.RGBAFormat);
  result.colorSpace = T.SRGBColorSpace;
  result.magFilter = result.minFilter = T.NearestFilter;
  result.generateMipmaps = false;
  result.needsUpdate = true;
  return result;
}

export const pixelFireTexture = texture([
  "................",
  ".......11.......",
  "......1221......",
  "..1...1231...1..",
  "..11.122321.11..",
  ".1122223322111..",
  "..122333333221..",
  ".12223333333221.",
  ".12233333333221.",
  "..122233333221..",
  "..112223332211..",
  "...1122222211...",
  "....11122111....",
  "......1111......",
  "................",
  "................",
]);

export const pixelDustTexture = texture(
  [
    "................",
    "................",
    ".....1111.......",
    "....122221......",
    "..11122222111...",
    ".1222223322221..",
    ".12223333322211.",
    "112223333332221.",
    "1222333333332221",
    "1222233333322221",
    ".12222233322221.",
    "..112222222211..",
    "...111222111....",
    ".....1111.......",
    "................",
    "................",
  ],
  [0, 35, 75, 130],
);

export const pixelDebrisTexture = texture([
  "................",
  "................",
  "................",
  "......111.......",
  ".....12221......",
  "....1223321.....",
  "...12233321.....",
  "...123333221....",
  "...122333221....",
  "....1223321.....",
  ".....12221......",
  "......111.......",
  "................",
  "................",
  "................",
  "................",
]);
