"""Articulate the four existing hind claws on each foot during Locomotion."""
import bpy
from mathutils import Quaternion, Vector


def smooth(value):
    t = min(1.0, max(0.0, value))
    return t * t * (3 - 2 * t)


def claw_islands(obj, parent):
    group = obj.vertex_groups[parent].index
    remaining = {v.index for v in obj.data.vertices
                 if any(g.group == group and g.weight > 0.5 for g in v.groups)}
    neighbours = {i: [] for i in remaining}
    for edge in obj.data.edges:
        a, b = edge.vertices
        if a in remaining and b in remaining:
            neighbours[a].append(b)
            neighbours[b].append(a)
    islands = []
    while remaining:
        island = [remaining.pop()]
        for i in island:
            for other in neighbours[i]:
                if other in remaining:
                    remaining.remove(other)
                    island.append(other)
        islands.append(island)
    if len(islands) != 4:
        raise ValueError(f"{obj.name}: expected four separate hooked claws")
    return islands


def add_digits(rig, side, palm_drop):
    parent = f"Hindlimb.{side}.3"
    obj = bpy.data.objects[f"Hindlimb.{side}"]
    joint = rig.data.bones[parent].head_local.copy()
    sign = -1 if side == "L" else 1
    toes = []
    up = Vector((0, 0, 1))
    for indices in claw_islands(obj, parent):
        points = [obj.data.vertices[i].co.copy() for i in indices]
        tip = min(points, key=lambda p: p.z)
        middle = [p for p in points if tip.z + 0.35 < p.z < tip.z + 0.8]
        tangent = (tip - sum(middle, Vector()) / len(middle)).normalized()
        front = tip.x < joint.x
        outside = (tip.y - joint.y) * sign > 0.2
        label = ("Front" if front else "Rear") + ("Outer" if outside else "Inner")
        direction = Vector((-0.90 if front else 0.45,
                            sign * (1 if outside else -1) * (0.48 if front else 0.88),
                            -0.05)).normalized()
        rotation = tangent.rotation_difference(direction)
        # At full load the low hooked section rolls forward to become the sole.
        # Keep the proximal knuckle on the original foot and bend across its joint.
        normal = rotation.inverted() @ up
        bend_top = max(p.z for p in points) - 0.10
        bend_end = tip.z + 0.82
        weights = [smooth((bend_top - p.z) / (bend_top - bend_end)) for p in points]
        goal = joint + direction * (2.48 if front else 2.17)
        goal.z = 0
        # Place the flat underside just above the walking IK's contact plane.
        # Solve for the shared vertical translation of each weighted digit.
        offsets = []
        for p, weight in zip(points, weights):
            if weight <= 0:
                continue
            delta = rotation @ (p - tip)
            offsets.append((palm_drop - p.z * (1 - weight)) / weight - delta.z * 0.62)
        goal.z = max(offsets)
        toes.append((f"Toe{label}.{side}", indices, points, weights, tip, goal, rotation, normal))
    if len({toe[0] for toe in toes}) != 4:
        raise ValueError(f"Ambiguous claw groups on {side}")
    bpy.ops.object.mode_set(mode="EDIT")
    for name, _, _, _, tip, _, _, normal in toes:
        bone = rig.data.edit_bones.new(name)
        bone.head = tip
        bone.tail = tip + normal.cross(Vector((1, 0, 0))).normalized() * 0.55
        bone.align_roll(normal)
        bone.parent = rig.data.edit_bones[parent]
    bpy.ops.object.mode_set(mode="OBJECT")
    for name, indices, _, weights, *_ in toes:
        dest = obj.vertex_groups.new(name=name)
        for index, weight in zip(indices, weights):
            vertex = obj.data.vertices[index]
            source = obj.vertex_groups[parent]
            old = next(g.weight for g in vertex.groups if g.group == source.index)
            if weight > 0:
                dest.add([index], old * weight, "REPLACE")
                if weight == 1:
                    source.remove([index])
                else:
                    source.add([index], old * (1 - weight), "REPLACE")
    return toes


def animate_toes(rig, walk, idle, fps, duration, palm_drop, toe_spread):
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    digits = {side: add_digits(rig, side, palm_drop) for side in ("L", "R")}
    supported = {}
    rig.animation_data.action = walk
    for side, toes in digits.items():
        for name, _, points, weights, tip, goal, rotation, _ in toes:
            rest = rig.data.bones[name].matrix_local.to_quaternion()
            local_rotation = rest.inverted() @ rotation @ rest
            bone = rig.pose.bones[name]
            for frame in range(round(duration * fps) + 1):
                phase = (frame / (duration * fps) + (0.5 if side == "R" else 0)) % 1
                # Keep the planted support until after lift. Open again on descent,
                # finishing before the leg reaches the floor.
                spread = toe_spread(phase)
                q = Quaternion().slerp(local_rotation, spread)
                scale = 1 - 0.38 * spread
                offset = (goal - tip) * spread
                # Interpolation of a hooked tip sweeps an arc. Lift it clear of
                # its contact plane during that arc rather than clipping the floor.
                correction = 0.0
                for point, weight in zip(points, weights):
                    if weight <= 0:
                        continue
                    delta = rest.inverted() @ (point - tip)
                    delta.z *= scale
                    moved_z = (rest @ (q @ delta)).z + tip.z + offset.z
                    height = point.z * (1 - weight) + moved_z * weight
                    correction = max(correction, (palm_drop * spread - height) / weight)
                offset.z += correction
                bone.location = rest.inverted() @ offset
                bone.rotation_quaternion = q
                bone.scale = (1, 1, scale)
                if frame == 0:
                    supported[name] = (bone.location.copy(), q.copy(), bone.scale.copy())
                for channel in ("location", "rotation_quaternion", "scale"):
                    bone.keyframe_insert(channel, frame=frame, group=name)
    # Match both step-loop boundaries with a four-point, weight-bearing idle.
    rig.animation_data.action = idle
    for name, (location, rotation, scale) in supported.items():
        bone = rig.pose.bones[name]
        bone.location, bone.rotation_quaternion, bone.scale = location, rotation, scale
        for frame in idle.frame_range:
            for channel in ("location", "rotation_quaternion", "scale"):
                bone.keyframe_insert(channel, frame=frame, group=name)
    rig.animation_data.action = None
    for toes in digits.values():
        for name, *_ in toes:
            bone = rig.pose.bones[name]
            bone.location = (0, 0, 0)
            bone.rotation_quaternion = Quaternion()
            bone.scale = (1, 1, 1)
