"""HOUND / VOLLEY (ant) and HOUND / LEAPER (spider) grown-shell candidates.

Blender --background --factory-startup --python-exit-code 1 --python this_file -- volley|leaper

Reads assets/blender/source/hound_motion_v1.blend (read-only): its 20-bone rig,
Idle / Locomotion / Lunge actions and four material slots are kept exactly.
Only the skinned geometry is replaced, and the materials are rebuilt from the
shared library assets/blender/library/anomaly-hardshell-v1 (HOUND / LEAPER look).
Writes only inside this candidate folder. Never touches public/ or gameplay.
"""
from pathlib import Path
import sys, math, json, hashlib
import bpy, bmesh
from mathutils import Vector as V, Matrix, Euler

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[4]
LIB = REPO / 'assets/blender/library/anomaly-hardshell-v1'
sys.path.insert(0, str(LIB))
import anomaly_materials as am
import organic_parts as op

kind = sys.argv[-1]
assert kind in ('volley', 'leaper'), kind
OUT = HERE / kind
OUT.mkdir(exist_ok=True)
SOURCE = REPO / 'assets/blender/source/hound_motion_v1.blend'
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
bpy.context.preferences.filepaths.save_version = 0

rig = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
skins = [o for o in bpy.context.scene.objects if o.type == 'MESH' and any(m.type == 'ARMATURE' for m in o.modifiers)]
assert len(skins) == 4 and len(rig.data.bones) == 20
for pb in rig.pose.bones:
    pb.matrix_basis = Matrix.Identity(4)
rig.animation_data.action = None
for track in rig.animation_data.nla_tracks:
    track.mute = True
bpy.context.view_layer.update()

ROLE_OF = {'HOUND_shell': 'shell', 'HOUND_spine': 'spine', 'HOUND_edge_metal': 'edge_metal', 'HOUND_ring_emission': 'ring_emission'}
target = {}
for obj in skins:
    mat = obj.data.materials[0]
    role = ROLE_OF[mat.name]
    am.apply(mat, role, textured=True)
    bm = bmesh.new(); bm.from_mesh(obj.data)
    bmesh.ops.delete(bm, geom=list(bm.verts), context='VERTS')
    bm.to_mesh(obj.data); bm.free()
    target[role] = obj
parts = {role: [] for role in target}


def add(obj, role, bone):
    op.bind(obj, bone)
    parts[role].append(obj)
    return obj


B = {b.name: (b.head_local.copy(), b.tail_local.copy()) for b in rig.data.bones}
head = lambda n: B[n][0]
X, Y, Z = V((1, 0, 0)), V((0, 1, 0)), V((0, 0, 1))
L = kind == 'leaper'

# ---------------------------------------------------------------- torso (body)
if not L:
    # Low, long hull: wide shoulders, sealed breast where a head should be.
    hull = [(0.70, 1.10, .12, .10), (0.52, 1.13, .38, .28), (0.22, 1.13, .50, .33),
            (-0.20, 1.07, .45, .30), (-0.62, 0.99, .37, .25), (-0.95, 0.91, .25, .18), (-1.13, 0.87, .07, .06)]
else:
    # Short hunched hull, tallest over the haunches: a body folded for jumping.
    hull = [(0.62, 1.06, .12, .10), (0.46, 1.12, .36, .28), (0.18, 1.20, .46, .36),
            (-0.22, 1.22, .47, .40), (-0.60, 1.08, .42, .33), (-0.90, 0.95, .26, .22), (-1.04, 0.90, .07, .06)]
# Dark under-structure; pale grown plates cover most of it (HOUND / LEAPER contrast).
add(op.loft('hull', [(V((0, y, z)), rx, ry) for y, z, rx, ry in hull], 16, 2.35), 'shell', 'body')


def hull_at(y):
    """Centre height and half-extents (rx, ry) of the hull section at y."""
    for (y0, z0, rx0, ry0), (y1, z1, rx1, ry1) in zip(hull, hull[1:]):
        if y1 <= y <= y0:
            u = (y0 - y) / (y0 - y1)
            return z0 + (z1 - z0) * u, rx0 + (rx1 - rx0) * u, ry0 + (ry1 - ry0) * u
    return hull[-1][1], 0.05, 0.05


def hull_top(y):
    zc, rx, ry = hull_at(y)
    return zc + ry, rx


def scute(y, width, spread=0.80, lift=0.03, thick=0.034, a0=None):
    """Plate wrapped over the hull section at y: follows the body, overlaps its neighbours.
    a0 (radians) starts the arc there instead of centring it on the spine."""
    zc, rx, ry = hull_at(y)
    steps = 10
    start = math.pi * (0.5 - spread / 2) if a0 is None else a0
    stations = []
    for k in range(steps + 1):
        u = k / steps
        a = start + math.pi * spread * u
        p = V(((rx + lift) * math.cos(a), y - 0.03 * math.sin(math.pi * u), zc + (ry + lift) * math.sin(a)))
        stations.append((p, width * (0.35 + 0.65 * math.sin(math.pi * u) ** 0.6), thick))
    return op.loft('scute', stations, 8, 3.0, Z)


# Overlapping dorsal scutes, each slightly larger than the gap it covers; glow seams between.
scute_ys = [0.50, 0.25, 0.0, -0.25, -0.50, -0.74] if not L else [0.44, 0.20, -0.04, -0.28, -0.52, -0.74]
for i, y in enumerate(scute_ys):
    add(scute(y, 0.155 - i * 0.006, spread=0.92, lift=0.03 + 0.012 * (i % 2)), 'spine', 'body')
    if -0.8 < y < 0.45:
        for s in (-1, 1):  # flank plates, offset half a pitch so the gaps interlock
            a0 = math.pi * (-0.22 if s > 0 else 0.93)
            add(scute(y - 0.12, 0.13, spread=0.30, lift=0.022, a0=a0), 'spine', 'body')
    if i:
        zc, rx, ry = hull_at(y + 0.125)
        arc = [V(((rx + .012) * math.cos(a), y + 0.125, zc + (ry + .012) * math.sin(a)))
               for a in [math.pi * (0.16 + 0.68 * k / 8) for k in range(9)]]
        add(op.strip('scute_seam', arc, 0.011, 0.011), 'ring_emission', 'body')
# Dark belly plate: keeps the underside reading as a separate, shadowed mass.
add(op.loft('belly', [(V((0, y, hull_at(y)[0] - hull_at(y)[2] * .72)), hull_at(y)[1] * .78, .07)
                      for y in (0.55, 0.3, 0.0, -0.3, -0.6, -0.85)], 12, 2.4), 'shell', 'body')

# Sealed breast where a head would be: a pale grown cap, no face.
zc, rx, ry = hull_at(hull[1][0])
add(op.ellipsoid('breast_cap', V((0, hull[1][0] + .12, zc + .02)), (rx * .78, .17, ry * .82), (-.25, 0, 0), 16, 10, 2.4),
    'shell' if L else 'spine', 'body')
if L:
    # LEAPER: a dark chest with an upright pulse organ, readable head-on.
    chest = V((0, hull[1][0] + .27, zc + .02))
    add(op.torus('chest_organ', chest, .15, .028, (math.pi / 2 - .25, 0, 0), 32, 6), 'ring_emission', 'body')
    add(op.torus('chest_organ_lip', chest - V((0, .015, 0)), .19, .035, (math.pi / 2 - .25, 0, 0), 32, 6, (1.0, .7)),
        'edge_metal', 'body')
# Breastbone keel under the chest: the clearest bird cue on a headless body.
add(op.shard('keel', V((0, 0.30, 0.83 if not L else 0.86)), Y, 0.95, 0.045, 0.19, curl=-0.05, up=Z,
             segments=8), 'shell', 'body')
add(op.strip('keel_glow', op.bezier(V((0, 0.66, 0.90)), V((0, -0.10, 0.78)), V((0, 0, -0.06)), 6), 0.010, 0.012),
    'ring_emission', 'body')

# ---------------------------------------------------------------- legs
def leg_front(side, label):
    hip, knee, toe = head(f'front_{label}_upper'), head(f'front_{label}_lower'), head(f'front_{label}_toe')
    out = V((side, 0, 0))
    if not L:
        # Wading-bird leg: short feathered-looking thigh, long thin tarsus, spike foot.
        add(op.limb('thigh', hip, knee, (.13, .15), (.07, .075), bow=out * .05 + Z * .07, belly=.45, belly_at=.28),
            'edge_metal', f'front_{label}_upper')
        add(op.shard('thigh_plate', hip.lerp(knee, .38) + out * .09 + Z * .07, knee - hip, .62, .09, .035, curl=.05,
                     up=out + Z), 'spine', f'front_{label}_upper')
        add(op.ellipsoid('knee', knee, (.085, .085, .095)), 'shell', f'front_{label}_lower')
        add(op.limb('tarsus', knee, toe, (.058, .062), (.034, .036), bow=-Y * .04, segments=10),
            'spine', f'front_{label}_lower')
        add(op.strip('tarsus_groove', [knee.lerp(toe, u) + out * .047 + Z * .01 for u in (.08, .3, .5, .7, .9)], .03, .02),
            'shell', f'front_{label}_lower')
        add(op.strip('tarsus_glow', [knee.lerp(toe, u) + out * .06 + Z * .012 for u in (.1, .3, .5, .7, .88)], .02, .016),
            'ring_emission', f'front_{label}_lower')
        add(op.limb('foot_spike', toe, V((toe.x + side * .02, toe.y + .13, .009)), (.045, .045), (.01, .01), segments=8),
            'spine', f'front_{label}_toe')
        for s in (-1, 1):
            add(op.claw('spur', toe + Z * .02, V((s * .6, -1, -.35)), .16, .025, curl=.25), 'spine', f'front_{label}_toe')
    else:
        # Grappling forelimb: heavier, hooked, with three talons that could grip a wall.
        add(op.limb('fore', hip, knee, (.15, .16), (.085, .09), bow=out * .06 + Z * .09, belly=.55, belly_at=.3),
            'edge_metal', f'front_{label}_upper')
        add(op.shard('fore_plate', hip.lerp(knee, .45) + out * .11 + Z * .08, knee - hip, .72, .12, .04, curl=.07,
                     up=out + Z), 'spine', f'front_{label}_upper')
        add(op.ellipsoid('elbow', knee, (.10, .10, .11)), 'shell', f'front_{label}_lower')
        add(op.limb('forearm', knee, toe, (.075, .08), (.045, .05), bow=Z * .05, belly=.25, belly_at=.2),
            'spine', f'front_{label}_lower')
        add(op.strip('forearm_glow', [knee.lerp(toe, u) + out * .07 + Z * .02 for u in (.12, .35, .55, .78)], .02, .016),
            'ring_emission', f'front_{label}_lower')
        add(op.ellipsoid('palm', toe + Z * .015, (.07, .08, .05)), 'edge_metal', f'front_{label}_toe')
        for s in (-1, 0, 1):
            add(op.claw('talon', toe + V((s * .045, .03, .0)), V((s * .35, 1, .25)), .22, .03, curl=.55),
                'spine', f'front_{label}_toe')


def leg_rear(label):
    hip, knee, toe = head(f'rear_{label}_upper'), head(f'rear_{label}_lower'), head(f'rear_{label}_toe')
    side = 1 if hip.x > .1 else -1 if hip.x < -.1 else 0
    out = V((side, 0, 0)) if side else -Y
    big = 1.35 if L else 1.0
    # Beast haunch: the four-legged half of the mistaken mixture.
    add(op.limb('haunch', hip, knee, (.16 * big, .18 * big), (.085, .09), bow=-Y * .06 + out * .04,
                belly=.55 * big, belly_at=.32), 'edge_metal', f'rear_{label}_upper')
    add(op.shard('haunch_cap', hip.lerp(knee, .35) + out * .12 * big + Z * .04, knee - hip, .46 * big, .13 * big, .045,
                 curl=.06, up=out + Z * .5), 'spine', f'rear_{label}_upper')
    add(op.limb('shank', knee, toe, (.07, .07), (.05, .05), bow=-Y * .03), 'shell', f'rear_{label}_lower')
    add(op.ellipsoid('hoof', V((toe.x, toe.y + .02, .055)), (.085, .11, .055), power=2.6), 'spine', f'rear_{label}_toe')
    add(op.strip('haunch_glow', [hip.lerp(knee, u) + out * .15 * big + Z * .06 for u in (.2, .4, .6)], .016, .014),
        'ring_emission', f'rear_{label}_upper')
    if L:
        add(op.claw('heel_spur', knee + Z * .02, V((0, -1, .45)), .26, .04, curl=-.3), 'edge_metal', f'rear_{label}_lower')


for side, label in ((-1, 'L'), (1, 'R')):
    leg_front(side, label)
for label in 'ABC':
    leg_rear(label)

# ---------------------------------------------------------------- dorsal organ
if not L:
    # VOLLEY: the vertical halo is its launching organ, grown from bone, cradled by two horns.
    c = head('ring')
    rot = (math.pi / 2 + math.radians(14), math.radians(10), math.radians(-24))
    M = Euler(rot).to_matrix()
    add(op.torus('halo_rim', c, .50, .075, rot, 44, 8, (1.0, .65)), 'spine', 'ring')
    add(op.torus('halo_light', c + M @ V((0, 0, -.05)), .44, .028, rot, 44, 6), 'ring_emission', 'ring')
    for k, a in enumerate([.3, 1.25, 2.4, 3.3, 4.3, 5.4]):
        add(op.ellipsoid('halo_node', c + M @ V((math.cos(a) * .52, math.sin(a) * .52, 0)), (.06 + .015 * (k % 2), .05, .05),
                         rot, 10, 6), 'edge_metal', 'ring')
    low = c + M @ V((0, -.5, 0))
    low = min((c + M @ V((math.cos(a) * .5, math.sin(a) * .5, 0)) for a in [i * math.pi / 18 for i in range(36)]),
              key=lambda p: p.z)
    for s in (-1, 1):
        root = V((c.x + s * .20, c.y + .05, hull_top(c.y)[0] - .06))
        tip = low + V((s * .17, 0, -.02))
        add(op.limb('cradle_horn', root, tip, (.07, .07), (.02, .02), bow=V((s * .12, 0, .05)), segments=8, tip=.05),
            'edge_metal', 'body')
    # Floating vertebrae: separated from the body, each a little different.
    for i, (length, yaw) in enumerate([(.72, -.10), (.64, .16), (.54, -.05)], 1):
        p = head(f'spine_{i}')
        d = V((math.sin(yaw), -math.cos(yaw), .08))
        add(op.shard('vertebra', p, d, length, .22, .085, curl=.07, up=Z), 'spine', f'spine_{i}')
        add(op.shard('vertebra_under', p - Z * .06, d, length * .8, .15, .05, curl=.05, up=Z), 'shell', f'spine_{i}')
        add(op.claw('vertebra_process', p + Z * .03, V((0, -.55, 1)), .30 + .05 * (i % 2), .06, curl=-.25, down=Y),
            'edge_metal', f'spine_{i}')
        add(op.strip('vertebra_core', [p + d * (u * length) + Z * .045 for u in (-.35, -.12, .12, .35)], .012, .012),
            'ring_emission', f'spine_{i}')
else:
    # LEAPER: no halo. Swept scapulae and a tall bladed crest instead.
    for s in (-1, 1):
        add(op.shard('scapula', V((s * .50, .16, 1.55)), V((s * .45, -1, .35)), 1.05, .30, .07, curl=.15,
                     up=V((s * .7, 0, 1))), 'spine', 'body')
        add(op.strip('scapula_glow', [V((s * (.34 + .16 * u), .52 - .80 * u, 1.60 + .14 * u)) for u in (0, .33, .66, 1)],
                     .016, .013), 'ring_emission', 'body')
    # Raised hackles: each floating segment carries a fan of thin swept spines.
    for i, (length, lean) in enumerate([(.72, .9), (.92, .8), (.60, 1.0)], 1):
        p = head(f'spine_{i}')
        base = p - V((0, 0, .18))
        add(op.shard('hackle_root', base, -Y, .34, .11, .05, curl=.03, up=Z), 'spine', f'spine_{i}')
        for j, (dx, f) in enumerate([(-.07, .72), (0, 1.0), (.07, .8)]):
            d = V((dx * 2.2, -lean, 1)).normalized()
            add(op.claw('hackle', base + V((dx, 0, .02)), d, length * f, .045, curl=.22, down=-Y), 'spine', f'spine_{i}')
        d = V((0, -lean, 1)).normalized()
        add(op.strip('hackle_glow', [base + d * (length * u) + V((0, -.02 - .18 * u * u * length, .0)) for u in (.12, .35, .6, .82)],
                     .010, .012), 'ring_emission', f'spine_{i}')
    
# ---------------------------------------------------------------- batch, UV, export
for role, obj in target.items():
    op.join(obj, parts[role])
    am.planar_uv(obj)

tris = 0
ground = 1e9
for obj in target.values():
    obj.data.calc_loop_triangles()
    tris += len(obj.data.loop_triangles)
    ground = min(ground, min(v.co.z for v in obj.data.vertices))
print('CANDIDATE', kind, 'triangles', tris, 'min_z', round(ground, 4))
assert -0.02 < ground < 0.02, ground

tag = f'{kind}_grown_v1'
blend, glb = OUT / f'{tag}.blend', OUT / f'{tag}.glb'
bpy.ops.wm.save_as_mainfile(filepath=str(blend))
bpy.ops.object.select_all(action='DESELECT'); rig.select_set(True)
for o in target.values():
    o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(glb), export_format='GLB', use_selection=True, export_yup=True, export_extras=True,
    export_animations=True, export_animation_mode='NLA_TRACKS', export_force_sampling=True, export_frame_range=False,
    export_cameras=False, export_lights=False, export_texcoords=True)
data = glb.read_bytes()
gltf = json.loads(data[20:20 + int.from_bytes(data[12:16], 'little')])
report = {
    'kind': kind, 'source': str(SOURCE.relative_to(REPO)), 'source_sha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    'library': str(LIB.relative_to(REPO)), 'blender': bpy.app.version_string,
    'triangles': sum(gltf['accessors'][p['indices']]['count'] // 3 for m in gltf['meshes'] for p in m['primitives']),
    'meshes': len(gltf['meshes']), 'materials': sorted(m['name'] for m in gltf['materials']),
    'bones': len(gltf['skins'][0]['joints']), 'images': len(gltf.get('images', [])),
    'clips': sorted(a['name'] for a in gltf['animations']), 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(),
    'rest_min_z_blender': round(ground, 5),
}
assert report['meshes'] == 4 and report['bones'] == 20 and report['clips'] == ['Idle', 'Locomotion', 'Lunge']
assert report['triangles'] < 14000
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(glb))
assert len([o for o in bpy.context.scene.objects if o.type == 'ARMATURE']) == 1
for o in bpy.context.scene.objects:
    if o.type == 'MESH':
        assert all(math.isfinite(c) for v in o.data.vertices for c in v.co)
report['reimport'] = 'PASS'
(OUT / 'validation.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print('GROWN', json.dumps(report))
