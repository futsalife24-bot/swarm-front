import {
  add,
  sub,
  mul,
  dot,
  cross,
  length,
  unit,
  mix,
  tangent,
  rotate,
  transport,
  newell,
  clamp,
  vec,
  type V3,
} from "./surface-math";
import type { SurfaceHit } from "./surface-ray";

export interface PleatSurface {
  ray(origin: V3, direction: V3, distance: number): SurfaceHit | undefined;
  /** Optional moving support transform; static map supports need no conversion. */
  local?(surface: string, world: V3): V3;
  world?(surface: string, local: V3): V3;
}
export interface PleatFoot {
  point: V3;
  normal: V3;
  planted: boolean;
  support: V3;
  supportNormal: V3;
  target: V3;
  targetNormal: V3;
  surface: string;
  local?: V3;
  targetSurface: string;
  targetLocal?: V3;
  elapsed: number;
  duration: number;
  phase: number;
  lift: number;
  reachable: boolean;
}
export interface PleatState {
  anchor: V3;
  normal: V3;
  forward: V3;
  poseForward: V3;
  body: V3;
  up: V3;
  velocity: V3;
  travel: V3;
  feet: PleatFoot[];
  scale: number;
  phase: number;
  speed: number;
  transfer?: {
    point: V3;
    normal: V3;
    forward: V3;
    surface: string;
    age: number;
    convex: boolean;
    prepared: boolean;
  };
  /** While rear feet are transferring they may never choose the previous plane. */
  settling: boolean;
  switches: number;
}
export const PLEAT_REST = [
  vec(-0.86, 0, -1.02),
  vec(0.86, 0, -1.02),
  vec(-0.86, 0, 1.16),
  vec(0.86, 0, 1.16),
];
const UP = vec(0, 1, 0);
const NEIGHBOURS = [
  [1, 2],
  [0, 3],
  [0, 3],
  [1, 2],
];
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
  const s: PleatState = {
    anchor: { ...anchor },
    normal: { ...UP },
    poseForward: unit(tangent(forward, UP), vec(0, 0, -1)),
    forward: unit(tangent(forward, UP), vec(0, 0, -1)),
    body: add(anchor, vec(0, 0.8 * scale, 0)),
    up: { ...UP },
    velocity: vec(),
    travel: vec(),
    feet: [],
    scale,
    phase: 0,
    speed: 0,
    settling: false,
    switches: 0,
  };
  s.feet = PLEAT_REST.map((p, i) => {
    const ideal = add(anchor, offset(s, p)),
      hit = world.ray(add(ideal, mul(UP, scale)), mul(UP, -1), 2 * scale);
    const point = hit?.point ?? ideal,
      normal = hit?.normal ?? UP;
    return {
      point,
      normal,
      support: { ...point },
      supportNormal: { ...normal },
      planted: true,
      target: { ...point },
      targetNormal: { ...normal },
      surface: hit?.surface ?? "",
      local: hit && world.local?.(hit.surface, point),
      targetSurface: "",
      elapsed: 0,
      duration: 0.2,
      phase: (i === 0 || i === 3 ? 0 : 0.5) + (i >= 2 ? 0.08 : 0),
      lift: 0.2 * scale,
      reachable: !!hit,
    };
  });
  return s;
}
/** Three ordered casts: hip-to-goal, down to floor, back under convex edge. */
export function pleatFoothold(
  s: PleatState,
  i: number,
  target: V3,
  world: PleatSurface,
  wanted?: V3,
): SurfaceHit | undefined {
  const hip = pleatHip(s, i),
    delta = sub(target, hip),
    n = wanted ?? s.normal;
  const valid = (h?: SurfaceHit) =>
    h && (!wanted || dot(h.normal, wanted) > 0.7) ? h : undefined;
  return (
    valid(world.ray(hip, unit(delta), length(delta) + 0.25 * s.scale)) ??
    valid(
      world.ray(add(target, mul(n, 1.4 * s.scale)), mul(n, -1), 2.8 * s.scale),
    ) ??
    valid(
      world.ray(
        sub(target, mul(s.normal, 0.4 * s.scale)),
        unit(sub(hip, target)),
        2.5 * s.scale,
      ),
    )
  );
}
function beginStep(
  s: PleatState,
  foot: PleatFoot,
  hit: SurfaceHit,
  duration: number,
  probe: boolean,
  world: PleatSurface,
) {
  foot.planted = false;
  foot.support = { ...foot.point };
  foot.supportNormal = { ...foot.normal };
  foot.target = { ...hit.point };
  foot.targetNormal = { ...hit.normal };
  foot.targetSurface = hit.surface;
  foot.targetLocal = world.local?.(hit.surface, hit.point);
  foot.elapsed = 0;
  foot.duration = duration;
  foot.lift =
    ((probe ? 0.48 : 0.22) +
      (Math.max(0, dot(sub(hit.point, foot.point), s.up)) / s.scale) * 0.4) *
    s.scale;
  foot.reachable = true;
}
function switchSurface(s: PleatState) {
  const t = s.transfer!;
  s.forward = unit(
    tangent(transport(s.forward, s.normal, t.normal), t.normal),
    t.forward,
  );
  s.anchor = { ...t.point };
  s.normal = { ...t.normal };
  s.transfer = undefined;
  s.settling = true;
  s.switches++;
}
/** Ray-only, fixed small substeps; state is plain JSON for authoritative snapshots. */
export function stepPleat(
  s: PleatState,
  direction: V3,
  speed: number,
  dt: number,
  world: PleatSurface,
) {
  let remaining = clamp(dt, 0, 0.1);
  while (remaining > 1e-8) {
    const h = Math.min(1 / 60, remaining);
    step(s, direction, speed, h, world);
    remaining -= h;
  }
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
    before = { ...s.anchor };
  const previousBody = { ...s.body },
    previousUp = { ...s.up },
    previousForward = { ...s.poseForward };
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
  // 2. Anchor: look far enough ahead to stop the head before a wall.
  const clearance = 1.12 * scale + 0.08,
    look = clearance + speed * dt;
  if (!s.transfer && !s.settling && speed > 0.001) {
    const front = world.ray(
      add(s.anchor, mul(s.normal, 0.18 * scale)),
      s.forward,
      look,
    );
    const ahead = add(s.anchor, mul(s.forward, look));
    const down = world.ray(
      add(ahead, mul(s.normal, 0.3 * scale)),
      mul(s.normal, -1),
      0.65 * scale,
    );
    let next = front && dot(front.normal, s.normal) < 0.65 ? front : undefined;
    let convex = false;
    if (!next && !down) {
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
    if (next) {
      const forward = unit(
        tangent(transport(s.forward, s.normal, next.normal), next.normal),
      );
      const point = convex
        ? next.point
        : add(next.point, mul(s.normal, height - 0.18 * scale));
      s.transfer = {
        point,
        normal: next.normal,
        forward,
        surface: next.surface,
        age: 0,
        convex,
        prepared: false,
      };
    }
  }
  const stretched = s.feet.some(
    (foot, i) =>
      foot.planted &&
      foot.reachable &&
      length(sub(foot.point, pleatHip(s, i))) >
        (i < 2 ? 1.912 : 1.842) * scale * 0.88 &&
      dot(sub(foot.point, pleatHip(s, i)), s.forward) < 0,
  );
  const leading = dot(sub(s.anchor, s.body), s.forward) > scale * 0.65;
  const targetSpeed =
    s.transfer || s.settling || stretched || leading ? 0 : speed;
  s.speed += clamp(targetSpeed - s.speed, -20 * scale * dt, 10 * scale * dt);
  if (stretched || leading) s.speed = 0;
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
  const travel = mul(sub(s.anchor, before), 1 / dt);
  // 3. Feet: retain the liftoff support until landing; never retarget a swing.
  const frequency = Math.min(4.6, 1.4 + (1.15 * s.speed) / scale);
  const swingRatio = 0.36 + 0.14 * clamp(s.speed / (4 * scale), 0, 1);
  const phaseBefore = s.phase;
  s.phase = (s.phase + frequency * dt) % 1;
  let landed = 0;
  // Parallel floors can face the same way while being metres apart (for
  // example the yard ground and the top of its thin perimeter wall).
  const onAnchorPlane = (foot: PleatFoot) =>
    dot(foot.normal, s.normal) > 0.8 &&
    Math.abs(dot(sub(foot.point, s.anchor), s.normal)) < 0.3 * scale;
  if (s.settling)
    for (const foot of s.feet)
      if (
        foot.planted &&
        dot(foot.normal, s.normal) > 0.8 &&
        Math.abs(dot(sub(foot.point, s.anchor), s.normal)) > scale
      )
        foot.reachable = false;
  // Four-legged PLEAT has fewer supports than the eight-legged reference.
  // Gather its rear pair beneath the body BEFORE probing, so the final old
  // support is not a full stride behind the corner and cannot deadlock the IK.
  if (s.transfer && !s.transfer.prepared) {
    const ready = [2, 3].every(
      (i) =>
        s.feet[i].planted &&
        length(
          sub(
            s.feet[i].point,
            add(s.anchor, offset(s, vec(PLEAT_REST[i].x, 0, 0.15))),
          ),
        ) <
          0.35 * scale,
    );
    if (ready) s.transfer.prepared = true;
    else
      for (const i of [2, 3]) {
        const foot = s.feet[i],
          target = add(s.anchor, offset(s, vec(PLEAT_REST[i].x, 0, 0.15)));
        if (
          !foot.planted ||
          length(sub(foot.point, target)) < 0.35 * scale ||
          !NEIGHBOURS[i].every((j) => s.feet[j].planted)
        )
          continue;
        const hit = pleatFoothold(s, i, target, world, s.normal);
        if (hit) beginStep(s, foot, hit, 0.16, false, world);
      }
  }
  for (const [i, foot] of s.feet.entries()) {
    if (foot.local && world.world) {
      const point = world.world(foot.surface, foot.local);
      if (foot.planted) foot.point = point;
      else foot.support = point;
    }
    if (!foot.planted) {
      foot.elapsed += dt;
      // Frozen in the support's local frame, so a moving box carries the goal.
      const goal =
        foot.targetLocal && world.world
          ? world.world(foot.targetSurface, foot.targetLocal)
          : foot.target;
      const t = clamp(foot.elapsed / foot.duration, 0, 1),
        smooth = t * t * (3 - 2 * t);
      const liftNormal = unit(
        add(add(foot.supportNormal, foot.targetNormal), s.up),
        s.up,
      );
      foot.point = add(
        mix(foot.support, goal, smooth),
        mul(liftNormal, Math.sin(Math.PI * t) * foot.lift),
      );
      foot.normal = unit(
        mix(foot.supportNormal, foot.targetNormal, smooth),
        s.up,
      );
      const hip = pleatHip(s, i),
        reach = (i < 2 ? 1.912 : 1.842) * scale;
      const canLand = length(sub(goal, hip)) < reach * 0.99;
      if (length(sub(foot.point, hip)) > reach * 0.99)
        foot.point = add(hip, mul(unit(sub(foot.point, hip)), reach * 0.99));
      if (t >= 1 && canLand) {
        foot.planted = true;
        foot.point = { ...goal };
        foot.normal = { ...foot.targetNormal };
        foot.surface = foot.targetSurface;
        foot.local = foot.targetLocal;
        foot.support = { ...goal };
        foot.supportNormal = { ...foot.normal };
        landed++;
      }
      continue;
    }
    if (
      !NEIGHBOURS[i].every(
        (j) => s.feet[j].planted && (s.feet[j].reachable || !foot.reachable),
      )
    )
      continue;
    const transfer = s.transfer;
    if (transfer && !transfer.prepared) continue;
    if (transfer && i >= 2) continue;
    if (transfer && dot(foot.normal, transfer.normal) > 0.8) continue;
    if (s.settling && !transfer && onAnchorPlane(foot)) continue;
    const n = transfer?.normal ?? s.normal,
      f = transfer?.forward ?? s.forward;
    let target = add(
      transfer?.point ?? s.anchor,
      offset(s, PLEAT_REST[i], n, f),
    );
    target = add(
      target,
      mul(
        f,
        transfer
          ? 0.14
          : s.speed *
              (swingRatio / frequency + (1 - swingRatio) / frequency / 2),
      ),
    );
    const drift = length(sub(target, foot.point)),
      hip = pleatHip(s, i),
      reach = (i < 2 ? 1.912 : 1.842) * scale;
    const wrapped = (phaseBefore + foot.phase) % 1 > (s.phase + foot.phase) % 1;
    const wrongSurface = s.settling && !onAnchorPlane(foot);
    if (
      !transfer &&
      !wrongSurface &&
      !(wrapped && drift > 0.03 * scale) &&
      length(sub(foot.point, hip)) < 0.98 * reach &&
      !(speed < 0.01 && drift > 0.22 * scale)
    )
      continue;
    const onSettlingPlane = (hit: SurfaceHit) =>
      !s.settling ||
      Math.abs(dot(sub(hit.point, s.anchor), s.normal)) < 0.3 * scale;
    let hit = pleatFoothold(s, i, target, world, n);
    if (hit && !onSettlingPlane(hit)) hit = undefined;
    if (!hit) {
      // The face of a thin lip cannot fit a full stride. Shorten only the probe,
      // then perform the next surface change; never retarget an airborne foot.
      for (const fraction of [0.5, 0.2, 0]) {
        const short = add(
          transfer?.point ?? s.anchor,
          add(
            mul(
              unit(cross(f, n)),
              PLEAT_REST[i].x * scale * Math.sqrt(fraction),
            ),
            mul(f, (-PLEAT_REST[i].z * scale + 0.14) * fraction),
          ),
        );
        hit = pleatFoothold(s, i, short, world, n);
        if (hit && !onSettlingPlane(hit)) hit = undefined;
        if (hit) break;
      }
    }
    if (hit && s.settling) {
      const closest = sub(
        hip,
        mul(hit.normal, dot(sub(hip, hit.point), hit.normal)),
      );
      for (const fraction of [0.2, 0.5, 0.8]) {
        const p = mix(closest, hit.point, fraction);
        const candidate = world.ray(
          add(p, mul(n, 0.4 * scale)),
          mul(n, -1),
          0.8 * scale,
        );
        if (
          candidate &&
          dot(candidate.normal, n) > 0.8 &&
          onSettlingPlane(candidate)
        ) {
          hit = candidate;
          break;
        }
      }
    }
    if (hit && !s.settling && length(sub(hit.point, hip)) > reach * 0.9) {
      const closest = sub(
        hip,
        mul(hit.normal, dot(sub(hip, hit.point), hit.normal)),
      );
      const original = hit;
      hit = undefined;
      for (const fraction of [0.75, 0.5, 0.25, 0]) {
        const p = mix(closest, original.point, fraction);
        const candidate = world.ray(
          add(p, mul(original.normal, 0.3 * scale)),
          mul(original.normal, -1),
          0.6 * scale,
        );
        if (
          candidate &&
          dot(candidate.normal, original.normal) > 0.8 &&
          length(sub(candidate.point, hip)) <= reach * 0.9
        ) {
          hit = candidate;
          break;
        }
      }
    }
    if (hit)
      beginStep(
        s,
        foot,
        hit,
        transfer ? 0.32 : s.settling ? 0.16 : swingRatio / frequency,
        !!transfer,
        world,
      );
    else if (!transfer && !s.settling) {
      foot.reachable = false;
      foot.point = sub(hip, mul(s.up, 0.5 * scale));
      // An unsupported folded foot cannot count as a planted support.
    }
  }
  if (s.transfer) {
    s.transfer.age += dt;
    if (
      s.feet
        .slice(0, 2)
        .every(
          (f) =>
            f.planted && f.reachable && dot(f.normal, s.transfer!.normal) > 0.8,
        ) ||
      s.transfer.age >= 1.4
    )
      switchSurface(s);
  }
  if (
    s.settling &&
    s.feet.every((f) => f.planted && f.reachable && onAnchorPlane(f))
  )
    s.settling = false;
  // 4. Support-weighted normal and Newell foot plane, body/anchor blend prevents deadlock.
  const supports = s.feet.map((f) => (f.planted ? f.point : f.support));
  let centroid = vec(),
    supportNormal = vec(),
    weightSum = 0;
  s.feet.forEach((foot, i) => {
    const n = foot.planted ? foot.normal : foot.supportNormal;
    const weight = foot.reachable
      ? 0.05 + Math.pow(Math.max(0, dot(n, s.normal)), 4)
      : 0;
    supportNormal = add(supportNormal, mul(n, weight));
    weightSum += weight;
    if (foot.reachable) centroid = add(centroid, supports[i]);
  });
  const supportCount = s.feet.filter((f) => f.reachable).length;
  centroid = supportCount ? mul(centroid, 1 / supportCount) : s.anchor;
  supportNormal = weightSum > 0 ? unit(supportNormal, s.normal) : s.normal;
  const plane = newell(
    [0, 1, 3, 2].filter((i) => s.feet[i].reachable).map((i) => supports[i]),
    supportNormal,
  );
  let up = unit(mix(supportNormal, plane, 0.65), s.normal);
  const acceleration = mul(sub(travel, s.travel), 1 / dt);
  // Bound lean; never let a surface transfer impulse flip the body.
  up = unit(
    sub(
      up,
      mul(
        tangent(acceleration, up),
        Math.min(0.012, 0.12 / Math.max(1, length(acceleration))),
      ),
    ),
    up,
  );
  const tilt = Math.acos(clamp(dot(s.up, up), -1, 1));
  s.up =
    tilt > 1e-6
      ? unit(
          rotate(
            s.up,
            unit(cross(s.up, up), unit(cross(s.up, s.poseForward))),
            Math.min(tilt * (1 - Math.exp(-10 * dt)), 2 * dt),
          ),
        )
      : up;
  s.poseForward = unit(transport(s.forward, s.normal, s.up));
  let targetBody = mix(
    add(s.anchor, mul(s.normal, height)),
    add(centroid, mul(plane, height)),
    0.65,
  );
  // Mixed supports on opposite sides of a lip must not pull the body through it.
  const anchorClearance = dot(sub(targetBody, s.anchor), s.normal);
  if (anchorClearance < height * 0.8)
    targetBody = add(targetBody, mul(s.normal, height * 0.8 - anchorClearance));
  if (s.settling && anchorClearance > height * 1.05)
    targetBody = sub(
      targetBody,
      mul(s.normal, anchorClearance - height * 1.05),
    );
  // Keep the spring's goal within reach of an arriving foot. This is a body
  // constraint, not a retarget: the frozen swing goal and liftoff support stay
  // intact, while the body can finish pulling the last rear foot onto the wall.
  for (const [i, foot] of s.feet.entries()) {
    if (foot.planted || foot.elapsed < foot.duration) continue;
    const hip = add(pleatHip(s, i), sub(targetBody, s.body));
    const delta = sub(foot.target, hip),
      reach = (i < 2 ? 1.912 : 1.842) * scale * 0.96;
    if (length(delta) > reach)
      targetBody = add(targetBody, mul(unit(delta), length(delta) - reach));
  }
  let shift = vec();
  s.feet.forEach((foot, i) => {
    if (!foot.planted)
      shift = sub(shift, tangent(sub(supports[i], centroid), s.up));
  });
  targetBody = add(
    targetBody,
    mul(unit(shift, vec()), Math.min(0.05, length(shift) * 0.04)),
  );
  s.velocity = sub(s.velocity, mul(s.up, landed * 0.18 * scale));
  const omega = 14;
  s.velocity = add(
    s.velocity,
    mul(
      sub(
        mul(sub(targetBody, s.body), omega * omega),
        mul(s.velocity, 1.85 * omega),
      ),
      dt,
    ),
  );
  if (s.settling && length(s.velocity) > 1.5 * scale)
    s.velocity = mul(unit(s.velocity), 1.5 * scale);
  s.body = add(s.body, mul(s.velocity, dt));
  // A planted foot is a physical constraint: throttle/pull the spring before
  // the render IK would have to shorten its reach and visibly slide the pad.
  for (let pass = 0; pass < 2; pass++)
    for (const [i, foot] of s.feet.entries()) {
      if (!foot.planted || !foot.reachable) continue;
      const delta = sub(foot.point, pleatHip(s, i));
      const reach = (i < 2 ? 1.912 : 1.842) * scale * 0.98;
      if (length(delta) > reach) {
        const toward = unit(delta);
        s.body = add(s.body, mul(toward, length(delta) - reach));
        const away = dot(s.velocity, toward);
        if (away < 0) s.velocity = sub(s.velocity, mul(toward, away));
      }
    }
  s.travel = travel;
  // 5. Three body spheres. The first outward hit distinguishes entering from
  // exiting a solid; casting back from outside can mistake a thin plate's far
  // side for an overlap and incorrectly push the body through the plate.
  for (const [y, z, radius] of [
    [0, -0.78, 0.32],
    [0.244, -0.434, 0.8],
    [0.302, 0.687, 0.96],
  ]) {
    const from = add(
      previousBody,
      offset(s, vec(0, y, z), previousUp, previousForward),
    );
    const to = add(s.body, offset(s, vec(0, y, z), s.up, s.poseForward));
    const motion = sub(to, from),
      distance = length(motion);
    if (distance > 1e-6) {
      const hit = world.ray(from, unit(motion), distance + radius * scale);
      if (hit && dot(hit.normal, motion) < 0) {
        const overlap = radius * scale - dot(sub(to, hit.point), hit.normal);
        if (overlap > 0) s.body = add(s.body, mul(hit.normal, overlap));
      }
    }
    for (const direction of [
      s.up,
      mul(s.up, -1),
      s.forward,
      mul(s.forward, -1),
      unit(cross(s.forward, s.up)),
      mul(unit(cross(s.forward, s.up)), -1),
    ]) {
      const center = add(s.body, offset(s, vec(0, y, z), s.up, s.poseForward));
      const r = radius * scale;
      const hit = world.ray(center, direction, r);
      if (!hit) continue;
      const depth = r - dot(sub(center, hit.point), hit.normal);
      if (depth > 0) {
        s.body = add(s.body, mul(hit.normal, Math.min(depth, 0.3 * scale)));
        const v = dot(s.velocity, hit.normal);
        if (v < 0) s.velocity = sub(s.velocity, mul(hit.normal, v));
      }
    }
  }
  // 6. Renderer solves the existing upper/lower/toe bones from these world feet.
  s.feet.forEach((foot, i) => {
    if (!foot.reachable)
      foot.point = sub(pleatHip(s, i), mul(s.up, 0.5 * scale));
  });
}
