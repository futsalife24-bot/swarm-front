/** Small allocation-only vector helpers, shared with the authority (no renderer). */
export type V3 = { x: number; y: number; z: number };
export const vec = (x = 0, y = 0, z = 0): V3 => ({ x, y, z });
export const add = (a: V3, b: V3): V3 => vec(a.x + b.x, a.y + b.y, a.z + b.z);
export const sub = (a: V3, b: V3): V3 => vec(a.x - b.x, a.y - b.y, a.z - b.z);
export const mul = (a: V3, s: number): V3 => vec(a.x * s, a.y * s, a.z * s);
export const dot = (a: V3, b: V3) => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross = (a: V3, b: V3): V3 =>
  vec(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
export const length = (a: V3) => Math.hypot(a.x, a.y, a.z);
export const unit = (a: V3, fallback: V3 = vec(0, 1, 0)): V3 =>
  length(a) > 1e-8 ? mul(a, 1 / length(a)) : { ...fallback };
export const mix = (a: V3, b: V3, t: number): V3 =>
  add(mul(a, 1 - t), mul(b, t));
export const tangent = (v: V3, n: V3): V3 => sub(v, mul(n, dot(v, n)));
export const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));
export function rotate(v: V3, axis: V3, angle: number): V3 {
  return add(
    add(mul(v, Math.cos(angle)), mul(cross(axis, v), Math.sin(angle))),
    mul(axis, dot(axis, v) * (1 - Math.cos(angle))),
  );
}
/** Quaternion shortest-arc action, with an explicit axis at antiparallel normals. */
export function transport(v: V3, from: V3, to: V3): V3 {
  const c = clamp(dot(from, to), -1, 1),
    axis = cross(from, to);
  if (c > 0.999999) return { ...v };
  if (c < -0.999999)
    return rotate(
      v,
      unit(tangent(v, from), unit(cross(from, vec(1, 0, 0)), vec(0, 0, 1))),
      Math.PI,
    );
  return rotate(v, unit(axis), Math.acos(c));
}
export function newell(points: readonly V3[], fallback: V3): V3 {
  let n = vec();
  points.forEach((p, i) => {
    const q = points[(i + 1) % points.length];
    n = add(
      n,
      vec(
        (p.y - q.y) * (p.z + q.z),
        (p.z - q.z) * (p.x + q.x),
        (p.x - q.x) * (p.y + q.y),
      ),
    );
  });
  n = unit(n, fallback);
  return dot(n, fallback) < 0 ? mul(n, -1) : n;
}
