"""製品検査が隠れたインレイと形状差を検出できるか、隔離した負例で確認する。"""
import argparse
import json
import shutil
import struct
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DESIGN = ROOT / 'design' / 'weapon-models-20261111'


def fixture(parent, name):
    target = parent / name
    (target / 'blender' / 'weapons').mkdir(parents=True)
    (target / 'out' / 'kick').mkdir(parents=True)
    (target / 'source').mkdir()
    for name in ('build_weapon.py', 'check_weapon.py', 'weapon_kit.py'):
        shutil.copy2(DESIGN / 'blender' / name, target / 'blender' / name)
    shutil.copy2(DESIGN / 'blender' / 'weapons' / 'kick.py', target / 'blender' / 'weapons' / 'kick.py')
    return target


def run(blender, script, kind='kick'):
    return subprocess.run([str(blender), '--background', '--python-exit-code', '1', '--python',
                           str(script), '--', kind], cwd=ROOT, capture_output=True,
                          text=True, encoding='utf8', errors='replace')


def inspect_failure(blender, target, expected):
    proc = run(blender, target / 'blender' / 'check_weapon.py')
    result_path = target / 'out' / 'kick' / 'check.json'
    if proc.returncode == 0 or not result_path.exists():
        raise RuntimeError(f'負例が不合格にならないか、検査を実行できません: {target.name}\n{proc.stdout[-2000:]}\n{proc.stderr[-1000:]}')
    result = json.loads(result_path.read_text(encoding='utf8'))
    failures = result['failures']
    if result['passed'] or len(failures) != len(expected) or any(
        not any(label in failure for failure in failures) for label in expected
    ):
        raise RuntimeError(f'期待と異なる不合格: {target.name}: {failures}')
    return failures


def mutate_one_triangle(path):
    data = bytearray(path.read_bytes())
    jlen = struct.unpack_from('<I', data, 12)[0]
    gltf = json.loads(data[20:20 + jlen])
    primitive = gltf['meshes'][0]['primitives'][0]
    acc = gltf['accessors'][primitive['indices']]
    view = gltf['bufferViews'][acc['bufferView']]
    fmt = {5121: '<B', 5123: '<H', 5125: '<I'}[acc['componentType']]
    pos = 20 + jlen + 8 + view.get('byteOffset', 0) + acc.get('byteOffset', 0)
    original = struct.unpack_from(fmt, data, pos)[0]
    vertex_count = gltf['accessors'][primitive['attributes']['POSITION']]['count']
    if vertex_count < 2:
        raise RuntimeError('三角形の負例を用意できません')
    struct.pack_into(fmt, data, pos, (original + 1) % vertex_count)
    path.write_bytes(data)


def main():
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf8')
    parser = argparse.ArgumentParser()
    parser.add_argument('--blender', default=r'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe')
    args = parser.parse_args()
    scratch_root = ROOT / 'dist-validation' / 'weapon-inspection-regression'
    scratch_root.mkdir(parents=True, exist_ok=True)
    scratch = Path(tempfile.mkdtemp(prefix='case-', dir=scratch_root))

    hidden = fixture(scratch, 'hidden-inlay')
    weapon = hidden / 'blender' / 'weapons' / 'kick.py'
    text = weapon.read_text(encoding='utf8')
    before, after = 'inlay=(.033,.15,.077)', 'inlay=(.035,-.055,.052)'
    if text.count(before) != 1:
        raise RuntimeError('現行KB-6のインレイ位置を特定できません')
    weapon.write_text(text.replace(before, after), encoding='utf8')
    build = run(args.blender, hidden / 'blender' / 'build_weapon.py')
    if build.returncode:
        raise RuntimeError(f'隠れたインレイの負例を生成できません\n{build.stdout[-2000:]}\n{build.stderr[-1000:]}')
    hidden_failures = inspect_failure(args.blender, hidden, ['左の識別インレイ', '右の識別インレイ'])

    changed = fixture(scratch, 'changed-topology')
    for path in (DESIGN / 'out' / 'kick').glob('*.glb'):
        shutil.copy2(path, changed / 'out' / 'kick' / path.name)
    shutil.copy2(DESIGN / 'out' / 'kick' / 'report.json', changed / 'out' / 'kick' / 'report.json')
    mutate_one_triangle(changed / 'out' / 'kick' / 'kick_1.glb')
    shape_failures = inspect_failure(args.blender, changed, ['形はグレード0と同一'])
    print('PASS 隠れた左右インレイと、頂点・寸法が同じ面接続の変更を検出')
    print('隔離結果:', scratch)
    print('検出内容:', hidden_failures, shape_failures)


if __name__ == '__main__':
    main()
