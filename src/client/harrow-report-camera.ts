import * as T from "three";
import { HARROW, harrowMissilePosition } from "../shared/harrow";
import type { HoundClip } from "./hound-motion";
import { reportHarrowMissiles } from "./enemy-report-motion";
import { HARROW_REPORT_PROFILE } from "./harrow-report-camera-profile";

export const HARROW_REPORT_DIRECTION = new T.Vector3(
  HARROW_REPORT_PROFILE.source.viewDirection[0],
  HARROW_REPORT_PROFILE.source.viewDirection[1],
  HARROW_REPORT_PROFILE.source.viewDirection[2],
).normalize();

type ProjectionBins = { extent: number; depth: readonly (number | null)[] };
export type HarrowPoseFrame = {
  bounds: T.Box3;
  horizontal: ProjectionBins;
  vertical: ProjectionBins;
};
type RawProfile = {
  min: number[];
  max: number[];
  horizontal: ProjectionBins;
  vertical: ProjectionBins;
};
const hydrate = (profile: RawProfile): HarrowPoseFrame => ({
  bounds: new T.Box3(
    new T.Vector3(profile.min[0], profile.min[1], profile.min[2]),
    new T.Vector3(profile.max[0], profile.max[1], profile.max[2]),
  ),
  horizontal: profile.horizontal,
  vertical: profile.vertical,
});

/** Generated from v14's actual skinned poses; no skeleton work runs in the viewer. */
export const HARROW_POSE_FRAMES = {
  idle: hydrate(HARROW_REPORT_PROFILE.idle),
  move: hydrate(HARROW_REPORT_PROFILE.move),
};

export function harrowProfileDistance(
  frame: HarrowPoseFrame,
  verticalFov: number,
  aspect: number,
  padding = 1.1,
) {
  const vertical = Math.tan(T.MathUtils.degToRad(verticalFov / 2));
  let distance = 0;
  for (const [bins, tangent] of [
    [frame.horizontal, vertical * aspect],
    [frame.vertical, vertical],
  ] as const)
    for (let i = 0; i < bins.depth.length; i++) {
      if (bins.depth[i] === null) continue;
      const extent = (bins.extent * (i + 1)) / bins.depth.length;
      distance = Math.max(
        distance,
        bins.depth[i]! + (padding * extent) / tangent,
      );
    }
  return distance;
}

/** Framing coordinates are authored model units, while combat trajectories use world units. */
export function harrowReportBounds(rest: T.Box3, attack?: HoundClip) {
  const bounds = rest.clone();
  const includes = (clip: HoundClip) => attack === undefined || attack === clip;
  const flight = HARROW.flightHeight / HARROW.scale;
  const addBody = (height: number, z = 0) => {
    bounds.union(rest.clone().translate(new T.Vector3(0, height, z)));
  };

  if (includes("Spin")) {
    const reach = Math.max(
      Math.hypot(rest.min.x, rest.min.z),
      Math.hypot(rest.min.x, rest.max.z),
      Math.hypot(rest.max.x, rest.min.z),
      Math.hypot(rest.max.x, rest.max.z),
    );
    bounds.expandByPoint(new T.Vector3(-reach, rest.min.y, -reach));
    bounds.expandByPoint(new T.Vector3(reach, rest.max.y, reach));
  }

  if (
    attack === undefined ||
    [
      "Takeoff",
      "TakeoffB",
      "TakeoffC",
      "TakeoffD",
      "Flight",
      "AirThreat",
      "BombPass",
      "Glide",
      "Dive",
      "StaggerFall",
    ].includes(attack)
  )
    addBody(flight);
  if (includes("Dash")) addBody(0, -HARROW.dashDistance / HARROW.scale);
  if (includes("BombPass")) addBody(flight, -40 / HARROW.scale);

  const missiles = [
    ...(includes("Threat") ? reportHarrowMissiles() : []),
    ...(includes("AirThreat") ? reportHarrowMissiles(true) : []),
    ...(includes("Snipe") ? reportHarrowMissiles(false, "snipe") : []),
    ...(includes("BombPass") ? reportHarrowMissiles(true, "bomb") : []),
  ];
  for (const missile of missiles)
    for (let step = 0; step <= 20; step++) {
      const point = harrowMissilePosition(
        missile,
        missile.launch + ((missile.impact - missile.launch) * step) / 20,
      );
      bounds.expandByPoint(
        new T.Vector3(point.x, point.y, point.z).multiplyScalar(
          1 / HARROW.scale,
        ),
      );
    }
  return bounds;
}

/** Minimum perspective distance that keeps every box corner inside both axes. */
export function projectedBoxDistance(
  halfSize: T.Vector3,
  direction: T.Vector3,
  verticalFov: number,
  aspect: number,
  padding = 1.1,
) {
  const forward = direction.clone().normalize();
  const right = new T.Vector3(forward.z, 0, -forward.x).normalize();
  const up = forward.clone().cross(right);
  const vertical = Math.tan(T.MathUtils.degToRad(verticalFov / 2));
  let distance = 0;
  for (const x of [-1, 1])
    for (const y of [-1, 1])
      for (const z of [-1, 1]) {
        const corner = new T.Vector3(
          x * halfSize.x,
          y * halfSize.y,
          z * halfSize.z,
        );
        const fit = Math.max(
          Math.abs(corner.dot(right)) / (vertical * aspect),
          Math.abs(corner.dot(up)) / vertical,
        );
        distance = Math.max(distance, corner.dot(forward) + fit * padding);
      }
  return distance;
}
