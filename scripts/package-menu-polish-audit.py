"""Exact PR142 implementation blobs plus separately labelled Windows evidence."""
from pathlib import Path
import subprocess, zipfile, hashlib, json

def git(*args):
    return subprocess.check_output(['git', *args])

base = '1026fccaa509723c74e1b85bbdde934afe6d82f6'
implementation = '7ef32289a4662afa940c1c7accbfc9f42bb179e6'
head = git('rev-parse', 'HEAD').decode().strip()
output = Path('dist-validation/menu-polish-audit-' + head[:7] + '.zip')
selected = ['src', 'server', 'tests', 'package.json', 'package-lock.json',
            'tsconfig.json', 'tsconfig.worker.json', 'vite.config.ts',
            'vitest.config.ts', 'vitest.save.config.ts', 'vitest.front.config.ts',
            'vitest.progression.config.ts', 'wrangler.production.jsonc',
            'index.html', 'front.html', 'AGENTS.md', 'docs/WORKFLOW.md',
            'docs/WEAPON-ROW.md', 'docs/MENU-EFFECTS.md',
            'scripts/check-menu-effects.mjs', 'scripts/check-menu-effects-network.mjs',
            'scripts/check-menu-effects-rapid.mjs']
subprocess.check_call(['git','archive','--format=zip','--output='+str(output),implementation,*selected])
with zipfile.ZipFile(output, 'a', zipfile.ZIP_DEFLATED) as z:
    z.writestr('changes-1026fcc-to-7ef3228.patch',git('diff','--binary',base,implementation))
    z.writestr('supplement-after-implementation.patch',git('diff',implementation,head,'--','scripts','docs/MENU-POLISH.md','docs/MENU-POLISH-WINDOWS.md'))
    paths = git('ls-tree','-r','--name-only',head,'docs/MENU-POLISH.md','docs/MENU-POLISH-WINDOWS.md',
                'docs/evidence/menu-polish-20261007','docs/evidence/menu-polish-windows-20261007',
                'scripts/check-menu-polish-motion.mjs','scripts/check-gear-ui-baseline.mjs',
                'scripts/package-menu-polish-audit.py').decode().splitlines()
    for path in paths:
        z.writestr(path,git('show',head+':'+path))
    z.writestr('windows-scripts/check-menu-effects-network.mjs',git('show',head+':scripts/check-menu-effects-network.mjs'))
    for path in sorted(Path('dist-validation/menu-polish-motion').glob('*.mp4')):
        z.writestr('windows-realtime-video/'+path.name,path.read_bytes())
    manifest = {name: hashlib.sha256(z.read(name)).hexdigest() for name in z.namelist() if not name.endswith('/')}
    z.writestr('SOURCE-MANIFEST.json',json.dumps(manifest,ensure_ascii=False,indent=2))
    z.writestr('AUDIT.txt',f'BASE {base}\nIMPLEMENTATION {implementation}\nEVIDENCE_HEAD {head}\n'
      'Swarm Front PR142: タイトル・メニュー演出の品質改善。\n'
      'src/server/tests等はIMPLEMENTATIONのgit archive、Windows追加スクリプト/記録はEVIDENCE_HEADのblob。\n'
      '製品ソースの追記差分は別途確認。manifestは格納した全対象ファイルのSHA256。\n'
      '動画はWindows Chromeの実描画を記録し、アニメーションを停止/seekしていない。\n'
      '変更のない全GLBや音声は同梱せず、見え方の全数確認は主張しない。\n'
      '秘密情報/.env/.dev.vars/認証値/依存キャッシュ/他プロジェクト情報は含めない。\n'
      '対象SHA、合格/要修正、必須P0/P1/P2・箇所と再現条件、任意指摘、検証限界を日本語で回答してください。\n')
print(json.dumps({'zip':str(output.resolve()),'implementation':implementation,'head':head,
                  'sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'files':len(manifest)},ensure_ascii=False))
