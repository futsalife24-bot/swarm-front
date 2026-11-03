import * as T from "three";
import atlasUrl from "./assets/pixelfx-battle.png";

// Pre-rendered from PixelFX; one shared image, with immutable per-frame UVs.
// Never draw to a canvas or upload an animation frame during combat.
export type PixelFxKind =
  "impact" | "muzzle" | "blast" | "burrow" | "portal" | "acid";
const rows: PixelFxKind[] = [
  "impact",
  "muzzle",
  "blast",
  "burrow",
  "portal",
  "acid",
];
const frames = new Map<PixelFxKind, T.Texture[]>();
let ready = false;
if (typeof document !== "undefined") {
  const texture = new T.TextureLoader().load(atlasUrl, () => {
    for (const row of frames.values())
      for (const frame of row) frame.needsUpdate = true;
    ready = true;
  });
  texture.colorSpace = T.SRGBColorSpace;
  texture.magFilter = texture.minFilter = T.NearestFilter;
  texture.generateMipmaps = false;
  for (const [row, name] of rows.entries()) {
    frames.set(
      name,
      Array.from({ length: 8 }, (_, index) => {
        const frame = texture.clone();
        frame.repeat.set(1 / 8, 1 / 6);
        frame.offset.set(index / 8, 1 - (row + 1) / 6);
        return frame;
      }),
    );
  }
}
export function pixelFxTemplate(kind: PixelFxKind): T.Texture | null {
  return frames.get(kind)?.[0] ?? null;
}
export function pixelFxFrame(
  kind: PixelFxKind,
  progress: number,
): T.Texture | null {
  if (!ready) return null;
  return (
    frames.get(kind)?.[Math.min(7, Math.max(0, Math.floor(progress * 8)))] ??
    null
  );
}
