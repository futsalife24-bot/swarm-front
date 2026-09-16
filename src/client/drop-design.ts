import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/** Code-native field supplies: visible symbols on both faces and the lid. */
export function dropGeometry(heal: boolean): T.BufferGeometry {
  const parts: T.BufferGeometry[] = [];
  const box = (
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    color: number,
  ) => {
    const g = new T.BoxGeometry(w, h, d).translate(x, y, z);
    const c = new T.Color(color),
      colors = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < colors.length; i += 3) c.toArray(colors, i);
    g.setAttribute("color", new T.BufferAttribute(colors, 3));
    parts.push(g);
  };
  const accent = heal ? 0x34efa0 : 0x62dfff;
  const width = heal ? 0.85 : 1.25;
  box(width, 0.62, 0.58, 0, 0, 0, heal ? 0xe6efeb : 0x263d4c);
  for (const x of [-1, 1]) {
    box(0.09, 0.69, 0.64, x * (width / 2 - 0.08), 0, 0, 0x182b33);
    box(0.12, 0.12, 0.04, x * (width / 2 - 0.08), 0.12, 0.34, accent);
  }
  box(0.36, 0.07, 0.12, 0, 0.43, 0, 0x8fa9ae);
  for (const x of [-0.15, 0.15]) box(0.06, 0.12, 0.12, x, 0.36, 0, 0x8fa9ae);
  for (const z of [-0.305, 0.305]) {
    if (heal) {
      box(0.36, 0.11, 0.025, 0, 0, z, accent);
      box(0.11, 0.36, 0.025, 0, 0, z, accent);
    } else {
      box(0.61, 0.1, 0.025, 0.02, 0.04, z, accent);
      box(0.18, 0.18, 0.025, -0.28, -0.005, z, accent);
      box(0.09, 0.18, 0.025, -0.04, -0.08, z, accent);
      box(0.18, 0.035, 0.025, 0.02, 0.13, z, accent);
    }
  }
  box(width * 0.6, 0.025, 0.09, 0, 0.322, 0, accent);
  if (heal) box(0.09, 0.025, 0.4, 0, 0.323, 0, accent);
  const merged = mergeGeometries(parts);
  parts.forEach((g) => g.dispose());
  return merged;
}
