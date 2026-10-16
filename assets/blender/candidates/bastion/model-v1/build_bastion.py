"""BASTION（仮称）model-v1 生成器。候補フォルダだけへ出力する。

Blender 5.2.1 で factory-startup の専用プロセスから実行する:
  blender --background --factory-startup --python-exit-code 1 \
    --python assets/blender/candidates/bastion/model-v1/build_bastion.py -- [all|master|renders|game]

座標: Blender Z-up / 正面 +Y、GLB Y-up / 正面 -Z。原点は浮遊体の真下の支持面。
同じ部品構成から
  - master: 高分割・3段面取り・手続きPBR（摩耗/汚れ/傷）の .blend と状態別レンダー
  - game:   低分割・1段面取り・焼き込みPBRテクスチャの GLB（剛体ノード構成）
を作る。ゲーム側の開閉・トゲ・発光は src/client/bastion-view.ts が同じ値で動かす。
"""
import bpy, bmesh, math, json, sys, hashlib, time
from pathlib import Path
from mathutils import Vector, Matrix, Quaternion

HERE = Path(__file__).resolve().parent
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else ["all"]
MODE = ARGS[0] if ARGS else "all"

# ---- 形状パラメータ（ゲーム側 bastion-view.ts と共有する値） ----
P = dict(
    hover=1.7,            # 支持面→コア中心
    r_out=1.0,            # 外殻外径
    shell=0.085,          # 装甲厚
    band_el=7.0,          # 赤道帯の上下端（度）
    plate_el0=8.6,        # 装甲下端（度）
    plate_el1=77.0,       # 装甲上端（度）
    hub_el=79.0,          # 極ハブの下端（度）
    seam_gap=1.7,         # 継ぎ目の片側角（度）
    loose=0.035,          # 通常時に装甲が外へ浮く量（m）
    spike_len=0.62,       # トゲ全長
    spike_half=0.135,     # トゲ根元の半幅（12m先でも輪郭として読める太さ）
    spike_ext=0.5,        # 最大展開量
    spike_el=44.0,        # トゲの装甲上の仰角
    open_max=70.0,        # 開放角（度）
    ports=12,
    hinge_r=0.955,
)
C = Vector((0, 0, P["hover"]))


def sph(az, el, r):
    a, e = math.radians(az), math.radians(el)
    return Vector((r * math.cos(e) * math.sin(a), r * math.cos(e) * math.cos(a), r * math.sin(e)))


def gl(v):
    """Blender座標 → glTF座標。"""
    return [round(v.x, 6), round(v.z, 6), round(-v.y, 6)]


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    s = bpy.context.scene
    s.unit_settings.system = "METRIC"
    s.unit_settings.scale_length = 1


# ---- 材質 ----
def principled(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    return m, m.node_tree.nodes.get("Principled BSDF"), m.node_tree


def link(t, a, b):
    t.links.new(a, b)


def mix_rgb(t, fac, a, b):
    n = t.nodes.new("ShaderNodeMix")
    n.data_type = "RGBA"
    link(t, fac, n.inputs[0])
    if isinstance(a, tuple):
        n.inputs[6].default_value = (*a, 1)
    else:
        link(t, a, n.inputs[6])
    if isinstance(b, tuple):
        n.inputs[7].default_value = (*b, 1)
    else:
        link(t, b, n.inputs[7])
    return n.outputs[2]


def math_node(t, op, a, b=None, clamp=False):
    n = t.nodes.new("ShaderNodeMath")
    n.operation = op
    n.use_clamp = clamp
    for i, v in enumerate([a, b]):
        if v is None:
            continue
        if isinstance(v, (int, float)):
            n.inputs[i].default_value = v
        else:
            link(t, v, n.inputs[i])
    return n.outputs[0]


def wear_material(name, paint, metal, paint_rough, chip_scale, grime):
    """塗装・露出金属・縁の欠け・凹部の汚れ・細かな傷を手続き生成（Cycles）。
    焼き込み用に BaseColor / Roughness / Metallic を個別出力できる。"""
    m, p, t = principled(name)
    coord = t.nodes.new("ShaderNodeTexCoord")
    bevel = t.nodes.new("ShaderNodeBevel")
    bevel.samples = 8
    bevel.inputs["Radius"].default_value = 0.018
    geo = t.nodes.new("ShaderNodeNewGeometry")
    dot = t.nodes.new("ShaderNodeVectorMath")
    dot.operation = "DOT_PRODUCT"
    link(t, bevel.outputs[0], dot.inputs[0])
    link(t, geo.outputs["Normal"], dot.inputs[1])
    edge = math_node(t, "SUBTRACT", 1.0, dot.outputs["Value"])
    edge = math_node(t, "MULTIPLY", edge, 32.0, clamp=True)
    # 凸の稜線（Cycles pointiness）も縁として扱う。面取りの外周が擦れる。
    convex = math_node(t, "MULTIPLY", math_node(t, "SUBTRACT", geo.outputs["Pointiness"], 0.535), 6.0, clamp=True)
    edge = math_node(t, "MAXIMUM", edge, convex)
    noise = t.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = chip_scale
    noise.inputs["Detail"].default_value = 9
    noise.inputs["Roughness"].default_value = 0.62
    link(t, coord.outputs["Object"], noise.inputs["Vector"])
    chip = math_node(t, "MULTIPLY", edge, noise.outputs["Fac"])
    chip = math_node(t, "GREATER_THAN", chip, 0.24)
    # 細い擦り傷: 引き伸ばしたノイズの谷。
    scr_map = t.nodes.new("ShaderNodeMapping")
    scr_map.inputs["Scale"].default_value = (1, 1, 26)
    link(t, coord.outputs["Object"], scr_map.inputs["Vector"])
    scr = t.nodes.new("ShaderNodeTexNoise")
    scr.inputs["Scale"].default_value = 38
    scr.inputs["Detail"].default_value = 3
    link(t, scr_map.outputs[0], scr.inputs["Vector"])
    scratch = math_node(t, "GREATER_THAN", scr.outputs["Fac"], 0.74)
    wear = math_node(t, "MAXIMUM", chip, math_node(t, "MULTIPLY", scratch, 0.55))
    # 大きな色むら・乾いた汚れ。
    big = t.nodes.new("ShaderNodeTexNoise")
    big.inputs["Scale"].default_value = 2.4
    big.inputs["Detail"].default_value = 4
    link(t, coord.outputs["Object"], big.inputs["Vector"])
    tint = mix_rgb(t, big.outputs["Fac"], tuple(c * 0.82 for c in paint), tuple(min(1, c * 1.08) for c in paint))
    # 乾いた外装の細かなひび（ボロノイの境界）。主張しすぎない濃さ。
    cell = t.nodes.new("ShaderNodeTexVoronoi")
    cell.feature = "DISTANCE_TO_EDGE"
    cell.inputs["Scale"].default_value = 7.5
    link(t, coord.outputs["Object"], cell.inputs["Vector"])
    crack = math_node(t, "LESS_THAN", cell.outputs["Distance"], 0.012)
    crack = math_node(t, "MULTIPLY", crack, math_node(t, "GREATER_THAN", big.outputs["Fac"], 0.47))
    tint = mix_rgb(t, math_node(t, "MULTIPLY", crack, 0.55), tint, tuple(c * 0.45 for c in paint))
    # 錆びた点状の汚れ（コンセプトの茶色い斑点）。
    fleck = t.nodes.new("ShaderNodeTexNoise")
    fleck.inputs["Scale"].default_value = 90
    fleck.inputs["Detail"].default_value = 2
    link(t, coord.outputs["Object"], fleck.inputs["Vector"])
    rust = math_node(t, "GREATER_THAN", fleck.outputs["Fac"], 0.71)
    tint = mix_rgb(t, math_node(t, "MULTIPLY", rust, 0.6), tint, (0.24, 0.12, 0.06))
    ao = t.nodes.new("ShaderNodeAmbientOcclusion")
    ao.samples = 16
    ao.inputs["Distance"].default_value = 0.3
    dirt = math_node(t, "SUBTRACT", 1.0, ao.outputs["AO"])
    dirt = math_node(t, "MULTIPLY", dirt, grime * 1.4, clamp=True)
    painted = mix_rgb(t, dirt, tint, (0.09, 0.08, 0.065))
    base = mix_rgb(t, wear, painted, metal)
    rough_paint = math_node(t, "ADD", paint_rough, math_node(t, "MULTIPLY", math_node(t, "SUBTRACT", big.outputs["Fac"], 0.5), 0.16))
    rough = t.nodes.new("ShaderNodeMix")
    rough.data_type = "FLOAT"
    link(t, wear, rough.inputs[0])
    link(t, rough_paint, rough.inputs[2])
    rough.inputs[3].default_value = 0.3
    link(t, base, p.inputs["Base Color"])
    link(t, rough.outputs[0], p.inputs["Roughness"])
    link(t, wear, p.inputs["Metallic"])
    m["bake_outputs"] = "base,rough,metal"
    m["_base"] = 0
    # 焼き込み時に Emission へ差し替えるための出力を保持。
    t.nodes.new("ShaderNodeEmission").name = "BAKE_EMIT"
    m.use_backface_culling = False
    return m, dict(base=base, rough=rough.outputs[0], metal=wear)


def emissive(name, color, strength):
    m, p, t = principled(name)
    p.inputs["Base Color"].default_value = (0.02, 0.02, 0.02, 1)
    p.inputs["Roughness"].default_value = 0.25
    p.inputs["Emission Color"].default_value = (*color, 1)
    p.inputs["Emission Strength"].default_value = strength
    return m


def plain(name, color, metal, rough):
    m, p, t = principled(name)
    p.inputs["Base Color"].default_value = (*color, 1)
    p.inputs["Metallic"].default_value = metal
    p.inputs["Roughness"].default_value = rough
    return m


# ---- 形状 ----
def shell_solid(name, az0, az1, el0, el1, r_out, r_in, nu, nv):
    """球殻の一片（外面・内面・4側面）。継ぎ目や極の重複頂点は結合する。"""
    bm = bmesh.new()
    grid = []
    for r in (r_out, r_in):
        layer = []
        for i in range(nv + 1):
            el = el0 + (el1 - el0) * i / nv
            row = []
            for j in range(nu + 1):
                az = az0 + (az1 - az0) * j / nu
                row.append(bm.verts.new(C + sph(az, el, r)))
            layer.append(row)
        grid.append(layer)
    o, n = grid
    for i in range(nv):
        for j in range(nu):
            bm.faces.new((o[i][j], o[i][j + 1], o[i + 1][j + 1], o[i + 1][j]))
            bm.faces.new((n[i][j], n[i + 1][j], n[i + 1][j + 1], n[i][j + 1]))
    for j in range(nu):
        bm.faces.new((o[0][j], n[0][j], n[0][j + 1], o[0][j + 1]))
        bm.faces.new((o[nv][j], o[nv][j + 1], n[nv][j + 1], n[nv][j]))
    for i in range(nv):
        bm.faces.new((o[i][0], o[i + 1][0], n[i + 1][0], n[i][0]))
        bm.faces.new((o[i][nu], n[i][nu], n[i + 1][nu], o[i + 1][nu]))
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.dissolve_degenerate(bm, edges=bm.edges, dist=1e-6)
    # 完全に重なる内部の継ぎ目面（360度一周の両端）を除去。
    seen = {}
    dup = []
    for f in bm.faces:
        key = tuple(sorted(v.index for v in f.verts))
        if key in seen:
            dup += [f, seen[key]]
        else:
            seen[key] = f
    bmesh.ops.delete(bm, geom=list(set(dup)), context="FACES")
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    return ob


def spike_mesh(name, length, half):
    """四角錐のくさび。底面中心が原点、+Z が先端。"""
    bm = bmesh.new()
    base = [bm.verts.new((sx * half, sy * half * 0.82, 0)) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    collar = [bm.verts.new((sx * half * 0.92, sy * half * 0.75, length * 0.32)) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    tip = bm.verts.new((0, 0, length))
    bm.faces.new(list(reversed(base)))
    for i in range(4):
        bm.faces.new((base[i], base[(i + 1) % 4], collar[(i + 1) % 4], collar[i]))
        bm.faces.new((collar[i], collar[(i + 1) % 4], tip))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    return ob


def finish(ob, mat, bevel, segs, smooth=34):
    ob.data.materials.append(mat)
    if bevel:
        md = ob.modifiers.new("chamfer", "BEVEL")
        md.width = bevel
        md.segments = segs
        md.limit_method = "ANGLE"
        md.angle_limit = math.radians(30)
        md.harden_normals = True
        md.miter_outer = "MITER_ARC"
        bpy.context.view_layer.objects.active = ob
        bpy.ops.object.modifier_apply(modifier=md.name)
    for f in ob.data.polygons:
        f.use_smooth = True
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(smooth))
    ob.select_set(False)
    return ob


def set_origin(ob, point):
    ob.data.transform(Matrix.Translation(-point))
    ob.location = point


def join(objs, name):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = bpy.context.object
    o.name = name
    o.data.name = name
    o.select_set(False)
    return o


def build(quality):
    """quality: 'master' | 'game'。同じ階層・名前・寸法で作る。"""
    hi = quality == "master"
    seg = (lambda m, g: m if hi else g)
    bev = (lambda w: (w, 3) if hi else (w, 1))
    mats = dict(
        shell=wear_material("BASTION_shell", (0.56, 0.545, 0.51), (0.36, 0.36, 0.37), 0.55, 16, 0.85)[0],
        frame=wear_material("BASTION_frame", (0.055, 0.056, 0.062), (0.30, 0.30, 0.31), 0.36, 22, 0.5)[0],
        seam=emissive("BASTION_seam", (0.55, 0.85, 1.0), 6),
        port=emissive("BASTION_port", (0.5, 0.8, 1.0), 4),
        core=emissive("BASTION_core", (0.55, 0.9, 1.0), 9),
    )
    root = bpy.data.objects.new("BASTION_ROOT", None)
    bpy.context.collection.objects.link(root)
    root["forward"] = "Blender +Y / glTF -Z"
    root["units"] = "meters; origin on the support surface below the hovering body"
    body = bpy.data.objects.new("Body", None)
    bpy.context.collection.objects.link(body)
    body.location = C
    body.parent = root
    parts = []

    def attach(ob, parent, origin=None):
        if origin is not None:
            set_origin(ob, origin)
        # 親子付けの前に行列を更新しないと、直前の原点移動が反映されない。
        bpy.context.view_layer.update()
        world = ob.matrix_world.copy()
        ob.parent = parent
        ob.matrix_parent_inverse = parent.matrix_world.inverted()
        ob.matrix_world = world
        parts.append(ob)
        return ob

    # 赤道帯（反撃の発射口12個を持つ回転帯）。
    band = finish(shell_solid("band", 0, 360, -P["band_el"], P["band_el"], 1.0, 0.80, seg(144, 36), seg(8, 2)), mats["frame"], *bev(0.012))
    ports, frames = [], []
    for k in range(P["ports"]):
        az = k * 360 / P["ports"]
        frames.append(shell_solid("port_frame", az - 4.6, az + 4.6, -4.9, 4.9, 1.006, 0.985, seg(10, 2), seg(6, 1)))
        ports.append(shell_solid("port_glow", az - 3.1, az + 3.1, -3.3, 3.3, 1.012, 0.995, seg(8, 2), seg(5, 2)))
    # 発射口の間の縦補強リブ。帯が回ると目で追える凹凸になる。
    for k in range(P["ports"]):
        az = (k + 0.5) * 360 / P["ports"]
        frames.append(shell_solid("band_rib", az - 1.3, az + 1.3, -P["band_el"] + 0.6, P["band_el"] - 0.6, 1.02, 0.99, 2, seg(6, 2)))
    for f in frames:
        finish(f, mats["frame"], *bev(0.004))
    band = join([band, *frames], "band")
    port_glow = join([finish(p, mats["port"], 0, 0) for p in ports], "band_ports")
    attach(band, body, C)
    attach(port_glow, band, C)

    # 内部骨格（子午線リブ・継ぎ目光・極ハブ・支柱）とコア。
    # 正面（+Y、標的の方向）は継ぎ目。開放時に正面の2枚が左右へ開き、標的側にコアが出る。
    cage, seams = [], []
    for k in range(4):
        az = 90 * k
        for sgn in (1, -1):
            el0, el1 = sorted((sgn * P["plate_el0"] * 0.9, sgn * P["hub_el"]))
            cage.append(finish(shell_solid("rib", az - 2.3, az + 2.3, el0, el1, 0.925, 0.86, seg(4, 1), seg(28, 6)), mats["frame"], *bev(0.006)))
            seams.append(shell_solid("seam", az - 0.9, az + 0.9, el0, el1, 0.934, 0.924, 1, seg(28, 6)))
            # 継ぎ目に連なる関節リンク。両端は装甲の下へ潜り、リンクの間から継ぎ目の光が漏れる。
            # ゲーム版は間隔を倍にして面取りを省く（遠目では光の切れ目として読める）。
            for step_el in range(12, 75, seg(7, 14)):
                e = sgn * step_el
                link = shell_solid("link", az - 2.7, az + 2.7, e - 1.5, e + 1.5, 0.996, 0.95, seg(4, 1), seg(3, 1))
                cage.append(finish(link, mats["frame"], *(bev(0.004) if hi else (0, 0))))
        # 帯の内側から核へ伸びる支柱。
        a = math.radians(az)
        d = Vector((math.sin(a), math.cos(a), 0))
        strut = shell_solid("strut", az - 2.5, az + 2.5, -2.4, 2.4, 0.82, 0.47, 2, 2)
        cage.append(finish(strut, mats["frame"], *bev(0.006)))
    for sgn in (1, -1):
        el0, el1 = sorted((sgn * (P["band_el"] + 0.25), sgn * (P["plate_el0"] - 0.35)))
        seams.append(shell_solid("seam_ring", 0, 360, el0, el1, 0.95, 0.94, seg(144, 36), 1))
        el0, el1 = sorted((sgn * P["hub_el"], sgn * 90))
        cage.append(finish(shell_solid("hub", 0, 360, el0, el1, 1.004, 0.90, seg(48, 12), seg(8, 2)), mats["frame"], *bev(0.01)))
        ring = shell_solid("hub_ring", 0, 360, sgn * 82.5 - 0.8, sgn * 82.5 + 0.8, 1.016, 0.99, seg(48, 12), 1)
        cage.append(finish(ring, mats["frame"], *bev(0.004)))
    for axis in range(3):
        bpy.ops.mesh.primitive_torus_add(major_radius=0.5, minor_radius=0.03, major_segments=seg(64, 16), minor_segments=seg(10, 4), location=C)
        t = bpy.context.object
        # 水平1本＋斜め縦2本。正面から見て縦線がコアの前を横切らない。
        t.rotation_euler = [(0, 0, 0), (math.pi / 2, 0, math.pi / 4), (math.pi / 2, 0, -math.pi / 4)][axis]
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
        cage.append(finish(t, mats["frame"], 0, 0))
    cage_ob = attach(join(cage, "cage"), body, C)
    seam_ob = attach(join([finish(s, mats["seam"], 0, 0) for s in seams], "seams"), body, C)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.40, segments=seg(48, 20), ring_count=seg(24, 10), location=C)
    core = finish(bpy.context.object, mats["core"], 0, 0, 80)
    core.name = "core"
    attach(core, body)  # 原点は生成時から中心

    # 装甲8枚とトゲ10本。開放軸・浮き方向・トゲ方向を extras に書く（glTF座標・Body基準）。
    g = P["seam_gap"]
    rig = dict(plates=[], spikes=[])
    for half, sgn in (("U", 1), ("L", -1)):
        for k in range(4):
            az = 45 + 90 * k
            # 主装甲＋極側の冠パネル（一段厚い）。間の溝の底は暗い裏当て。
            groove = (57.6, 58.6)
            el0, el1 = sorted((sgn * P["plate_el0"], sgn * groove[0]))
            main = finish(shell_solid("plate", az - 45 + g, az + 45 - g, el0, el1, P["r_out"], P["r_out"] - P["shell"], seg(56, 10), seg(30, 6)), mats["shell"], *bev(0.016))
            el0, el1 = sorted((sgn * groove[1], sgn * P["plate_el1"]))
            crown = finish(shell_solid("crown", az - 45 + g + 1.2, az + 45 - g - 1.2, el0, el1, P["r_out"] + 0.014, P["r_out"] - P["shell"], seg(40, 8), seg(16, 3)), mats["shell"], *bev(0.016))
            el0, el1 = sorted((sgn * (groove[0] - 1.5), sgn * (groove[1] + 1.5)))
            backing = finish(shell_solid("backing", az - 44, az + 44, el0, el1, P["r_out"] - 0.05, P["r_out"] - P["shell"] - 0.004, seg(40, 10), 2), mats["frame"], 0, 0)
            plate = join([main, crown, backing], "plate_tmp")
            ia, ib = sorted((sgn * (P["plate_el0"] + 3.5), sgn * (P["plate_el0"] + 22)))
            inlay = finish(shell_solid("inlay", az - 34, az + 34, ia, ib, P["r_out"] + 0.018, P["r_out"] - 0.01, seg(40, 8), seg(14, 3)), mats["shell"], *bev(0.007))
            sa = sgn * P["spike_el"]
            n = sph(az, sa, 1.0)
            # 受け座: 暗い枠＋硬化の色で光る台座（継ぎ目と同じ材質）。弧長で寸法を決める。
            cos_el = math.cos(math.radians(P["spike_el"]))
            def span(half_m):
                return math.degrees(half_m / cos_el), math.degrees(half_m)
            caz, cel = span(0.175)
            collar = finish(shell_solid("collar", az - caz, az + caz, sa - cel, sa + cel, P["r_out"] + 0.026, P["r_out"] - 0.02, seg(16, 4), seg(14, 3)), mats["frame"], *bev(0.008))
            gaz, gel = span(0.148)
            seat = finish(shell_solid("seat", az - gaz, az + gaz, sa - gel, sa + gel, P["r_out"] + 0.031, P["r_out"] + 0.02, seg(12, 3), seg(10, 3)), mats["seam"], 0, 0)
            plate = join([plate, inlay, collar, seat], f"plate_{half}{k}")
            a = math.radians(az)
            radial = Vector((math.sin(a), math.cos(a), 0))
            tangent = Vector((math.cos(a), -math.sin(a), 0))
            hinge = C + radial * P["hinge_r"] * math.cos(math.radians(P["plate_el0"])) + Vector((0, 0, sgn * P["hinge_r"] * math.sin(math.radians(P["plate_el0"]))))
            axis = -tangent if sgn > 0 else tangent
            centre = sph(az, sgn * (P["plate_el0"] + P["plate_el1"]) / 2, 1).normalized()
            attach(plate, body, hinge)
            info = dict(name=plate.name, hinge=gl(hinge - C), axis=gl(axis), loose=gl(centre))
            for k2 in ("hinge", "axis", "loose"):
                plate[k2] = info[k2]
            rig["plates"].append(info)
            sp = finish(spike_mesh(f"spike_{half}{k}", P["spike_len"], P["spike_half"]), mats["shell"], *bev(0.012))
            base_pt = C + n * (P["r_out"] - P["spike_len"] + 0.02)
            sp.matrix_world = Matrix.Translation(base_pt) @ n.to_track_quat("Z", "Y").to_matrix().to_4x4()
            bpy.context.view_layer.update()
            attach(sp, plate)
            sp["dir"] = gl(n)
            rig["spikes"].append(dict(name=sp.name, parent=plate.name, dir=gl(n)))
    for half, sgn in (("N", 1), ("S", -1)):
        n = Vector((0, 0, sgn))
        sp = finish(spike_mesh(f"spike_{half}", P["spike_len"] * 0.9, P["spike_half"] * 0.95), mats["shell"], *bev(0.012))
        base_pt = C + n * (P["r_out"] - P["spike_len"] * 0.9 + 0.03)
        sp.matrix_world = Matrix.Translation(base_pt) @ n.to_track_quat("Z", "Y").to_matrix().to_4x4()
        bpy.context.view_layer.update()
        attach(sp, body)
        sp["dir"] = gl(n)
        rig["spikes"].append(dict(name=sp.name, parent="Body", dir=gl(n)))
    root["rig"] = json.dumps(dict(params=P, **rig))
    return dict(root=root, body=body, parts=parts, mats=mats, rig=rig)


# ---- 状態（bastion-view.ts と同じ式） ----
STATES = {
    "normal": dict(loose=1, spikes=0, open=0, seam=(0.55, 0.85, 1.0), seam_s=7, port=(0.45, 0.75, 1.0), port_s=3, core_s=2, band=0),
    "hardened": dict(loose=0, spikes=2 / 3, open=0, seam=(1.0, 0.55, 0.12), seam_s=11, port=(1.0, 0.55, 0.12), port_s=4, core_s=1, band=0),
    "brace": dict(loose=0, spikes=1, open=0, seam=(1.0, 0.45, 0.05), seam_s=16, port=(1.0, 0.45, 0.06), port_s=18, core_s=1, band=12),
    "warn": dict(loose=0, spikes=1, open=0, seam=(1.0, 0.08, 0.06), seam_s=14, port=(1.0, 0.05, 0.04), port_s=40, core_s=1, band=0),
    "open": dict(loose=0, spikes=0, open=1, seam=(0.35, 0.6, 0.8), seam_s=2, port=(0.3, 0.5, 0.7), port_s=1, core_s=24, band=0),
}


def pose(model, name):
    s = STATES[name]
    rig = model["rig"]
    objs = {o.name: o for o in model["parts"]}
    for pl in rig["plates"]:
        o = objs[pl["name"]]
        if "rest" not in o:
            o["rest"] = list(o.location)
        hinge = C + Vector((pl["hinge"][0], -pl["hinge"][2], pl["hinge"][1]))
        loose = Vector((pl["loose"][0], -pl["loose"][2], pl["loose"][1]))
        axis = Vector((pl["axis"][0], -pl["axis"][2], pl["axis"][1]))
        o.location = hinge + loose * P["loose"] * s["loose"]
        o.rotation_mode = "QUATERNION"
        o.rotation_quaternion = Quaternion(axis, math.radians(P["open_max"]) * s["open"])
    for sp in rig["spikes"]:
        o = objs[sp["name"]]
        if "rest" not in o:
            o["rest"] = list(o.location)
        d = Vector((sp["dir"][0], -sp["dir"][2], sp["dir"][1]))
        rest = Vector(o["rest"])
        # 親空間での移動量。プレート子は親の回転を受けるので親基準で同じ向き。
        o.location = rest + (o.parent.matrix_world.to_3x3().inverted() @ d) * P["spike_ext"] * s["spikes"]
    objs["band"].rotation_mode = "XYZ"
    objs["band"].rotation_euler = (0, 0, math.radians(s["band"]))
    m = model["mats"]
    for key, col, st in (("seam", s["seam"], s["seam_s"]), ("port", s["port"], s["port_s"])):
        p = m[key].node_tree.nodes.get("Principled BSDF")
        p.inputs["Emission Color"].default_value = (*col, 1)
        p.inputs["Emission Strength"].default_value = st
    m["core"].node_tree.nodes.get("Principled BSDF").inputs["Emission Strength"].default_value = s["core_s"]
    bpy.context.view_layer.update()


# ---- master: 保存とレンダー ----
def stage(engine_samples=96):
    s = bpy.context.scene
    s.render.engine = "CYCLES"
    s.cycles.samples = engine_samples
    s.cycles.use_denoising = True
    s.render.resolution_x = s.render.resolution_y = 1024
    s.render.film_transparent = False
    s.view_settings.view_transform = "AgX"
    w = bpy.data.worlds.new("grey")
    w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[0].default_value = (0.42, 0.44, 0.46, 1)
    w.node_tree.nodes["Background"].inputs[1].default_value = 0.32
    s.world = w
    bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 0, 0))
    floor = bpy.context.object
    floor.name = "review_floor"
    floor.data.materials.append(plain("review_floor", (0.33, 0.34, 0.35), 0, 0.85))
    lights = []
    for name, loc, energy, size, color in (
        ("key", (-3.6, 4.8, 5.6), 900, 2.6, (1, 0.97, 0.93)),
        ("fill", (4.8, 2.6, 2.4), 260, 3.5, (0.86, 0.92, 1.0)),
        ("rim", (1.5, -4.8, 4.4), 650, 1.6, (1, 1, 1)),
    ):
        d = bpy.data.lights.new(name, "AREA")
        d.energy = energy
        d.size = size
        d.color = color
        o = bpy.data.objects.new(name, d)
        o.location = loc
        o.rotation_euler = (Vector((0, 0, P["hover"])) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
        s.collection.objects.link(o)
        lights.append(o)
    cam = bpy.data.objects.new("review_cam", bpy.data.cameras.new("review_cam"))
    cam.data.lens = 70
    s.collection.objects.link(cam)
    s.camera = cam
    return cam, floor, lights


def aim(cam, az, el, dist, target=None):
    target = target or Vector((0, 0, P["hover"] - 0.12))
    cam.location = target + sph(az, el, dist)
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()


def render(path):
    bpy.context.scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


def compare_sheet(paths, out, cols):
    """同寸法のPNGを numpy で横並びにした比較シート。"""
    import numpy as np
    imgs = []
    for p in paths:
        im = bpy.data.images.load(str(p))
        w, h = im.size
        a = np.array(im.pixels[:], dtype=np.float32).reshape(h, w, 4)
        imgs.append(a)
        bpy.data.images.remove(im)
    h, w = imgs[0].shape[:2]
    rows = (len(imgs) + cols - 1) // cols
    sheet = np.ones((rows * h, cols * w, 4), dtype=np.float32)
    for i, a in enumerate(imgs):
        r, c = divmod(i, cols)
        sheet[(rows - 1 - r) * h:(rows - r) * h, c * w:(c + 1) * w] = a
    out_img = bpy.data.images.new("sheet", cols * w, rows * h, alpha=True)
    out_img.pixels[:] = sheet.ravel()
    out_img.filepath_raw = str(out)
    out_img.file_format = "PNG"
    out_img.save()


def run_master():
    reset()
    model = build("master")
    pose(model, "normal")
    bpy.ops.wm.save_as_mainfile(filepath=str(HERE / "bastion_master.blend"))
    return model


def run_renders(model, samples):
    out = HERE / "renders"
    out.mkdir(exist_ok=True)
    cam, floor, lights = stage(samples)
    files = []
    for name in ("normal", "hardened", "brace", "warn", "open"):
        pose(model, name)
        aim(cam, 28, 14, 7.6)
        f = out / f"state_{name}.png"
        render(f)
        files.append(f)
    compare_sheet(files, out / "states_sheet.png", 5)
    pose(model, "normal")
    if MODE == "quick":
        return files
    views = []
    for name, az, el in (("front", 0, 4), ("side", 90, 4), ("back", 180, 4), ("top", 0, 80)):
        aim(cam, az, el, 7.6)
        f = out / f"view_{name}.png"
        render(f)
        views.append(f)
    compare_sheet(views, out / "views_sheet.png", 4)
    # 単色の輪郭（ゲーム表示での読取り確認用）。全状態を同じ角度で。
    flat = plain("silhouette", (0.02, 0.02, 0.02), 0, 1)
    saved = {o.name: list(o.data.materials) for o in model["parts"] if o.type == "MESH"}
    for o in model["parts"]:
        if o.type == "MESH":
            for i in range(len(o.data.materials)):
                o.data.materials[i] = flat
    floor.hide_render = True
    bpy.context.scene.world.node_tree.nodes["Background"].inputs[0].default_value = (1, 1, 1, 1)
    bpy.context.scene.world.node_tree.nodes["Background"].inputs[1].default_value = 1
    for l in lights:
        l.hide_render = True
    bpy.context.scene.cycles.samples = 16
    sil = []
    for name in ("normal", "hardened", "brace", "open"):
        pose(model, name)
        aim(cam, 28, 14, 7.6)
        f = out / f"silhouette_{name}.png"
        render(f)
        sil.append(f)
    compare_sheet(sil, out / "silhouette_sheet.png", 4)
    for o in model["parts"]:
        if o.type == "MESH":
            for i, m in enumerate(saved[o.name]):
                o.data.materials[i] = m
    return files


# ---- game: 焼き込み・GLB書出し・再読込検証 ----
def bake_game(model, size):
    import numpy as np
    s = bpy.context.scene
    s.render.engine = "CYCLES"
    s.cycles.samples = 24
    s.cycles.use_denoising = False
    s.render.bake.margin = 6
    # 外装と骨格を1枚のUVアトラスへ同時に焼く。両材質の同じ画像ノードを
    # アクティブにすると、各面は自分の材質の値でその画像へ焼かれる。
    keys = ("shell", "frame")
    mats = [model["mats"][k] for k in keys]
    names = {m.name for m in mats}
    objs = [o for o in model["parts"] if o.type == "MESH" and names & {m.name for m in o.data.materials}]
    for o in objs:
        if not o.data.uv_layers:
            o.data.uv_layers.new(name="UVMap")
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(52), island_margin=0.004, scale_to_bounds=False)
    bpy.ops.uv.pack_islands(margin=0.003, rotate=True)
    bpy.ops.object.mode_set(mode="OBJECT")
    nodes = []
    for mat in mats:
        t = mat.node_tree
        n = t.nodes.new("ShaderNodeTexImage")
        nodes.append((mat, n))
    # 同じ物体にある他の材質（受け座の発光など）も焼き込み先が必要。値は使わない。
    others = []
    for o in objs:
        for m in o.data.materials:
            if m.name not in names and m not in [x for x, _ in others]:
                others.append((m, m.node_tree.nodes.new("ShaderNodeTexImage")))
    channels = {}
    images = {}
    for channel, socket in (("base", "Base Color"), ("rough", "Roughness"), ("metal", "Metallic")):
        img = bpy.data.images.new(f"bastion_armor_{channel}", size, size, alpha=False, float_buffer=False)
        img.colorspace_settings.name = "sRGB" if channel == "base" else "Non-Color"
        for mat, n in nodes:
            t = mat.node_tree
            p = t.nodes.get("Principled BSDF")
            emit = t.nodes.get("BAKE_EMIT")
            out = t.nodes.get("Material Output")
            n.image = img
            t.nodes.active = n
            for l in list(out.inputs["Surface"].links):
                t.links.remove(l)
            for l in list(emit.inputs["Color"].links):
                t.links.remove(l)
            t.links.new(p.inputs[socket].links[0].from_socket, emit.inputs["Color"])
            t.links.new(emit.outputs[0], out.inputs["Surface"])
        for mat, n in others:
            n.image = img
            mat.node_tree.nodes.active = n
        bpy.ops.object.bake(type="EMIT", use_clear=True)
        channels[channel] = np.array(img.pixels[:], dtype=np.float32).reshape(size, size, 4)
        images[channel] = img
    for mat, n in nodes:
        t = mat.node_tree
        out = t.nodes.get("Material Output")
        for l in list(out.inputs["Surface"].links):
            t.links.remove(l)
        t.links.new(t.nodes.get("Principled BSDF").outputs[0], out.inputs["Surface"])
    # 書出しに焼き込み用の画像ノードを残さない（発光材質は係数だけで書き出す）。
    for mat, n in others:
        mat.node_tree.nodes.remove(n)
    orm = bpy.data.images.new("bastion_armor_orm", size, size, alpha=False)
    orm.colorspace_settings.name = "Non-Color"
    a = np.ones((size, size, 4), dtype=np.float32)
    a[..., 1] = channels["rough"][..., 0]
    a[..., 2] = channels["metal"][..., 0]
    orm.pixels[:] = a.ravel()
    # ゲーム用材質: 焼き込み画像だけを読む単純なPrincipled（glTF metallicRoughness）。
    gm, gp, gt = principled("BASTION_armor")
    bt = gt.nodes.new("ShaderNodeTexImage")
    bt.image = images["base"]
    ot = gt.nodes.new("ShaderNodeTexImage")
    ot.image = orm
    sep = gt.nodes.new("ShaderNodeSeparateColor")
    gt.links.new(bt.outputs["Color"], gp.inputs["Base Color"])
    gt.links.new(ot.outputs["Color"], sep.inputs[0])
    gt.links.new(sep.outputs[1], gp.inputs["Roughness"])
    gt.links.new(sep.outputs[2], gp.inputs["Metallic"])
    for o in objs:
        same = [i for i, m in enumerate(o.data.materials) if m.name in names]
        for i in same:
            o.data.materials[i] = gm
        for f in o.data.polygons:
            if f.material_index in same:
                f.material_index = same[0]
        # 同じ材質になった面をまとめ、ノード当たりの描画回数を減らす。
        bpy.context.view_layer.objects.active = o
        o.select_set(True)
        bpy.ops.object.material_slot_remove_unused()
        o.select_set(False)
    (HERE / "textures").mkdir(exist_ok=True)
    for img in (images["base"], orm):
        img.filepath_raw = str(HERE / "textures" / f"{img.name}.png")
        img.file_format = "PNG"
        img.save()
    return dict(objects=[o.name for o in objs], size=size, atlas="shell+frame")


def glb_triangles(raw):
    doc = json.loads(raw[20:20 + int.from_bytes(raw[12:16], "little")])
    tri = sum(doc["accessors"][p["indices"]]["count"] // 3 for m in doc["meshes"] for p in m["primitives"])
    return doc, tri


def run_game():
    reset()
    model = build("game")
    pose(model, "normal")
    for o in model["parts"]:
        for k in ("rest",):
            if k in o:
                del o[k]
    baked = bake_game(model, 1024)
    # 書出しは中立姿勢（装甲は蝶番位置・回転なし・トゲ格納）。
    for o in model["parts"]:
        o.rotation_mode = "QUATERNION"
        o.rotation_quaternion = (1, 0, 0, 0)
    for pl in model["rig"]["plates"]:
        o = bpy.data.objects[pl["name"]]
        o.location = C + Vector((pl["hinge"][0], -pl["hinge"][2], pl["hinge"][1]))
    for m, col, st in ((model["mats"]["seam"], (0.55, 0.85, 1.0), 7), (model["mats"]["port"], (0.45, 0.75, 1.0), 3)):
        p = m.node_tree.nodes.get("Principled BSDF")
        p.inputs["Emission Color"].default_value = (*col, 1)
        p.inputs["Emission Strength"].default_value = st
    bpy.context.view_layer.update()
    # 焼き込み画像（PNGはgit対象外）を .blend に同梱し、単体で開けるようにする。
    for name in ("bastion_armor_base", "bastion_armor_orm"):
        bpy.data.images[name].pack()
    bpy.ops.wm.save_as_mainfile(filepath=str(HERE / "bastion_game.blend"))
    glb = HERE / "bastion_v1.glb"
    bpy.ops.object.select_all(action="DESELECT")
    for o in [model["root"], model["body"], *model["parts"]]:
        o.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=str(glb), export_format="GLB", use_selection=True, export_yup=True,
        export_extras=True, export_cameras=False, export_lights=False, export_animations=False,
        export_texcoords=True, export_normals=True, export_image_format="JPEG", export_image_quality=90,
    )
    raw = glb.read_bytes()
    doc, tri = glb_triangles(raw)
    names = sorted(n.get("name", "") for n in doc["nodes"])
    expected = ["BASTION_ROOT", "Body", "band", "band_ports", "cage", "core", "seams"] + [f"plate_{h}{k}" for h in "UL" for k in range(4)] + [f"spike_{h}{k}" for h in "UL" for k in range(4)] + ["spike_N", "spike_S"]
    missing = sorted(set(expected) - set(names))
    assert not missing, missing
    # 再読込: 頂点の有限性・境界・原点の確認。
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(glb))
    bpy.context.view_layer.update()
    pts = []
    for o in bpy.context.scene.objects:
        if o.type == "MESH":
            pts += [o.matrix_world @ v.co for v in o.data.vertices]
    assert all(all(math.isfinite(c) for c in p) for p in pts)
    lo = [min(p[i] for p in pts) for i in range(3)]
    hi = [max(p[i] for p in pts) for i in range(3)]
    assert lo[2] > 0.25, lo  # 浮遊: 最下部は支持面から離れる
    assert abs((lo[2] + hi[2]) / 2 - P["hover"]) < 0.05
    report = dict(
        blender=bpy.app.version_string, glb=glb.name, bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest(),
        triangles=tri, nodes=len(doc["nodes"]), meshes=len(doc["meshes"]), materials=[m["name"] for m in doc["materials"]],
        images=[dict(name=i.get("name"), mime=i.get("mimeType")) for i in doc.get("images", [])],
        bounds_blender=dict(min=lo, max=hi), baked=baked, rig=json.loads(doc["nodes"][[n.get("name") for n in doc["nodes"]].index("BASTION_ROOT")]["extras"]["rig"]),
    )
    (HERE / "game-report.json").write_text(json.dumps(report, indent=2))
    print("GAME", json.dumps({k: report[k] for k in ("bytes", "triangles", "nodes", "meshes", "sha256")}))


def master_stats(model):
    tris = 0
    for o in model["parts"]:
        if o.type == "MESH":
            o.data.calc_loop_triangles()
            tris += len(o.data.loop_triangles)
    return dict(triangles=tris)


if __name__ == "__main__":
    t0 = time.time()
    samples = int(ARGS[1]) if len(ARGS) > 1 else 96
    if MODE == "quick":
        bpy.context.scene.render.resolution_percentage = 50
    if MODE in ("all", "master", "renders", "quick"):
        model = run_master()
        stats = master_stats(model)
        (HERE / "master-report.json").write_text(json.dumps(dict(blender=bpy.app.version_string, **stats, params=P), indent=2))
        print("MASTER", stats)
        if MODE in ("all", "renders", "quick"):
            run_renders(model, samples)
    if MODE in ("all", "game"):
        run_game()
    print("DONE", round(time.time() - t0, 1), "s")
