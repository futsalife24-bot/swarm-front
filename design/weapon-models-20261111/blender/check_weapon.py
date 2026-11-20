"""書き出した GLB を読み直して検査する。
blender --background --python-exit-code 1 --python check_weapon.py -- <kind>

1) GLB のバイナリを直接読む（three.js が受け取る頂点そのもの）:
   上限・寸法の枠・銃口の自動算出（src/client/standard-trooper.ts の weaponBore と同じ計算を
   Python で書き直したもの。製品コードそのものの実行ではない）・握り/支えの位置。
2) Blender へ読み込み直す: 1メッシュ、三角形数と寸法が生成時の report.json と一致。
結果は out/<kind>/check.json。不合格が1つでもあれば終了コード1。
"""
import bpy, sys, json, struct, importlib
from pathlib import Path
from mathutils import Vector

sys.dont_write_bytecode = True  # __pycache__ を作らない
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from weapon_kit import OUT, GRADE_COLORS

LIMITS = dict(
    triangles_target=9000, triangles_max=12060,   # 上限は現行最大（ライフル）と同じ
    primitives_max=6,                             # 材質数 = 描画回数
    bytes_target=500_000, bytes_max=800_000,
    forward=(-.40, .70), up=(-.25, .21), half_width=.115,
    front_margin=.10,                             # 前端 >= |後端| + 0.10
    muzzle_side=.002, muzzle_up=.004,
    grip=dict(forward=(-.08, .03), up=(-.15, -.03), half_width=.026),
    support=dict(forward=(.18, .40), up=(-.05, .03), half_width=.040),
)

kind = sys.argv[sys.argv.index('--') + 1]
out = OUT / kind
report = json.loads((out / 'report.json').read_text(encoding='utf8'))
checks, fails, warns = [], [], []


def check(name, ok, detail, warn=False):
    checks.append(dict(name=name, ok=bool(ok), detail=detail))
    if not ok:
        (warns if warn else fails).append(f'{name}: {detail}')


def read_glb(path):
    data = path.read_bytes()
    assert data[:4] == b'glTF'
    jlen = struct.unpack_from('<I', data, 12)[0]
    gltf = json.loads(data[20:20 + jlen])
    blob = data[20 + jlen + 8:]
    points, tris, topology = [], 0, []
    for mesh in gltf['meshes']:
        for prim in mesh['primitives']:
            acc = gltf['accessors'][prim['attributes']['POSITION']]
            view = gltf['bufferViews'][acc['bufferView']]
            assert acc['componentType'] == 5126 and acc['type'] == 'VEC3'
            start = view.get('byteOffset', 0) + acc.get('byteOffset', 0)
            stride = view.get('byteStride', 12)
            for i in range(acc['count']):
                points.append(struct.unpack_from('<3f', blob, start + i * stride))
            idx = gltf['accessors'][prim['indices']]
            iview = gltf['bufferViews'][idx['bufferView']]
            code = {5121: 'B', 5123: 'H', 5125: 'I'}[idx['componentType']]
            step = iview.get('byteStride', struct.calcsize('<' + code))
            begin = iview.get('byteOffset', 0) + idx.get('byteOffset', 0)
            topology.append(tuple(struct.unpack_from('<' + code, blob, begin + i * step)[0]
                                  for i in range(idx['count'])))
            tris += idx['count'] // 3
    return gltf, points, tris, len(data), topology


def bore(points):
    """weaponBore と同じ: 最長軸、原点から遠い端、その端から全長3%以内の頂点の重心。"""
    lo = [min(p[i] for p in points) for i in range(3)]
    hi = [max(p[i] for p in points) for i in range(3)]
    size = [hi[i] - lo[i] for i in range(3)]
    axis = 0 if size[0] >= size[1] and size[0] >= size[2] else 1 if size[1] >= size[2] else 2
    end = hi[axis] if abs(hi[axis]) >= abs(lo[axis]) else lo[axis]
    band = size[axis] * .03
    tip = [p for p in points if abs(p[axis] - end) <= band]
    muzzle = [sum(p[i] for p in tip) / len(tip) for i in range(3)]
    muzzle[axis] = end
    return axis, end, muzzle, len(tip)


base = None
for grade in range(5):
    path = out / f'{kind}_{grade}.glb'
    gltf, pts, tris, size, topology = read_glb(path)
    # glTF(X, Y上, -Z前) → 設計の座標（横, 前, 上）
    design = [(x, -z, y) for x, y, z in pts]
    prims = sum(len(m['primitives']) for m in gltf['meshes'])
    tag = f'[{path.name}] '
    if grade == 0:
        check(tag + '三角形数（上限）', tris <= LIMITS['triangles_max'], f"{tris} / {LIMITS['triangles_max']}")
        check(tag + '三角形数（目標）', tris <= LIMITS['triangles_target'], f"{tris} / {LIMITS['triangles_target']}", warn=True)
        check(tag + '材質数=描画回数', prims <= LIMITS['primitives_max'], f"{prims} / {LIMITS['primitives_max']}")
        check(tag + 'メッシュ1つ・ノード変換なし',
              len(gltf['meshes']) == 1 and not any(k in n for n in gltf['nodes'] for k in ('matrix', 'translation', 'rotation', 'scale')),
              f"meshes={len(gltf['meshes'])}")
        check(tag + '画像・アニメーション・透過なし',
              not gltf.get('images') and not gltf.get('animations') and all(m.get('alphaMode', 'OPAQUE') == 'OPAQUE' for m in gltf['materials']),
              'images/animations/alphaMode')
        f = [p[1] for p in design]; u = [p[2] for p in design]; w = [abs(p[0]) for p in design]
        check(tag + '寸法の枠（前後）', LIMITS['forward'][0] <= min(f) and max(f) <= LIMITS['forward'][1], f'{min(f):.3f} .. {max(f):.3f}')
        check(tag + '寸法の枠（上下）', LIMITS['up'][0] <= min(u) and max(u) <= LIMITS['up'][1], f'{min(u):.3f} .. {max(u):.3f}')
        check(tag + '寸法の枠（半幅）', max(w) <= LIMITS['half_width'], f'{max(w):.3f}')
        check(tag + '前端が後端より十分に遠い', max(f) >= abs(min(f)) + LIMITS['front_margin'], f'前 {max(f):.3f} / 後 {min(f):.3f}')
        axis, end, muzzle, n = bore(pts)
        check(tag + '銃口算出: 最長軸が前後で、前端が選ばれる', axis == 2 and end < 0, f'axis={"xyz"[axis]} end={end:.3f}')
        check(tag + '銃口算出: 左右のずれ', abs(muzzle[0]) <= LIMITS['muzzle_side'], f'{muzzle[0]*1000:.2f} mm（先端の頂点 {n} 個）')
        check(tag + '銃口算出: 高さが設計の銃身軸と一致', abs(muzzle[1] - report['bore_z']) <= LIMITS['muzzle_up'],
              f"算出 {muzzle[1]:.4f} / 設計 {report['bore_z']:.4f}")
        for zone, label in [('grip', '握り'), ('support', '左手の支え')]:
            z = LIMITS[zone]
            inside = [p for p in design if z['forward'][0] <= p[1] <= z['forward'][1] and z['up'][0] <= p[2] <= z['up'][1]]
            widest = max((abs(p[0]) for p in inside), default=0)
            check(tag + f'{label}の位置に形があり、握れる幅', bool(inside) and widest <= z['half_width'],
                  f'頂点 {len(inside)} 個、半幅 {widest:.3f} / {z["half_width"]}')
        for p in report['neon_profile']:
            if not (min(f) - .006 <= p[0] <= max(f) + .006 and min(u) - .006 <= p[1] <= max(u) + .006):
                check(tag + 'ネオン外形が本体の範囲内', False, str(p))
                break
        else:
            check(tag + 'ネオン外形が本体の範囲内', True, f"{len(report['neon_profile'])} 点")
        base = dict(count=len(pts), tris=tris, lo=[min(c) for c in zip(*pts)], hi=[max(c) for c in zip(*pts)],
                    points=pts, topology=topology)
    else:
        same = len(pts) == base['count'] and tris == base['tris'] and \
            all(abs(a - b) < 1e-6 for a, b in zip([min(c) for c in zip(*pts)] + [max(c) for c in zip(*pts)], base['lo'] + base['hi'])) and \
            all(abs(a - b) < 1e-6 for p, q in zip(pts, base['points']) for a, b in zip(p, q)) and topology == base['topology']
        check(tag + '形はグレード0と同一', same, f'頂点 {len(pts)} 三角形 {tris}')
    check(tag + 'ファイルサイズ（上限）', size <= LIMITS['bytes_max'], f"{size} / {LIMITS['bytes_max']}")
    check(tag + 'ファイルサイズ（目標）', size <= LIMITS['bytes_target'], f"{size} / {LIMITS['bytes_target']}", warn=True)
    inlay = [m for m in gltf['materials'] if m['name'] == 'Rarity identification']
    color = inlay[0]['pbrMetallicRoughness']['baseColorFactor'][:3] if inlay else None
    check(tag + '識別インレイの色', bool(inlay) and all(abs(a - b) < .005 for a, b in zip(color, GRADE_COLORS[grade])), str(color))

# --- Blender への読み直し ---
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(out / f'{kind}_0.glb'))
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
check('[読み直し] メッシュオブジェクト1つ', len(meshes) == 1, f'{len(meshes)}')
if meshes:
    me = meshes[0].data
    me.calc_loop_triangles()
    mw = meshes[0].matrix_world
    co = [mw @ v.co for v in me.vertices]
    lo = [min(c[i] for c in co) for i in range(3)]
    hi = [max(c[i] for c in co) for i in range(3)]
    check('[読み直し] 三角形数が生成時と一致', len(me.loop_triangles) == report['triangles'], f"{len(me.loop_triangles)} / {report['triangles']}")
    check('[読み直し] 寸法が生成時と一致',
          all(abs(a - b) < 1e-4 for a, b in zip(lo + hi, report['bounds'][0] + report['bounds'][1])),
          f'{[round(v, 4) for v in lo]} .. {[round(v, 4) for v in hi]}')
    check('[読み直し] 材質名が生成時と一致', sorted(m.name.split('.')[0] for m in me.materials if m) == sorted(report['materials']),
          str([m.name for m in me.materials if m]))
    # 中央と周囲の計9点を左右から見て、色付き部品が装甲などに隠れていないか調べる。
    _, iy, iz = importlib.import_module(f'weapons.{kind}').SPEC['inlay']
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    for side, label in [(-1, '左'), (1, '右')]:
        visible = 0
        for dy in [-.004, 0, .004]:
            for dz in [-.004, 0, .004]:
                hit, _, _, face, obj, _ = bpy.context.scene.ray_cast(
                    dg, Vector((side, iy + dy, iz + dz)), Vector((-side, 0, 0)))
                if hit and obj.data.materials[obj.data.polygons[face].material_index].name.split('.')[0] == 'Rarity identification':
                    visible += 1
        check(f'[読み直し] {label}の識別インレイが見える', visible == 9, f'{visible}/9 点')

result = dict(kind=kind, passed=not fails, failures=fails, warnings=warns, limits=LIMITS, checks=checks)
(out / 'check.json').write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding='utf8')
for c in checks:
    print(('OK  ' if c['ok'] else 'NG  ') + c['name'] + ' — ' + c['detail'])
print('WEAPON_CHECK', 'PASS' if not fails else 'FAIL', f'{len(checks)} checks, {len(fails)} fail, {len(warns)} warn')
if fails:
    sys.exit(1)
