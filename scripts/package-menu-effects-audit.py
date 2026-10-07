"""Snapshot committed audit sources and UI evidence, excluding secrets/caches."""
from pathlib import Path
import subprocess, zipfile, hashlib, json

def git(*args):
    return subprocess.check_output(['git', *args])

head = git('rev-parse', 'HEAD').decode().strip()
base = '800410d501fd5ac3610e19b6087976088cbca1d8'
output = Path('dist-validation/menu-effects-audit-' + head[:7] + '.zip')
selected = ['src', 'server', 'tests', 'package.json', 'package-lock.json',
            'tsconfig.json', 'tsconfig.worker.json', 'vite.config.ts',
            'vitest.save.config.ts', 'wrangler.production.jsonc',
            'index.html', 'front.html', 'AGENTS.md', 'docs/WORKFLOW.md',
            'docs/WEAPON-ROW.md', 'docs/MENU-EFFECTS.md', 'docs/STATE.md',
            'scripts/check-menu-effects.mjs', 'scripts/check-menu-effects-network.mjs',
            'scripts/check-gear-ui-baseline.mjs', 'scripts/check-growth-accessory-ui.mjs',
            'scripts/package-menu-effects-audit.py', 'docs/evidence/menu-effects-20261007']
subprocess.check_call(['git', 'archive', '--format=zip', '--output=' + str(output), head, *selected])
with zipfile.ZipFile(output, 'a', zipfile.ZIP_DEFLATED) as z:
    manifest = {name: hashlib.sha256(z.read(name)).hexdigest() for name in z.namelist() if not name.endswith('/')}
    z.writestr('changes.patch', git('diff', base, head))
    z.writestr('SOURCE-MANIFEST.json', json.dumps(manifest, ensure_ascii=False, indent=2))
    z.writestr('AUDIT.txt', f'BASE {base}\nHEAD {head}\n'
                'Swarm Frontのメニュー12場面の操作演出。対象差分・必要ソースと依存・UI証拠を同梱。\n'
                'ソースはgit archiveによる対象HEADの完全なblob。manifestはそのbyteのSHA256。\n'
                '変更されたバイナリ素材はなく、既存モデル・音声自体の監査は対象外。\n'
                '型、保存/装備/経済31単体、横画面武器一覧8表示、育成アクセサリ3サイズ、\n'
                '通常/動きを減らす設定の実UI、ローカル実通信の協力と週間受取を確認。\n'
                '結果と実際の限界はdocs/MENU-EFFECTS.mdとdocs/evidence/menu-effects-20261007を参照。\n'
                '秘密、.env、.dev.vars、ブラウザ認証データ、対象外個人情報は含めない。\n'
                '必須指摘(P0/P1/P2)、任意指摘、合格/要修正、対象SHAと検証限界を明記してください。\n')
print(json.dumps({'zip': str(output.resolve()), 'head': head, 'sha256': hashlib.sha256(output.read_bytes()).hexdigest(), 'files': len(manifest)}, ensure_ascii=False))
