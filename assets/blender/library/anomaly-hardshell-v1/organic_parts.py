"""Grown-shell part builders for ANOMALY generators (Blender, Z-up, forward +Y).

Everything is deterministic mesh data (no modifiers left, no procedural shaders),
so a part looks the same in Blender, the exported GLB and the game.

    import organic_parts as op
    leg = op.limb('tarsus', hip, knee, (0.09, 0.07), (0.05, 0.04), bow=0.06)
    op.bind(leg, 'front_L_upper')                 # rigid weight to one bone
    op.join(target_mesh_object, [leg, ...])       # merge into a material batch

Shapes are intentionally tapered, curved and overlapping (grown exoskeleton),
not bevelled boxes. See README.md for the design rules they encode.
"""
import math
import bpy
from mathutils import Vector, Matrix, Euler

V = Vector


def _frames(points, up_hint=V((0, 0, 1))):
    """Parallel-transport frames along a polyline: (tangent, normal, binormal)."""
    out = []
    n_prev = None
    for i, p in enumerate(points):
        a = points[max(0, i - 1)]
        b = points[min(len(points) - 1, i + 1)]
        t = (b - a).normalized()
        if n_prev is None:
            ref = up_hint if abs(t.dot(up_hint)) < 0.95 else V((0, 1, 0))
            n = (ref - t * ref.dot(t)).normalized()
        else:
            n = (n_prev - t * n_prev.dot(t)).normalized()
        out.append((t, n, t.cross(n)))
        n_prev = n
    return out


def _mesh(name, verts, faces, smooth=True):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([tuple(v) for v in verts], [], faces)
    mesh.validate(clean_customdata=False)
    mesh.update()
    for poly in mesh.polygons:
        poly.use_smooth = smooth
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return obj


def loft(name, stations, segments=12, power=2.0, up=V((0, 0, 1)), smooth=True, cap=True):
    """Tube through stations [(point, rx, ry)] or [(point, rx, ry, twist_radians)].

    rx is across (binormal), ry is along the frame normal ("up" side).
    power > 2 squares the section toward a hard carapace, < 2 pinches to a ridge.
    Zero-ish radii at the ends give pointed tips; cap=True closes open ends.
    """
    pts = [V(s[0]) for s in stations]
    frames = _frames(pts, up)
    verts, faces = [], []
    for (p, *r), (t, n, b) in zip(stations, frames):
        rx, ry = r[0], r[1]
        twist = r[2] if len(r) > 2 else 0.0
        p = V(p)
        for k in range(segments):
            a = 2 * math.pi * k / segments + twist
            c, s = math.cos(a), math.sin(a)
            c = math.copysign(abs(c) ** (2 / power), c)
            s = math.copysign(abs(s) ** (2 / power), s)
            verts.append(p + b * (c * rx) + n * (s * ry))
    rows = len(stations)
    for j in range(rows - 1):
        for k in range(segments):
            a = j * segments + k
            bq = j * segments + (k + 1) % segments
            faces.append((a, bq, bq + segments, a + segments))
    if cap:
        for j, sign in ((0, -1), (rows - 1, 1)):
            centre = len(verts)
            verts.append(V(stations[j][0]) + frames[j][0] * (sign * 1e-4))
            ring = [j * segments + k for k in range(segments)]
            for k in range(segments):
                a, bq = ring[k], ring[(k + 1) % segments]
                faces.append((a, bq, centre) if sign > 0 else (bq, a, centre))
    return _mesh(name, verts, faces, smooth)


def bezier(a, b, bow=V((0, 0, 0)), steps=6):
    """Quadratic curve from a to b bulging by `bow` at the middle."""
    a, b = V(a), V(b)
    c = (a + b) / 2 + V(bow)
    return [a.lerp(c, u).lerp(c.lerp(b, u), u) for u in (i / steps for i in range(steps + 1))]


def limb(name, a, b, ra, rb, bow=V((0, 0, 0)), steps=6, belly=0.0, belly_at=0.35,
         segments=10, power=2.0, up=V((0, 0, 1)), tip=None):
    """Tapered, gently curved limb segment from a to b.

    ra / rb: (rx, ry) radii at each end. `belly` adds a muscle-like swelling at
    `belly_at` (0..1). `tip` (length) extends a pointed end past b.
    """
    pts = bezier(a, b, bow, steps)
    stations = []
    for i, p in enumerate(pts):
        u = i / steps
        swell = 1 + belly * math.exp(-((u - belly_at) / 0.22) ** 2)
        rx = (ra[0] + (rb[0] - ra[0]) * u) * swell
        ry = (ra[1] + (rb[1] - ra[1]) * u) * swell
        stations.append((p, rx, ry))
    # Round the root so rigid segments read as a socketed joint when bending.
    t0 = (pts[1] - pts[0]).normalized()
    stations.insert(0, (pts[0] - t0 * ra[1] * 0.55, ra[0] * 0.55, ra[1] * 0.55))
    t1 = (pts[-1] - pts[-2]).normalized()
    if tip:
        stations.append((pts[-1] + t1 * tip, rb[0] * 0.06, rb[1] * 0.06))
    else:
        stations.append((pts[-1] + t1 * rb[1] * 0.5, rb[0] * 0.5, rb[1] * 0.5))
    return loft(name, stations, segments, power, up)


def ellipsoid(name, centre, radii, rotation=(0, 0, 0), segments=16, rings=10, power=2.0):
    """Superellipsoid; power > 2 flattens toward a shield, < 2 toward a spindle."""
    rot = Euler(rotation).to_matrix()
    verts, faces = [], []
    e = 2 / power
    for i in range(1, rings):
        v = -math.pi / 2 + math.pi * i / rings
        cv, sv = math.cos(v), math.sin(v)
        cv = abs(cv) ** e
        sv = math.copysign(abs(sv) ** e, sv)
        for k in range(segments):
            u = 2 * math.pi * k / segments
            cu, su = math.cos(u), math.sin(u)
            cu = math.copysign(abs(cu) ** e, cu)
            su = math.copysign(abs(su) ** e, su)
            local = V((radii[0] * cv * cu, radii[1] * cv * su, radii[2] * sv))
            verts.append(V(centre) + rot @ local)
    for i in range(rings - 2):
        for k in range(segments):
            a = i * segments + k
            b = i * segments + (k + 1) % segments
            faces.append((a, b, b + segments, a + segments))
    bottom, top = len(verts), len(verts) + 1
    verts.append(V(centre) + rot @ V((0, 0, -radii[2])))
    verts.append(V(centre) + rot @ V((0, 0, radii[2])))
    last = (rings - 2) * segments
    for k in range(segments):
        faces.append(((k + 1) % segments, k, bottom))
        faces.append((last + k, last + (k + 1) % segments, top))
    return _mesh(name, verts, faces)


def shard(name, centre, direction, length, width, thick, curl=0.0, up=V((0, 0, 1)),
          segments=10, steps=6, power=2.6):
    """Leaf / blade / vertebra plate: pointed both ends, widest near the middle.

    `curl` bends it toward `up` (positive arches the middle upward)."""
    d = V(direction).normalized()
    upv = (V(up) - d * V(up).dot(d)).normalized()
    a = V(centre) - d * length / 2
    pts = [a + d * (length * u) + upv * (curl * math.sin(math.pi * u)) for u in (i / steps for i in range(steps + 1))]
    stations = []
    for i, p in enumerate(pts):
        u = i / steps
        f = max(0.04, math.sin(math.pi * (0.08 + 0.84 * u)) ** 0.8)
        stations.append((p, width * f, thick * f))
    return loft(name, stations, segments, power, upv)


def claw(name, base, direction, length, radius, curl=0.35, down=V((0, 0, -1)), steps=5, segments=8):
    """Curved, tapering hook (talon, spur, spike)."""
    d = V(direction).normalized()
    dn = (V(down) - d * V(down).dot(d)).normalized()
    stations = []
    for i in range(steps + 1):
        u = i / steps
        p = V(base) + d * (length * u) + dn * (curl * length * u * u)
        r = radius * (1 - u) ** 0.9 + 0.004
        stations.append((p, r, r))
    return loft(name, stations, segments)


def torus(name, centre, major, minor, rotation=(0, 0, 0), major_segments=40, minor_segments=8,
          minor_scale=(1.0, 1.0)):
    """Ring whose tube section can be flattened (minor_scale: radial, axial)."""
    rot = Euler(rotation).to_matrix()
    verts, faces = [], []
    for i in range(major_segments):
        u = 2 * math.pi * i / major_segments
        cu, su = math.cos(u), math.sin(u)
        for k in range(minor_segments):
            v = 2 * math.pi * k / minor_segments
            radial = major + minor * minor_scale[0] * math.cos(v)
            local = V((radial * cu, radial * su, minor * minor_scale[1] * math.sin(v)))
            verts.append(V(centre) + rot @ local)
    for i in range(major_segments):
        for k in range(minor_segments):
            a = i * minor_segments + k
            b = i * minor_segments + (k + 1) % minor_segments
            c = ((i + 1) % major_segments) * minor_segments + (k + 1) % minor_segments
            d = ((i + 1) % major_segments) * minor_segments + k
            faces.append((a, b, c, d))
    return _mesh(name, verts, faces)


def strip(name, points, width, height, up=V((0, 0, 1))):
    """Thin raised band along a path (glow seam, ridge line)."""
    return loft(name, [(p, width, height) for p in points], 6, 2.0, up)


def mirror_x(obj, name=None):
    """Copy of `obj` mirrored across X (keeps outward normals)."""
    copy = obj.copy()
    copy.data = obj.data.copy()
    copy.name = name or obj.name + '_mx'
    bpy.context.collection.objects.link(copy)
    for v in copy.data.vertices:
        v.co.x = -v.co.x
    copy.data.flip_normals()
    return copy


def bind(obj, bone):
    """Rigid skin weight: every vertex follows one bone."""
    group = obj.vertex_groups.get(bone) or obj.vertex_groups.new(name=bone)
    group.add(list(range(len(obj.data.vertices))), 1.0, 'REPLACE')
    return obj


def join(target, objects):
    """Merge parts into `target` (keeps target's single material slot)."""
    if not objects:
        return target
    mat = target.data.materials[0] if target.data.materials else None
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:
        o.select_set(True)
    target.select_set(True)
    bpy.context.view_layer.objects.active = target
    bpy.ops.object.join()
    if mat:
        target.data.materials.clear()
        target.data.materials.append(mat)
    for p in target.data.polygons:
        p.material_index = 0
    return target
