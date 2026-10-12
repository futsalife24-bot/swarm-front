"""Bake HARROW's eighteen clips on the preserved upright 39-bone v11 rig.

Call ``animate(rig, metadata)`` after rigging and before saving/exporting the
candidate .blend.  Coordinates in metadata are *Blender armature-local*, Z up,
forward -X; they must be measured on the assembled new mesh.  This module does
not import or transplant v10 geometry, bind poses, keyframes, or quadruped IK.

Required metadata::

    {
      "wing_contacts": {
        ".L": {"bone": "Wing fan.L", "point": (x, y, z)},
        ".R": {"bone": "Wing fan.R", "point": (x, y, z)}},
      "wing_samples": {".L": [{"bone": "Wing fan.L", "point": (x,y,z)}, ...],
                       ".R": [...]},
      "ground_contacts": {
        ".L": {"bone": "Hindlimb.L.3", "point": (x, y, z)},
        ".R": {"bone": "Hindlimb.R.3", "point": (x, y, z)}},
      "launcher_tips": [{"bone": "Wing fore.L", "point": (x,y,z)}, ...],
    }

Each supplied point is a rest-pose mesh coordinate rigidly driven by its bone.
Use actual wing hull/extreme vertices for ``wing_samples``, not only a joint
tail. Skin-blended tips need later vertex-level validation. The returned
``launchers`` are measured Blender coordinates at clip time 3.5 s; conversion
to the game frame and authority-side missile updates happen separately.
"""

from __future__ import annotations

import math
import numpy as np
from mathutils import Matrix, Quaternion, Vector

# Every authoritative duration is an integer number of frames at 40 fps,
# including the 2.625-second stagger; glTF NLA export truncates partial frames.
FPS = 40
GAME_SCALE = 1.95
WALK_SPEED = 0.64 / GAME_SCALE
WALK_STEPS_PER_CLIP = 3
FIRE_TIME = 3.5
SPIN_WIND = 1.15
SPIN_SWEEP_END = 2.20
DURATIONS = {
    "Idle": 7.0,
    "Locomotion": 4.2,
    "Attack": 5.25,
    "Threat": 7.0,
    "AirThreat": 7.0,
    "Spin": 3.0,
    "Takeoff": 3.5,
    "Flight": 16.8,
    "Glide": 2.1,
    "Dive": 0.9,
    "StaggerFall": 2.625,
    "Land": 1.75,
    "Dash": 2.1,
    "Snipe": 4.0,
    "BombPass": 3.7,
    "TakeoffB": 3.5,
    "TakeoffC": 3.5,
    "TakeoffD": 3.5,
}

REQUIRED_BONES = (
    "Root", "Torso", "Head", "Jaw",
    *(f"Neck.{i:02d}" for i in range(6)),
    *(f"Tail.{i:02d}" for i in range(7)),
    *(f"{limb}.{side}.{i}" for limb in ("Forelimb", "Hindlimb")
      for side in ("L", "R") for i in range(4)),
    *(f"Wing {part}.{side}" for side in ("L", "R")
      for part in ("upper", "fore", "fan")),
)


def _clamp(value: float) -> float:
    return max(0.0, min(1.0, value))


def _smooth(value: float) -> float:
    t = _clamp(value)
    return t * t * (3.0 - 2.0 * t)


def _pulse(time: float, rise: float, peak: float, fall: float) -> float:
    if time < rise or time >= fall:
        return 0.0
    if time < peak:
        return _smooth((time - rise) / (peak - rise))
    return 1.0 - _smooth((time - peak) / (fall - peak))


def _axis_rotation(rig, bone_name: str, axis: str, angle: float) -> Quaternion:
    """Convert a Blender armature-space axis to this bone's rest local axes."""
    rest = rig.data.bones[bone_name].matrix_local.to_quaternion()
    world_axis = {"X": Vector((1, 0, 0)),
                  "Y": Vector((0, 1, 0)),
                  "Z": Vector((0, 0, 1))}[axis]
    return Quaternion(rest.inverted() @ world_axis, angle)


def _rotate(rig, name: str, axis: str, angle: float) -> None:
    bone = rig.pose.bones[name]
    bone.rotation_quaternion = bone.rotation_quaternion @ _axis_rotation(
        rig, name, axis, angle
    )


def _point_now(rig, contact) -> Vector:
    """Armature-space position of a contact rigidly bound to its declared bone."""
    name = contact["bone"]
    return (rig.pose.bones[name].matrix
            @ rig.data.bones[name].matrix_local.inverted()
            @ Vector(contact["point"]))


def _wing_cache(rig, metadata) -> dict:
    """Group rigid wing points by bone once; cache inverse rests and arrays."""
    cache = {}
    for side in (".L", ".R"):
        groups = {}
        for item in [metadata["wing_contacts"][side],
                     *metadata["wing_samples"][side]]:
            groups.setdefault(item["bone"], []).append(item["point"])
        cache[side] = [
            (name, rig.data.bones[name].matrix_local.inverted(),
             np.asarray(points, dtype=np.float64))
            for name, points in groups.items()
        ]
    return cache


def _wing_points(rig, grouped, full: bool = False):
    """Exact rest points under one pose, with no per-vertex Blender transforms."""
    values = []
    for name, inverse_rest, points in grouped:
        matrix = rig.pose.bones[name].matrix @ inverse_rest
        z = (points @ np.array((matrix[2][0], matrix[2][1], matrix[2][2]))
             + matrix[2][3])
        if full:
            x = (points @ np.array((matrix[0][0], matrix[0][1], matrix[0][2]))
                 + matrix[0][3])
            y = (points @ np.array((matrix[1][0], matrix[1][1], matrix[1][2]))
                 + matrix[1][3])
            values.append((x, y, z))
        else:
            values.append(float(z.min()))
    return values


def _validate(rig, metadata) -> None:
    if rig.type != "ARMATURE":
        raise TypeError("HARROW animation requires an armature object")
    names = set(rig.pose.bones.keys())
    absent = set(REQUIRED_BONES) - names
    if absent or len(rig.pose.bones) != 39:
        raise ValueError(f"HARROW requires the 39 named bones; missing={sorted(absent)}")
    if rig.scale != Vector((1, 1, 1)):
        raise ValueError("Apply rig object scale before animation/export")
    for group in ("wing_contacts", "ground_contacts"):
        for side in (".L", ".R"):
            item = metadata[group][side]
            if item["bone"] not in names or len(item["point"]) != 3:
                raise ValueError(f"Invalid {group} {side}")
            if not all(math.isfinite(float(v)) for v in item["point"]):
                raise ValueError(f"Non-finite {group} {side}")
    for side in (".L", ".R"):
        samples = metadata["wing_samples"][side]
        if len(samples) < 3:
            raise ValueError(f"{side} requires at least three actual wing samples")
        for item in samples:
            if item["bone"] not in names or len(item["point"]) != 3:
                raise ValueError(f"Invalid {side} wing sample")
            if not all(math.isfinite(float(v)) for v in item["point"]):
                raise ValueError(f"Non-finite {side} wing sample")
    tips = metadata["launcher_tips"]
    if len(tips) != 10:
        raise ValueError("Exactly ten launcher tips are required")
    for item in tips:
        if item["bone"] not in names or len(item["point"]) != 3:
            raise ValueError("Invalid launcher tip")
        if not all(math.isfinite(float(v)) for v in item["point"]):
            raise ValueError("Non-finite launcher tip")


def _reset(rig) -> None:
    for bone in rig.pose.bones:
        bone.rotation_mode = "QUATERNION"
        bone.location = (0, 0, 0)
        bone.rotation_quaternion = (1, 0, 0, 0)
        bone.scale = (1, 1, 1)


def _wing(rig, side: str, spread: float, fan: float = 0.0) -> None:
    sign = 1 if side == ".L" else -1
    _rotate(rig, "Wing upper" + side, "X", sign * spread)
    _rotate(rig, "Wing fore" + side, "X", sign * spread * 0.30)
    _rotate(rig, "Wing fan" + side, "Z", sign * fan)


def _spin_contact(rig, wing_cache, side: str, amount: float) -> None:
    """Search shoulder angle against each new asymmetric wing's own tip.

    The torso remains at its authored height.  Fail if the blade cannot reach
    the floor instead of hiding a too-short wing by moving the whole body.
    """
    if amount < 1e-6:
        return
    import bpy

    grouped = wing_cache[side]
    name = "Wing upper" + side
    baseline = rig.pose.bones[name].rotation_quaternion.copy()
    bpy.context.view_layer.update()
    parent = rig.pose.bones[name].parent
    orientation = (parent.matrix.to_quaternion()
                   @ rig.data.bones[parent.name].matrix_local.to_quaternion().inverted()
                   @ rig.data.bones[name].matrix_local.to_quaternion() @ baseline)
    # In a prone torso pose the rest-local X hinge no longer points forward.
    # Solve the blade contact about the actual world-horizontal forward axis.
    hinge = orientation.inverted() @ Vector((1, 0, 0))

    def floor_at(angle):
        rig.pose.bones[name].rotation_quaternion = (
            baseline @ Quaternion(hinge, angle)
        )
        bpy.context.view_layer.update()
        return min(_wing_points(rig, grouped))

    # A coarse scan locates a sign change.  Bisection then reaches the floor
    # precisely; a fixed 2.5-degree grid can miss an otherwise valid pose.
    target = 0.025
    scan = [(-1.6 + i * 0.16) for i in range(21)]
    heights = [floor_at(angle) for angle in scan]
    brackets = [(i, i + 1) for i in range(len(scan) - 1)
                if (heights[i] - target) * (heights[i + 1] - target) <= 0]
    if not brackets:
        closest = min(range(len(scan)), key=lambda i: abs(heights[i] - target))
        lo = scan[max(0, closest - 1)]
        hi = scan[min(len(scan) - 1, closest + 1)]
        # A tangent contact has no sign change.  Refine the nearest valley
        # rather than rejecting a valid floor pose on the coarse grid.
        for _ in range(20):
            a, b = lo + (hi - lo) / 3, hi - (hi - lo) / 3
            if abs(floor_at(a) - target) < abs(floor_at(b) - target):
                hi = b
            else:
                lo = a
        angle = (lo + hi) * 0.5
        height = floor_at(angle)
        # During windup this is only the destination of a partial blend;
        # the wing is deliberately still above ground. Require actual contact
        # at full sweep weight, not at a hypothetical early destination.
        if amount > 0.995 and not (0.0 <= height * GAME_SCALE <= 0.10):
            raise ValueError(
                f"{side} wing cannot reach Spin ground: nearest Z={height:.3f}; "
                "fix wing geometry or rig attachment"
            )
    else:
        lower, upper = min(brackets,
                           key=lambda ij: min(abs(scan[ij[0]]), abs(scan[ij[1]])))
        lo, hi = scan[lower], scan[upper]
        flo = heights[lower] - target
        for _ in range(18):
            mid = (lo + hi) * 0.5
            fm = floor_at(mid) - target
            if flo * fm <= 0:
                hi = mid
            else:
                lo, flo = mid, fm
        angle = (lo + hi) * 0.5
    rig.pose.bones[name].rotation_quaternion = (
        baseline @ Quaternion(hinge, angle * amount)
    )
    if amount > 0.995:
        bpy.context.view_layer.update()
        vertices = _wing_points(rig, grouped, full=True)
        min_height = min(float(z.min()) for _, _, z in vertices)
        reach = max((float(np.sqrt((x[mask] ** 2 + y[mask] ** 2).max()))
                     for x, y, z in vertices
                     if (mask := z * GAME_SCALE < 2.0).any()), default=0.0)
        if not (-0.004 <= min_height * GAME_SCALE <= 0.10):
            raise ValueError(f"{side} Spin wing floor height {min_height * GAME_SCALE:.3f} m")
        if reach * GAME_SCALE < 21.2:
            raise ValueError(f"{side} Spin wing reach {reach * GAME_SCALE:.3f} m < 21.2 m")


def _level_claw(rig, name: str) -> None:
    """Keep each hind claw's rest orientation after hip/knee corrections."""
    claw = rig.pose.bones[name]
    parent = claw.parent
    rest = rig.data.bones
    incoming = (parent.matrix.to_quaternion()
                @ rest[parent.name].matrix_local.to_quaternion().inverted()
                @ rest[name].matrix_local.to_quaternion())
    claw.rotation_quaternion = (
        incoming.inverted() @ rest[name].matrix_local.to_quaternion()
    ).normalized()


def _plant_hind(rig, contact, target: Vector) -> float:
    """Solve three actual leg segments in 3D; keep the claw level and planted."""
    import bpy

    bpy.context.view_layer.update()
    prefix = contact["bone"].rsplit(".", 1)[0]
    names = [prefix + f".{i}" for i in range(4)]
    rest = {name: rig.data.bones[name].matrix_local.copy() for name in names}
    original = [rig.data.bones[name].head_local.copy() for name in names]
    start = rig.pose.bones[names[0]].head.copy()
    # The measured contact is below the claw-bone head on this upright rig.
    # Preserve the claw's rest orientation, and solve its head accordingly.
    end = original[3] + target - Vector(contact["point"])
    lengths = [(original[i + 1] - original[i]).length for i in range(3)]
    if (end - start).length > sum(lengths) + 0.02:
        raise ValueError(f"{prefix} cannot reach planted claw with its three bones")
    points = [p.copy() for p in original]
    points[0] = start
    for _ in range(80):
        points[3] = end.copy()
        for i in (2, 1, 0):
            direction = points[i] - points[i + 1]
            if direction.length < 1e-8:
                direction = original[i] - original[i + 1]
            points[i] = points[i + 1] + direction.normalized() * lengths[i]
        points[0] = start.copy()
        for i in range(3):
            direction = points[i + 1] - points[i]
            if direction.length < 1e-8:
                direction = original[i + 1] - original[i]
            points[i + 1] = points[i] + direction.normalized() * lengths[i]
        if (points[3] - end).length < 1e-5:
            break
    posed = {}
    for i, name in enumerate(names):
        if i < 3:
            rotation = (original[i + 1] - original[i]).rotation_difference(
                points[i + 1] - points[i]
            ).to_matrix().to_4x4()
            desired = (Matrix.Translation(points[i]) @ rotation
                       @ Matrix.Translation(-original[i]) @ rest[name])
        else:
            desired = Matrix.Translation(points[3] - original[3]) @ rest[name]
        parent = rig.data.bones[name].parent.name
        parent_rest = rig.data.bones[parent].matrix_local
        parent_pose = posed.get(parent, rig.pose.bones[parent].matrix)
        rig.pose.bones[name].matrix_basis = (
            rest[name].inverted() @ parent_rest @ parent_pose.inverted() @ desired
        )
        posed[name] = desired
    bpy.context.view_layer.update()
    final = _point_now(rig, contact)
    return math.hypot(final.x - target.x, final.z - target.z)


def _pose(rig, metadata, wing_cache, clip: str, time: float) -> None:
    _reset(rig)
    duration = DURATIONS[clip]
    u = _clamp(time / duration)
    cycle = 2 * math.pi * u
    idle = clip == "Idle"
    moving = clip == "Locomotion"
    takeoff = clip.startswith("Takeoff")
    variant = {"Takeoff": 0, "TakeoffB": 1, "TakeoffC": 2, "TakeoffD": 3}.get(clip, 0)
    threat = clip in ("Threat", "AirThreat")
    air = clip in ("Flight", "AirThreat", "Glide", "Dive", "StaggerFall", "BombPass")
    cruise = clip in ('Flight', 'Glide', 'BombPass')
    cruise_weight = (1.0 if cruise else
                     _smooth((u - 0.55) / 0.45) if takeoff else
                     1 - _smooth(u / 0.35) if clip == 'Dive' else 0.0)
    air_weight = (_smooth((u - 0.24) / 0.52) if takeoff else
                  1 - _smooth(u) if clip == "Land" else
                  1.0 if air else 0.0)
    wind = _pulse(time, 0.4, FIRE_TIME, 5.4) if threat else 0.0
    swing = _pulse(time, 0.45, 2.1, 3.2) if clip == "Attack" else 0.0
    spin_coil = _pulse(time, 0.0, 0.95, 1.45) if clip == "Spin" else 0.0
    spin_sweep = (_smooth((time - 0.85) / 0.30)
                  * (1 - _smooth((time - 2.20) / 0.48))) if clip == "Spin" else 0.0
    spin_brake = _pulse(time, 1.90, 2.28, 3.0) if clip == "Spin" else 0.0
    # Lower the trunk before its wings sweep, and let the legs carry it.
    crouch = (_smooth(time / 0.85) * (1 - _smooth((time - 2.2) / 0.8))
              if clip == "Spin" else 0.0)
    dash_coil = _pulse(time, 0.0, 0.65, 0.85) if clip == "Dash" else 0.0
    dash_drive = (_smooth((time - 0.65) / 0.15) * (1 - _smooth((time - 1.5) / 0.6))
                  if clip == "Dash" else 0.0)
    aim = (_smooth(time / 1.7) * (1 - _smooth((time - 2.8) / 1.2))
           if clip == "Snipe" else 0.0)
    launch_coil = _pulse(u, 0.0, 0.22, 0.36) if takeoff else 0.0
    landing = _pulse(u, 0.0, 0.22, 1.0) if clip == "Land" else 0.0
    step_cycle = cycle * WALK_STEPS_PER_CLIP
    torso = rig.pose.bones['Torso']
    shift = Vector((0, 0, -3.0 * crouch - 0.65 * launch_coil - 0.75 * landing
                    - 0.35 * dash_coil - 0.22 * dash_drive))
    if moving:
        shift.y = 0.22 * math.sin(step_cycle)
        shift.z = -0.12 * (1 - math.cos(2 * step_cycle))
    elif idle:
        shift.y = 0.055 * math.sin(cycle)
        shift.z = -0.035 * (1 - math.cos(cycle))
    torso.location = rig.data.bones['Torso'].matrix_local.to_quaternion().inverted() @ shift

    # Root translation/yaw are authority-owned.  Upright chest, small arms,
    # hind-only stance, and the long neck remain distinguishable at every phase.
    _rotate(rig, "Torso", "Y",
            0.22 * air_weight
            - 0.60 * cruise_weight
            - (0.20 * math.sin(math.pi * u) ** 2 if clip == "Dive" else 0.0)
            - 0.85 * crouch - 0.28 * dash_drive - 0.15 * dash_coil
            - 0.12 * launch_coil - 0.12 * landing - 0.12 * aim
            - (0.10 * math.sin(step_cycle) ** 2 if moving else 0.0))
    if moving:
        _rotate(rig, 'Torso', 'X', 0.035 * math.sin(step_cycle))
        _rotate(rig, 'Torso', 'Z', 0.045 * math.sin(step_cycle))
    for index in range(6):
        _rotate(rig, f"Neck.{index:02d}", "Y",
                (0.012 * math.sin(cycle - index * 0.27) if idle or moving else 0.0)
                - 0.025 * air_weight + 0.018 * wind - 0.026 * swing
                - 0.045 * crouch + 0.030 * dash_drive + 0.020 * landing
                + (0.012 * math.cos(2 * step_cycle - index * 0.22) * math.sin(step_cycle) ** 2 if moving else 0))
    _rotate(rig, "Head", "Y", 0.10 * swing - 0.15 * air_weight + 0.04 * wind)
    _rotate(rig, "Jaw", "Y", -0.25 * swing - 0.06 * wind)
    for index in range(7):
        if index == 0:
            _rotate(rig, 'Tail.00', 'Y', -0.22 * air_weight + 0.55 * crouch + 0.40 * cruise_weight)
        _rotate(rig, f"Tail.{index:02d}", "Z",
                (0.020 * math.sin(cycle - index * 0.38) if idle or moving else 0.0)
                + 0.035 * spin_coil - 0.025 * spin_brake
                + (0.015 * math.sin(step_cycle - index * 0.35) * math.sin(step_cycle) ** 2 if moving else 0))

    # Only the two hind legs are grounded.  The upper arms gesture and tuck;
    # they never receive a quadruped gait or invented floor contacts.
    for side, phase in ((".L", 0.0), (".R", 0.5)):
        gait = ((u * WALK_STEPS_PER_CLIP + phase) % 1.0) if moving else 0.0
        stride = math.sin(2 * math.pi * gait) if moving else 0.0
        lift = max(0.0, math.sin(2 * math.pi * gait)) if moving else 0.0
        _rotate(rig, "Hindlimb" + side + ".0", "Y",
                0.15 * stride + 0.12 * air_weight + 0.06 * spin_brake)
        _rotate(rig, "Hindlimb" + side + ".1", "Y",
                -0.20 * lift - 0.20 * air_weight)
        _rotate(rig, "Hindlimb" + side + ".2", "Y",
                0.10 * lift + 0.08 * air_weight)
        if clip == 'Dive':
            # Present the two talons, not the head, along the descending path.
            reach = _smooth(u / 0.25) * (1 - _smooth((u - 0.6) / 0.3))
            _rotate(rig, 'Hindlimb' + side + '.0', 'Y', 0.95 * reach)
            _rotate(rig, 'Hindlimb' + side + '.1', 'Y', -0.30 * reach)
            _rotate(rig, 'Hindlimb' + side + '.3', 'Y', 0.35 * reach)
        if cruise_weight:
            _rotate(rig, 'Hindlimb' + side + '.0', 'Y', 0.25 * cruise_weight)
            _rotate(rig, 'Hindlimb' + side + '.1', 'Y', -0.55 * cruise_weight)
        _rotate(rig, "Forelimb" + side + ".0", "Y",
                0.10 * swing - 0.16 * air_weight
                + (0.06 * math.sin(cycle + phase * 2 * math.pi) if moving else 0))
        _rotate(rig, "Forelimb" + side + ".1", "Y",
                -0.12 * swing + 0.22 * air_weight)

        # Independent finite wing cycles loop seamlessly at 16.8 s.  AirThreat
        # converges to a deterministic launch pose at exactly 3.5 s.
        wing_cycle = (7 if side == ".L" else 5) * cycle
        independent = 0.17 * (1 - math.cos(wing_cycle))
        if clip == "AirThreat":
            lock = _smooth((time - 2.9) / 0.6) * _smooth((4.1 - time) / 0.6)
            independent *= 1 - lock
        spread = (-0.10 * abs(math.sin(cycle)) if idle else
                  -0.10 * abs(math.sin(cycle)) if moving else
                  -0.28 * wind - 0.18 * swing + 0.22 * air_weight + independent * air_weight)
        if clip == 'Flight':
            spread = -0.50 + 0.60 * math.sin(wing_cycle + (0 if side == '.L' else 0.8))
        if clip == 'Glide':
            start_spread = -0.50 + 0.60 * math.sin(0 if side == '.L' else 0.8)
            spread = start_spread + (-0.70 - start_spread) * _smooth(u / 0.25)
        if takeoff:
            delay = ((0.03, 0.14), (0.16, 0.02), (0.01, 0.20), (0.12, 0.0))[variant][side == '.R']
            flap_t = max(0, u - delay)
            envelope = math.sin(math.pi * u) ** 2
            flap = envelope * (0.70 * math.sin(2 * math.pi * (2.1 + variant * 0.13) * flap_t) - 0.2)
            spread = -0.65 * launch_coil + (spread + flap) * _smooth((u - 0.24) / 0.12)
            flight_start = -0.50 + 0.60 * math.sin(0 if side == '.L' else 0.8)
            spread += (flight_start - spread) * cruise_weight
        if clip == 'Snipe':
            _rotate(rig, 'Wing upper' + side, 'Z', (1 if side == '.L' else -1) * 0.8 * aim)
            _rotate(rig, 'Wing fore' + side, 'Y', -1.65 * aim)
            spread -= 0.2 * aim
        if clip == 'BombPass':
            spread = -0.70
            _rotate(rig, 'Wing fore' + side, 'Y', 0.45)
        if clip == 'Dash':
            spread -= 0.32 * dash_drive
        if clip == "StaggerFall":
            # A fall may already be at ground height before Land starts.
            fold = _clamp((u - 0.45) / 0.55)
            spread -= 0.65 * _smooth(fold) + 0.25 * math.sin(math.pi * fold)
        if clip == "Dive":
            spread += (-0.70 - spread) * cruise_weight
            fold = _clamp((u - 0.5) / 0.5)
            spread -= (0.65 * _smooth((u - 0.65) / 0.35)
                       + 0.25 * math.sin(math.pi * fold))
        if clip == "Land":
            spread -= 0.65 * (1 - _smooth(u))
        _wing(rig, side, spread, 0.08 * independent * air_weight)

    if clip == "Spin":
        amount = max(spin_coil * 0.65, spin_sweep, spin_brake)
        for side in (".L", ".R"):
            _rotate(rig, 'Wing fore' + side, 'X', (1 if side == '.L' else -1) * -0.18 * crouch)
            _spin_contact(rig, wing_cache, side, amount)
    # Local fall recoil and landing compression, without vertical world travel.
    if clip == "StaggerFall":
        _rotate(rig, "Torso", "Y", 0.16 * math.sin(math.pi * u))
    if clip == "Land":
        compression = _pulse(u, 0.50, 0.83, 1.0)
        for side in (".L", ".R"):
            _rotate(rig, "Hindlimb" + side + ".1", "Y", -0.16 * compression)
    falling_to_ground = ((clip == "StaggerFall" and u >= 0.6)
                         or (clip == "Dive" and u >= 0.9))
    if (not air and (not takeoff or u < 0.24)) or falling_to_ground:
        for side, phase in ((".L", 0.0), (".R", 0.5)):
            target = Vector(metadata["ground_contacts"][side]["point"])
            if falling_to_ground:
                current = _point_now(rig, metadata["ground_contacts"][side])
                settle = _smooth((u - 0.6) / 0.3)
                target = current.lerp(target, settle)
            if moving:
                gait = (u * WALK_STEPS_PER_CLIP + phase) % 1.0
                duty = 0.72
                stride = (WALK_SPEED * DURATIONS["Locomotion"]
                          * duty / WALK_STEPS_PER_CLIP)
                if gait < duty:
                    target.x += stride * (gait / duty - 0.5)
                else:
                    swing_u = (gait - duty) / (1 - duty)
                    target.x += stride * (0.5 - _smooth(swing_u))
                    target.z += 0.35 * math.sin(math.pi * swing_u) ** 2
            if clip == 'Dash' and 0.8 <= time < 1.5:
                # Four fast strides at the authority's constant 12m / .7s.
                gait = (((time - 0.8) / 0.7) * 4 + phase) % 1.0
                duty = 0.52
                stride = 12 / GAME_SCALE / 4 * duty
                if gait < duty:
                    target.x += stride * (gait / duty - 0.5)
                else:
                    swing_u = (gait - duty) / (1 - duty)
                    target.x += stride * (0.5 - _smooth(swing_u))
                    target.z += 0.55 * math.sin(math.pi * swing_u) ** 2
            # The measured rest toe is almost exactly Z=0.  A small positive
            # IK goal gives the massive claws clearance under finite solving
            # error and still lies inside the existing 0..0.10 m tolerance.
            target.z = max(target.z, 0.025)
            try:
                error = _plant_hind(rig, metadata["ground_contacts"][side], target)
            except ValueError as exc:
                raise ValueError(f'{clip} at {time:.3f}s {side}: {exc}') from exc
            gait_active = moving or clip == 'Dash' and 0.8 <= time < 1.5
            planted = (not gait_active or gait < duty) and (not falling_to_ground or u >= 0.9)
            if planted:
                foot = _point_now(rig, metadata["ground_contacts"][side])
                if error * GAME_SCALE > 0.15 or not (-0.004 <= foot.z * GAME_SCALE <= 0.10):
                    raise ValueError(
                        f"{clip} {side} hind contact fails at {time:.3f}s: "
                        f"error={error * GAME_SCALE:.3f}m, height={foot.z * GAME_SCALE:.3f}m"
                    )
    grounded_wings = (clip in ("Idle", "Locomotion", "Attack", "Threat", "Spin", "Snipe", "Dash")
                      or takeoff and u < 0.24
                      or clip in ("StaggerFall", "Dive") and u >= 0.9
                      or clip == "Land")
    if grounded_wings:
        import bpy
        bpy.context.view_layer.update()
        for side in (".L", ".R"):
            lowest = min(_wing_points(rig, wing_cache[side])) * GAME_SCALE
            if lowest < -0.004:
                raise ValueError(
                    f"{clip} {side} wing penetrates floor at {time:.3f}s: {lowest:.3f}m"
                )


def animate(rig, metadata: dict) -> dict:
    """Create 12 NLA tracks on the supplied rig and return clip metadata.

    Blender must call this in a dedicated candidate scene.  This function
    changes only that rig's actions and NLA; it does not export or save files.
    Ground contact and launcher validation after skinning/export remain required.
    """
    import bpy

    _validate(rig, metadata)
    rig.animation_data_create()
    if rig.animation_data.action or len(rig.animation_data.nla_tracks):
        raise ValueError("Pass a new rig with no actions or NLA tracks")
    scene = bpy.context.scene
    scene.render.fps = FPS
    wing_cache = _wing_cache(rig, metadata)
    actions = {}
    launchers = {}
    for clip, duration in DURATIONS.items():
        print('BAKE', clip, flush=True)
        action = bpy.data.actions.new(clip)
        rig.animation_data.action = action
        samples = [i / FPS for i in range(math.floor(duration * FPS) + 1)]
        if samples[-1] < duration - 1e-9:
            samples.append(duration)
        for time in samples:
            scene.frame_set(int(time * FPS))
            _pose(rig, metadata, wing_cache, clip, time)
            if clip in ("Threat", "AirThreat") and abs(time - FIRE_TIME) < 1e-8:
                bpy.context.view_layer.update()
                launchers[clip] = [tuple(_point_now(rig, tip))
                                   for tip in metadata["launcher_tips"]]
            frame = time * FPS
            for bone in rig.pose.bones:
                if bone.name.startswith("Hindlimb") or bone.name == 'Torso':
                    bone.keyframe_insert("location", frame=frame, group=bone.name)
                bone.keyframe_insert("rotation_quaternion", frame=frame,
                                     group=bone.name)
        action.use_fake_user = True
        track = rig.animation_data.nla_tracks.new()
        track.name = clip
        track.strips.new(clip, 0, action)
        track.mute = True
        actions[clip] = action.name
    rig.animation_data.action = None
    _reset(rig)
    scene.frame_set(0)
    return {"actions": actions, "durations": dict(DURATIONS), "fps": FPS,
            "launcher_measure_at": FIRE_TIME,
            "launchers": launchers,
            "authority_root_motion": False,
            "contacts": metadata["ground_contacts"]}
