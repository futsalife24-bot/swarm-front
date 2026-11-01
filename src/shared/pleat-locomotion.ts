import {
  add,
  sub,
  mul,
  dot,
  cross,
  length,
  unit,
  tangent,
  rotate,
  transport,
  clamp,
  vec,
  type V3,
} from "./surface-math";
import type { SurfaceHit } from "./surface-ray";
import { pleatGaitAcceleration, pleatGaitSpeed } from "./pleat-gait";

export interface PleatSurface {
  ray(origin: V3, direction: V3, distance: number): SurfaceHit | undefined;
}
/** Change of support plane. The body follows one curve through the edge; no feet. */
export interface PleatTransfer {
  point: V3;
  normal: V3;
  forward: V3;
  surface: string;
  age: number;
  convex: boolean;
  /** Body on the previous plane, the edge it pivots over, and the curve's time. */
  from?: V3;
  fromNormal?: V3;
  pivot?: V3;
  duration?: number;
  /** Legacy four-foot controller flag (older saves); unused. */
  prepared?: boolean;
  fromPoint?: V3;
  fromUp?: V3;
  exit?: { point: V3; stage: 0 | 1 | 2 };
}
/**
 * Authoritative PLEAT body. Server keeps only what movement and combat need:
 * where the body is, which surface it grips and how it faces. Legs and foot
 * contacts are a renderer effect (src/client/pleat-procedural.ts).
 */
export interface PleatState {
  anchor: V3;
  normal: V3;
  forward: V3;
  poseForward: V3;
  body: V3;
  up: V3;
  velocity: V3;
  scale: number;
  /** Ground speed after the legacy gait limit (m/s). */
  speed: number;
  /** Stride cycle 0..1, advanced by distance; only feeds the compatibility feet. */
  phase: number;
  transfer?: PleatTransfer;
  /** Short hold after a surface change; combat waits for it like before. */
  settling: boolean;
  settle?: number;
  /** Body pose is held low until there is room to turn; locomotion may continue. */
  poseHeld?: boolean;
  lowClearance?: { floor: number; ceiling: number };
  /** Previous support plane, kept until the whole body has cleared its edge. */
  trail?: { point: V3; normal: V3; convex: boolean };
  switches: number;
  /** Fields of the former four-foot controller, still present in older saves. */
  feet?: unknown;
  travel?: unknown;
}
export const PLEAT_REST = [
  vec(-0.86, 0, -1.02),
  vec(0.86, 0, -1.02),
  vec(-0.86, 0, 1.16),
  vec(0.86, 0, 1.16),
];
const UP = vec(0, 1, 0);
/** Fixed substeps; extra body-clearance rays run only around surface changes. */
const SUBSTEP = 1 / 30;
const SETTLE = 0.4;
function offset(s: PleatState, p: V3, up = s.normal, forward = s.forward) {
  return add(
    add(mul(unit(cross(forward, up)), p.x * s.scale), mul(up, p.y * s.scale)),
    mul(forward, -p.z * s.scale),
  );
}
export function pleatHip(s: PleatState, i: number): V3 {
  return add(
    s.body,
    offset(
      s,
      vec(i % 2 ? 0.45 : -0.45, i < 2 ? 0.16 : 0.17, i < 2 ? -0.53 : 0.69),
      s.up,
      s.poseForward,
    ),
  );
}
export function createPleat(
  anchor: V3,
  forward: V3,
  scale: number,
  world: PleatSurface,
): PleatState {
  const hit = world.ray(add(anchor, mul(UP, scale)), mul(UP, -1), 2 * scale);
  const ground = hit && hit.normal.y > 0.65 ? hit.point : anchor;
  const f = unit(tangent(forward, UP), vec(0, 0, -1));
  return {
    anchor: { ...ground },
    normal: { ...UP },
    forward: f,
    poseForward: { ...f },
    body: add(ground, vec(0, 0.8 * scale, 0)),
    up: { ...UP },
    velocity: vec(),
    scale,
    speed: 0,
    phase: 0,
    settling: false,
    switches: 0,
  };
}
/** Edge curve of a transfer: previous body, the edge, and time at walking pace. */
function prepareTransfer(s: PleatState, pace: number) {
  const t = s.transfer!;
  if (t.duration !== undefined) return;
  const height = 0.8 * s.scale;
  t.from = { ...s.body };
  t.fromPoint = { ...s.anchor };
  t.fromUp = { ...s.up };
  t.fromNormal = { ...s.normal };
  t.pivot = t.convex
    ? add(t.point, mul(s.normal, dot(sub(s.anchor, t.point), s.normal)))
    : sub(t.point, mul(s.normal, dot(sub(t.point, s.anchor), s.normal)));
  const to = add(t.point, mul(t.normal, height)),
    control = add(t.pivot, mul(add(s.normal, t.normal), height));
  // Polyline through the control point slightly overestimates the curve.
  const distance =
    (length(sub(control, t.from)) + length(sub(to, control))) * 0.85;
  // Concave corners previously spent about 1s transferring the front supports.
  // Keep that combat hold instead of letting the body-only curve finish in .35s.
  t.duration = clamp(distance / Math.max(1, pace), t.convex ? 0.35 : 1, 1.4);
  delete t.prepared;
}
/** Older saves carry the four-foot controller; keep its body and drop the legs. */
function migrate(s: PleatState) {
  if ("feet" in s) delete s.feet;
  if ("travel" in s) delete s.travel;
  s.phase ??= 0;
  s.poseForward ??= { ...s.forward };
  if (s.settling && s.settle === undefined) s.settle = SETTLE;
  if (s.transfer) prepareTransfer(s, 1.5);
}
/** Ray-only, fixed small substeps; state is plain JSON for authoritative snapshots. */
export function stepPleat(
  s: PleatState,
  direction: V3,
  speed: number,
  dt: number,
  world: PleatSurface,
) {
  migrate(s);
  let remaining = clamp(dt, 0, 0.1);
  while (remaining > 1e-8) {
    const h = Math.min(SUBSTEP, remaining);
    step(s, direction, speed, h, world);
    remaining -= h;
  }
}
function switchSurface(s: PleatState) {
  const t = s.transfer!;
  s.trail = {
    point: t.fromPoint ?? sub(t.from!, mul(t.fromNormal!, 0.8 * s.scale)),
    normal: { ...t.fromNormal! },
    convex: t.convex,
  };
  s.forward = unit(
    tangent(transport(s.forward, s.normal, t.normal), t.normal),
    t.forward,
  );
  s.anchor = { ...t.point };
  s.normal = { ...t.normal };
  s.transfer = undefined;
  s.settling = true;
  s.settle = SETTLE;
  s.switches++;
}
/** Head, chest, mantle and mantle tip: the extremities that can meet a surface. */
const VOLUME = [
  [0, -0.78],
  [0.244, -0.434],
  [0.302, 0.687],
  [0.302, 1.478],
] as const;
/**
 * Keep the body outside the planes around its current edge, analytically and
 * without rays. A concave corner is solid behind either plane; a convex edge
 * only behind both.
 */
function keepClear(
  s: PleatState,
  a: { point: V3; normal: V3 },
  b: { point: V3; normal: V3 } | undefined,
  convex: boolean,
) {
  const margin = 0.05 * s.scale,
    start = s.body;
  let lowA = Infinity,
    lowB = Infinity;
  for (let pass = 0; pass < 2; pass++)
    for (const [y, z] of VOLUME) {
      const p = add(
        s.body,
        add(mul(s.up, y * s.scale), mul(s.poseForward, -z * s.scale)),
      );
      const da = margin - dot(sub(p, a.point), a.normal),
        db = b ? margin - dot(sub(p, b.point), b.normal) : -Infinity;
      if (pass === 1) {
        lowA = Math.min(lowA, margin - da);
        lowB = Math.min(lowB, margin - db);
      }
      if (convex && b) {
        if (da > 0 && db > 0)
          s.body = add(s.body, da < db ? mul(a.normal, da) : mul(b.normal, db));
        continue;
      }
      if (da > 0) s.body = add(s.body, mul(a.normal, da));
      if (db > 0) s.body = add(s.body, mul(b!.normal, db));
    }
  // Remove the follow velocity that drove the body into the surface.
  const push = sub(s.body, start);
  if (length(push) > 1e-9) {
    const n = unit(push),
      into = dot(s.velocity, n);
    if (into < 0) s.velocity = sub(s.velocity, mul(n, into));
  }
  return { lowA, lowB, margin };
}
/** Resolve the body against actual nearby surfaces, including a third floor/roof.
 * Only used near surface changes. Failed turns retain the previous low pose;
 * the support anchor can continue to the open side without forcing the body up.
 */
function fitPose(s: PleatState, world: PleatSurface): boolean {
  const margin = 0.08 * s.scale;
  for (let pass = 0; pass < 4; pass++) {
    let clear = true;
    for (const [y, z] of VOLUME) {
      const offset = add(
        mul(s.up, y * s.scale),
        mul(s.poseForward, -z * s.scale),
      );
      const distance = length(offset);
      if (distance < 1e-8) continue;
      const direction = mul(offset, 1 / distance);
      const hit = world.ray(s.body, direction, distance + margin);
      if (!hit || dot(direction, hit.normal) >= -0.01) continue;
      const penetration =
        margin - dot(sub(add(s.body, offset), hit.point), hit.normal);
      if (penetration > 1e-5) {
        s.body = add(s.body, mul(hit.normal, penetration));
        clear = false;
      }
    }
    if (clear) return true;
  }
  return false;
}
/** Only for resuming an older snapshot whose body already intersects a surface. */
function poseIntersects(s: PleatState, world: PleatSurface) {
  for (const [y, z] of VOLUME) {
    const offset = add(
        mul(s.up, y * s.scale),
        mul(s.poseForward, -z * s.scale),
      ),
      distance = length(offset);
    if (distance < 1e-8) continue;
    const hit = world.ray(s.body, mul(offset, 1 / distance), distance);
    if (hit && hit.distance < distance - 1e-5) return true;
  }
  return false;
}
function constrainPose(
  s: PleatState,
  body: V3,
  up: V3,
  forward: V3,
  dt: number,
  world: PleatSurface,
) {
  const proposed = { ...s.body };
  const limit = 4.5 * s.scale * dt;
  const movement = sub(s.body, body);
  if (length(movement) > limit) s.body = add(body, mul(unit(movement), limit));
  // Do not let the body centre tunnel through a thin third surface.
  const travel = sub(s.body, body),
    distance = length(travel);
  if (distance > 1e-8) {
    const direction = mul(travel, 1 / distance),
      hit = world.ray(body, direction, distance);
    if (hit && dot(direction, hit.normal) < -0.01)
      s.body = add(hit.point, mul(hit.normal, 0.08 * s.scale));
  }
  const safeCentre = { ...s.body };
  if (fitPose(s, world) && length(sub(s.body, body)) <= limit + 1e-6) {
    if (
      dot(s.up, s.normal) > 0.99 &&
      dot(s.poseForward, s.forward) > 0.99 &&
      dot(sub(s.body, s.anchor), s.normal) >= 0.28 * s.scale
    )
      delete s.poseHeld;
    else s.poseHeld = true;
  } else {
    s.body = safeCentre;
    s.up = up;
    // Turn along the low plane while its supporting anchor changes planes.
    const want = tangent(s.forward, up);
    s.poseForward = forward;
    if (length(want) > 0.05) {
      const angle = Math.atan2(
        dot(cross(forward, unit(want)), up),
        dot(forward, unit(want)),
      );
      s.poseForward = unit(
        rotate(forward, up, clamp(angle, -2.8 * dt, 2.8 * dt)),
      );
    }
    if (!fitPose(s, world) || length(sub(s.body, body)) > limit + 1e-6) {
      s.body = body;
      s.poseForward = forward;
      // Reject newly invalid poses, but don't freeze an already-invalid saved pose.
      // Move toward a collision-free position at the same bounded speed.
      if (poseIntersects(s, world)) {
        const recovery = { ...s, body: { ...body } };
        if (fitPose(recovery, world)) {
          const correction = sub(recovery.body, body);
          s.body = add(
            body,
            mul(unit(correction), Math.min(limit, length(correction))),
          );
        }
      }
    }
    s.poseHeld = true;
  }
  if (length(sub(s.body, proposed)) > 1e-6) s.velocity = vec();
}
function bezier(a: V3, b: V3, c: V3, u: number) {
  return add(
    add(mul(a, (1 - u) * (1 - u)), mul(b, 2 * u * (1 - u))),
    mul(c, u * u),
  );
}
function step(
  s: PleatState,
  direction: V3,
  speed: number,
  dt: number,
  world: PleatSurface,
) {
  const scale = s.scale,
    height = 0.8 * scale,
    previous = { ...s.body },
    previousUp = { ...s.up },
    previousForward = { ...s.poseForward };
  if (s.settling) {
    s.settle = (s.settle ?? 0) - dt;
    if (s.settle <= 0) {
      s.settling = false;
      delete s.settle;
    }
  }
  // 1. Surface-tangent input and bounded turn. A perpendicular target keeps heading.
  const desired = tangent(direction, s.normal);
  if (length(desired) > 0.05 && !s.transfer && !s.settling) {
    const want = unit(desired),
      angle = Math.atan2(
        dot(cross(s.forward, want), s.normal),
        dot(s.forward, want),
      );
    s.forward = unit(
      rotate(s.forward, s.normal, clamp(angle, -2.8 * dt, 2.8 * dt)),
    );
  }
  // 2. Next surface: a wall ahead (concave) or a lip under the head (convex).
  const gait = pleatGaitSpeed(scale, speed);
  const clearance = 1.12 * scale + 0.08,
    look = clearance + gait * dt;
  if (!s.transfer && !s.settling && speed > 0.001) {
    const front = world.ray(
      add(s.anchor, mul(s.normal, 0.18 * scale)),
      s.forward,
      look,
    );
    let next = front && dot(front.normal, s.normal) < 0.65 ? front : undefined;
    // A knee-high step is walked onto by the anchor below, not climbed as a wall.
    if (next) {
      const top = world.ray(
        add(
          next.point,
          add(mul(s.normal, 0.4 * scale), mul(s.forward, 0.12 * scale)),
        ),
        mul(s.normal, -1),
        0.4 * scale,
      );
      if (top && dot(top.normal, s.normal) > 0.9) next = undefined;
    }
    let convex = false;
    if (!next) {
      const ahead = add(s.anchor, mul(s.forward, look));
      const down = world.ray(
        add(ahead, mul(s.normal, 0.3 * scale)),
        mul(s.normal, -1),
        0.65 * scale,
      );
      if (!down) {
        // Probe close to the lip first: a single deep cast skips thin slabs.
        for (const depth of [0.06, 0.18, 0.4]) {
          next = world.ray(
            sub(ahead, mul(s.normal, depth * scale)),
            mul(s.forward, -1),
            look + 0.5 * scale,
          );
          if (next && dot(next.normal, s.normal) < 0.65) break;
        }
        convex = !!next && dot(next.normal, s.normal) < 0.65;
        if (!convex) next = undefined;
      }
    }
    if (next) {
      const forward = unit(
        tangent(transport(s.forward, s.normal, next.normal), next.normal),
      );
      s.transfer = {
        point: convex
          ? next.point
          : add(next.point, mul(s.normal, height - 0.18 * scale)),
        normal: next.normal,
        forward,
        surface: next.surface,
        age: 0,
        convex,
      };
      prepareTransfer(s, gait);
    }
  }
  // 3. Ground speed: the legacy gait-limited speed, never faster than before.
  const targetSpeed = s.transfer || s.settling ? 0 : gait;
  s.speed += clamp(
    targetSpeed - s.speed,
    -20 * scale * dt,
    pleatGaitAcceleration(scale, speed) * dt,
  );
  if (!s.transfer) {
    const next = add(s.anchor, mul(s.forward, s.speed * dt));
    const hit = world.ray(
      add(next, mul(s.normal, 0.45 * scale)),
      mul(s.normal, -1),
      0.95 * scale,
    );
    if (hit && dot(hit.normal, s.normal) > 0.65) {
      s.forward = unit(
        tangent(transport(s.forward, s.normal, hit.normal), hit.normal),
        s.forward,
      );
      s.anchor = hit.point;
      s.normal = hit.normal;
    } else s.speed = 0;
  }
  // 4. Body goal: above the anchor, or along the curve through the edge.
  let targetBody: V3, targetUp: V3;
  const t = s.transfer;
  if (t && t.age === 0 && !s.lowClearance) {
    const floor = world.ray(s.body, vec(0, -1, 0), 3 * scale),
      roof = world.ray(s.body, UP, 3 * scale);
    if (
      floor &&
      roof &&
      floor.normal.y > 0.9 &&
      roof.normal.y < -0.9 &&
      roof.point.y - floor.point.y < 2.5 * scale
    )
      s.lowClearance = { floor: floor.point.y, ceiling: roof.point.y };
  }
  // Carry the tail (1.478 * scale) fully past the lip before pitching upright.
  // Exit position and phase are serializable so reconnect/save resumes the route.
  if (
    t &&
    s.lowClearance &&
    t.convex &&
    Math.abs(t.normal.y) < 0.1 &&
    !t.exit
  ) {
    const point = add(t.point, mul(t.normal, 1.68 * scale));
    point.y = s.body.y;
    t.exit = { point, stage: 0 };
  }
  let exiting = false;
  if (t?.exit && t.exit.stage < 2) {
    exiting = true;
    if (t.exit.stage === 0) {
      targetBody = { ...t.exit.point };
      targetUp = UP;
      if (length(sub(s.body, targetBody)) < 0.08 * scale) {
        t.exit.stage = 1;
        t.exit.point.y = Math.max(
          t.point.y,
          (s.lowClearance?.floor ?? 0) + 1.6 * scale,
        );
      }
    } else {
      targetBody = { ...t.exit.point };
      targetUp = t.normal;
      if (
        length(sub(s.body, targetBody)) < 0.08 * scale &&
        dot(s.up, t.normal) > 0.99 &&
        dot(s.poseForward, t.forward) > 0.99
      ) {
        t.exit.stage = 2;
        t.from = { ...s.body };
        t.fromUp = { ...s.up };
        delete s.lowClearance;
      }
    }
  } else if (t) {
    t.age += dt;
    const u = clamp(t.age / t.duration!, 0, 1),
      smooth = u * u * (3 - 2 * u);
    const to = add(t.point, mul(t.normal, height)),
      control = add(t.pivot!, mul(add(t.fromNormal!, t.normal), height));
    targetBody = bezier(t.from!, control, to, smooth);
    targetUp = unit(
      add(mul(t.fromUp ?? t.fromNormal!, 1 - smooth), mul(t.normal, smooth)),
      t.normal,
    );
    if (u >= 1) switchSurface(s);
  } else {
    targetBody = add(s.anchor, mul(s.normal, height));
    targetUp = s.normal;
    // Low overhang above the anchor: crouch under it instead of passing through.
    const roof = world.ray(
      add(s.anchor, mul(s.normal, 0.05 * scale)),
      s.normal,
      height + 0.45 * scale,
    );
    if (roof && dot(roof.normal, s.normal) < -0.5) {
      const room = Math.max(0.4 * height, roof.distance - 0.4 * scale);
      if (room < height) targetBody = add(s.anchor, mul(s.normal, room));
    }
  }
  if (s.lowClearance && (!t?.exit || t.exit.stage === 0)) {
    targetUp = UP;
    targetBody.y = clamp(
      targetBody.y,
      s.lowClearance.floor + 0.45 * scale,
      s.lowClearance.ceiling - 0.45 * scale,
    );
  }
  // 5. Critically damped body follow; the curve and anchor already avoid solids.
  const omega = 14;
  s.velocity = add(
    s.velocity,
    mul(
      sub(
        mul(sub(targetBody, s.body), omega * omega),
        mul(s.velocity, 2 * omega),
      ),
      dt,
    ),
  );
  if (exiting && length(s.velocity) > Math.max(1, gait))
    s.velocity = mul(unit(s.velocity), Math.max(1, gait));
  s.body = add(s.body, mul(s.velocity, dt));
  if (!s.transfer) {
    // Never let the follow lag drop the body into the support it grips.
    const above = dot(sub(s.body, s.anchor), s.normal);
    if (above < 0.35 * height)
      s.body = add(s.body, mul(s.normal, 0.35 * height - above));
  }
  // 6. Lean toward the surface, rate-limited so an edge never flips the body.
  const tilt = Math.acos(clamp(dot(s.up, targetUp), -1, 1));
  if (tilt > 1e-6)
    s.up = unit(
      rotate(
        s.up,
        unit(cross(s.up, targetUp), unit(cross(s.up, s.poseForward))),
        Math.min(tilt, (t ? 6 : 2) * dt),
      ),
    );
  const poseHeading = unit(transport(s.forward, s.normal, s.up), s.forward);
  if (!t && !s.settling && !s.poseHeld) s.poseForward = poseHeading;
  else {
    const carriedHeading = unit(transport(previousForward, previousUp, s.up));
    const yaw = Math.atan2(
      dot(cross(carriedHeading, poseHeading), s.up),
      dot(carriedHeading, poseHeading),
    );
    s.poseForward = unit(
      rotate(carriedHeading, s.up, clamp(yaw, -2.8 * dt, 2.8 * dt)),
    );
  }
  // 7. Body volume stays outside the planes around its edge.
  const edge = s.transfer;
  if (edge)
    keepClear(
      s,
      {
        point: edge.fromPoint ?? sub(edge.from!, mul(edge.fromNormal!, height)),
        normal: edge.fromNormal!,
      },
      edge,
      edge.convex,
    );
  // A large body can reach the next edge before its tail has left the last one.
  if (s.trail) {
    const { lowA, lowB, margin } = keepClear(
      s,
      { point: s.anchor, normal: s.normal },
      s.trail,
      s.trail.convex,
    );
    if ((s.trail.convex ? lowA : lowB) > 2 * margin) delete s.trail;
  } else if (!edge)
    keepClear(s, { point: s.anchor, normal: s.normal }, undefined, false);
  if (t || s.settling || s.trail || s.poseHeld)
    constrainPose(s, previous, previousUp, previousForward, dt, world);
  if (s.lowClearance) s.poseHeld = true;
  s.phase = (s.phase + length(sub(s.body, previous)) / (1.6 * scale)) % 1;
}

/**
 * Four contacts for renderers that still expect solved feet (older clients and
 * the current wire format). Derived from the body alone: no rays, no state.
 */
export function pleatContactFeet(s: {
  body: V3;
  up: V3;
  forward: V3;
  poseForward?: V3;
  scale: number;
  phase?: number;
}) {
  const up = unit(s.up),
    forward = unit(tangent(s.poseForward ?? s.forward, up), vec(0, 0, -1)),
    right = unit(cross(forward, up)),
    floor = sub(s.body, mul(up, 0.8 * s.scale)),
    phase = s.phase ?? 0;
  return PLEAT_REST.map((p, i) => {
    // Diagonal pairs alternate; a raised foot is in swing.
    const cycle = (phase + (i === 0 || i === 3 ? 0 : 0.5)) % 1,
      swing = Math.max(0, Math.sin(cycle * Math.PI * 2));
    const stride = Math.cos(cycle * Math.PI * 2) * 0.22 * s.scale;
    return {
      point: add(
        add(floor, mul(right, p.x * s.scale)),
        add(
          mul(forward, -p.z * s.scale + stride),
          mul(up, swing * 0.16 * s.scale),
        ),
      ),
      normal: up,
      planted: swing === 0,
    };
  });
}
