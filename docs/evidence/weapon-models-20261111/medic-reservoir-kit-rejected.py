"""SWARM FRONT 武器モデル共通キット（design/weapon-models-20261111）。

座標の決まり（Blender）: 原点=引き金を握る右手、+Y=前、+Z=上、X=左右。単位 m。
既存の scripts/build-realistic-weapons.py と同じ原点・向き・書き出し設定を使う。
1丁 = weapons/<kind>.py（SPEC と build(k)）。実行は build_weapon.py から。
"""
import bpy, math, json, hashlib
from pathlib import Path
from mathutils import Vector

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
OUT = ROOT / 'out'
SOURCE = ROOT / 'source'

# レア度の識別インレイ色。既存 realism-v2 と同じ5色（N/R/SR/SSR/LR）。
GRADE_COLORS = [(.2, .26, .27), (.08, .3, .15), (.08, .2, .45), (.3, .09, .39), (.55, .35, .065)]

# 共通の材質表: key -> (GLB上の材質名, 色, metallic, roughness, 発光色 or None)
# 名前に Metal / Ceramic を含むものは、兵士ローダーの環境反射の対象名と一致する。
PALETTE = {
    'steel':      ('Metal steel',          (.065, .078, .084), .75, .42, None),
    'gunmetal':   ('Metal gunmetal',       (.120, .115, .160), .70, .45, None),
    'brass':      ('Metal brass',          (.55, .38, .12),    .85, .38, None),
    'copper':     ('Metal copper',         (.60, .27, .12),    .85, .36, None),
    'black':      ('Recess black',         (.009, .014, .016), .10, .70, None),
    'polymer':    ('Textured polymer',     (.032, .042, .042), 0,   .75, None),
    'bone':       ('Ceramic bone',         (.62, .60, .54),    0,   .60, None),
    'white':      ('Ceramic white',        (.78, .80, .78),    0,   .50, None),
    'olive':      ('Olive composite',      (.16, .20, .10),    .12, .64, None),
    'hazard':     ('Paint hazard yellow',  (.80, .58, .04),    0,   .55, None),
    'rust':       ('Paint rust orange',    (.55, .20, .05),    .20, .60, None),
    'leather':    ('Leather oxblood',      (.22, .06, .04),    0,   .70, None),
    'teal':       ('Paint teal',           (.05, .42, .40),    0,   .50, None),
    'slate':      ('Paint slate blue',     (.20, .27, .34),    .20, .55, None),
    'russet':     ('Paint russet',         (.42, .20, .09),    .10, .60, None),
    'hazmat':     ('Paint hazmat orange',  (.85, .33, .04),    0,   .55, None),
    'goo':        ('Resin goo pink',       (.85, .25, .45),    0,   .25, None),
    'vial':       ('Resin vial green',     (.07, .38, .16),    0,   .25, None),
    'glow_ember': ('Glow ember',           (.25, .02, .02),    0,   .40, (1, .10, .05)),
    # Linear equivalent of the sniper shot's sRGB 0xc2faff in combat-effects.ts.
    'glow_laser': ('Glow laser',            (.16, .35, .38),    0,   .40, (.539, .956, 1)),
    'glow_heat':  ('Glow heat',            (.40, .15, .02),    0,   .40, (1, .45, .08)),
    'glow_acid':  ('Glow acid',            (.30, .40, .02),    0,   .40, (.75, 1, .10)),
    # 回復の光は暖かい白。緑にするとレア度 R のネオン（ミント緑）と紛れる。
    'glow_heal':  ('Glow heal',            (.50, .50, .45),    0,   .40, (1, .96, .86)),
    'accent':     ('Rarity identification', GRADE_COLORS[0],   .45, .45, None),
}


class Kit:
    def __init__(self, spec):
        self.spec = spec
        self.mats = {}
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.context.preferences.filepaths.save_version = 0  # .blend1 の控えを作らない

    # ---- 材質 ----
    def mat(self, key):
        if key not in self.mats:
            name, color, metal, rough, emit = PALETTE[key]
            m = bpy.data.materials.new(name)
            m.diffuse_color = (*color, 1)
            m.use_nodes = True
            p = m.node_tree.nodes.get('Principled BSDF')
            p.inputs['Base Color'].default_value = (*color, 1)
            p.inputs['Metallic'].default_value = metal
            p.inputs['Roughness'].default_value = rough
            if emit:
                p.inputs['Emission Color'].default_value = (*emit, 1)
                p.inputs['Emission Strength'].default_value = 1
            self.mats[key] = m
        return self.mats[key]

    def _finish(self, o, name, mat, bevel=0, segments=1):
        o.name = name
        o.data.materials.append(self.mat(mat))
        if bevel:
            b = o.modifiers.new('Edge chamfer', 'BEVEL')
            b.width = bevel
            b.segments = segments
            bpy.context.view_layer.objects.active = o
            bpy.ops.object.modifier_apply(modifier=b.name)
        return o

    # ---- 部品 ----
    def box(self, name, loc, size, mat, bevel=.002):
        """直方体。loc=中心、size=(X幅, Y長さ, Z高さ)。"""
        bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
        o = bpy.context.object
        o.dimensions = size
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        return self._finish(o, name, mat, bevel)

    def rod(self, name, a, b, r, mat, n=16, r2=None):
        """a→b の円柱（r2 を渡すと先細り）。銃身・ケーブル・横向きドラムに使う。"""
        a, b = Vector(a), Vector(b)
        bpy.ops.mesh.primitive_cone_add(vertices=n, radius1=r, radius2=r if r2 is None else r2,
                                        depth=(b - a).length, location=(a + b) / 2)
        o = bpy.context.object
        o.rotation_mode = 'QUATERNION'
        o.rotation_quaternion = (b - a).to_track_quat('Z', 'Y')
        self._finish(o, name, mat)
        for p in o.data.polygons:
            p.use_smooth = len(p.vertices) == 4
        return o

    def profile(self, name, points, width, mat, bevel=.002, x=0):
        """側面形 [(Y,Z),...] を X 方向へ width だけ押し出した板。シルエットの主役。"""
        n = len(points)
        verts = [(x + s * width / 2, y, z) for s in [-1, 1] for y, z in points]
        faces = [tuple(reversed(range(n))), tuple(range(n, 2 * n))] + \
                [(i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n)]
        me = bpy.data.meshes.new(name)
        me.from_pydata(verts, [], faces)
        me.update()
        o = bpy.data.objects.new(name, me)
        bpy.context.collection.objects.link(o)
        bpy.ops.object.select_all(action='DESELECT')
        bpy.context.view_layer.objects.active = o
        o.select_set(True)
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.mesh.normals_make_consistent(inside=False)
        bpy.ops.object.mode_set(mode='OBJECT')
        return self._finish(o, name, mat, bevel)

    def ring(self, name, y, z, outer, inner, mat, length=.012, x=0, n=24):
        """銃身軸（Y）まわりの輪。銃口・コイル・バンドに使う。"""
        verts = []
        for yy, r in [(y - length / 2, outer), (y + length / 2, outer),
                      (y - length / 2, inner), (y + length / 2, inner)]:
            verts.extend((x + math.cos(i * 2 * math.pi / n) * r, yy, z + math.sin(i * 2 * math.pi / n) * r)
                         for i in range(n))
        faces = []
        for a, b in [(0, n), (3 * n, 2 * n), (2 * n, 0), (n, 3 * n)]:
            for i in range(n):
                j = (i + 1) % n
                faces.append((a + i, a + j, b + j, b + i))
        me = bpy.data.meshes.new(name)
        me.from_pydata(verts, [], faces)
        me.update()
        o = bpy.data.objects.new(name, me)
        bpy.context.collection.objects.link(o)
        return self._finish(o, name, mat)

    def guard(self, y, z, w=.06, drop=.045, mat='steel'):
        """中が抜けた用心金と引き金。y=中心、z=上端。"""
        for a, b in [((0, y - w / 2, z), (0, y - w / 2, z - drop)),
                     ((0, y - w / 2, z - drop), (0, y + w / 2, z - drop)),
                     ((0, y + w / 2, z - drop), (0, y + w / 2, z))]:
            self.rod('Trigger guard', a, b, .004, mat, 8)
        self.rod('Trigger', (0, y - w * .15, z), (0, y - w * .15 - .007, z - .026), .003, mat, 8)

    # ---- 仕上げ・書き出し ----
    def finalize(self):
        s = self.spec
        kind = s['kind']
        ix, iy, iz = s['inlay']
        for side in [-1, 1]:
            self.box('Grade inlay', (side * ix, iy, iz), (.002, .014, .012), 'accent', .001)
        bpy.ops.object.select_all(action='SELECT')
        bpy.context.view_layer.objects.active = next(o for o in bpy.context.scene.objects if o.type == 'MESH')
        bpy.ops.object.join()
        obj = bpy.context.object
        obj.name = f'Weapon_{kind}_v1'
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        mesh = obj.data
        mesh.calc_loop_triangles()
        bounds = [[min(v.co[i] for v in mesh.vertices) for i in range(3)],
                  [max(v.co[i] for v in mesh.vertices) for i in range(3)]]
        out = OUT / kind
        out.mkdir(parents=True, exist_ok=True)
        SOURCE.mkdir(parents=True, exist_ok=True)
        accent = self.mats['accent']
        files = []
        for grade, color in enumerate(GRADE_COLORS):
            accent.diffuse_color = (*color, 1)
            accent.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (*color, 1)
            path = out / f'{kind}_{grade}.glb'
            bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True,
                                      export_yup=True, export_animations=False)
            files.append(dict(file=path.name, grade=grade, bytes=path.stat().st_size,
                              sha256=hashlib.sha256(path.read_bytes()).hexdigest()))
        # 編集元は N（グレード0）の色に戻して保存する。
        accent.diffuse_color = (*GRADE_COLORS[0], 1)
        accent.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (*GRADE_COLORS[0], 1)
        bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / f'{kind}.blend'))
        report = dict(kind=kind, code=s['code'], name=s['name'], family=s['family'],
                      blender=bpy.app.version_string,
                      triangles=len(mesh.loop_triangles), vertices=len(mesh.vertices), bounds=bounds,
                      materials=[m.name for m in mesh.materials if m],
                      bore_z=s['bore_z'], neon_profile=s['neon_profile'], files=files)
        (out / 'report.json').write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding='utf8')
        print('WEAPON_BUILD_COMPLETE', kind, report['triangles'], 'tris', len(report['materials']), 'materials')
        return report
