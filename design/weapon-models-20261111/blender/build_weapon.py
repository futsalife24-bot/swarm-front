"""1丁を生成する入口。
blender --background --python-exit-code 1 --python build_weapon.py -- <kind>
<kind> は src/shared/defs.ts の武器ID（例: laser）。weapons/<kind>.py を読む。
"""
import sys, importlib
from pathlib import Path

sys.dont_write_bytecode = True  # __pycache__ を作らない
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
if len(argv) != 1:
    raise SystemExit('usage: build_weapon.py -- <kind>')
import weapon_kit

mod = importlib.import_module(f'weapons.{argv[0]}')
assert mod.SPEC['kind'] == argv[0], 'SPEC.kind とファイル名を一致させる'
kit = weapon_kit.Kit(mod.SPEC)
mod.build(kit)
kit.finalize()
