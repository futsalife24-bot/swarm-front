"""Package the exact committed HARROW source, assets and local review evidence."""
import hashlib, json, subprocess, zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = Path(subprocess.check_output(['git', 'rev-parse', '--show-toplevel'], text=True).strip())
HEAD = subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip()
BASE = '85ed091cb5642036790bf0aedc8fc369386d7430'
output = HERE / 'review' / 'harrow-v11-audit.zip'
files = set()
for folder in ('src', 'server'):
    files.update(p for p in (ROOT / folder).rglob('*') if p.is_file() and p.suffix in ('.ts', '.css'))
for name in ('package.json', 'package-lock.json', 'tsconfig.json', 'tsconfig.worker.json',
             'vite.config.ts', 'wrangler.production.jsonc', 'docs/HARROW-V11-AUDIT.md',
             'docs/STATE.md', 'docs/STRUCTURE-ANOMALY-v2.md', 'docs/art/ANOMALY_TASK_TEMPLATE.md',
             'public/assets/enemies/harrow_motion_v10.glb', 'public/assets/enemies/harrow_motion_v11.glb',
             'scripts/harrow-preview.ts', 'scripts/harrow-preview.html'):
    files.add(ROOT / name)
for name in ('harrow', 'harrow-model', 'harrow-effects', 'enemy-report-motion', 'structure-motion', 'enemy-size'):
    files.add(ROOT / 'tests' / (name + '.test.ts'))
for name in ('harrow.blend', 'build_candidate.py', 'animation_contract.py', 'production-baseline.json',
             'build-report.json', 'rig-metadata.json', 'verify_asset.mjs', 'render_review.py',
             'BUILD.md', 'INTEGRATION-CONTRACT.md', 'references/user-design.jpg', 'models/production-inventory.fbx'):
    files.add(HERE / name)
files.update((HERE / 'models' / 'normalized-returns').glob('*.fbx'))
files.update((HERE / 'models' / 'textured').rglob('*.jpg'))
files.update((HERE / 'review').glob('final-Rest-*.png'))
for pattern in ('game-spin*', 'browser-threat-front.png', 'asset-verification.json', 'final-model-tests.log',
                'game-tests.log', 'report-tests.log', 'build.log', 'worker-dry-run.log'):
    files.update((HERE / 'review').glob(pattern))
for name in ('actual-mesh-check.json', 'pose-smoke.json', 'transition-check.json'):
    files.add(HERE / 'review' / 'animation-trial' / name)
manifest = {'head': HEAD, 'base': BASE, 'files': []}
with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
    for p in sorted(files):
        data = p.read_bytes()
        name = p.relative_to(ROOT).as_posix()
        archive.writestr(name, data)
        manifest['files'].append({'path': name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
    diff = subprocess.check_output(['git', 'diff', BASE, HEAD, '--', 'src', 'tests', 'scripts/harrow-preview.ts'])
    archive.writestr('AUDIT-CODE-DIFF.patch', diff)
    archive.writestr('AUDIT-MANIFEST.json', json.dumps(manifest, ensure_ascii=False, indent=2))
with zipfile.ZipFile(output) as archive:
    assert archive.testzip() is None
result = {'path': str(output), 'head': HEAD, 'files': len(manifest['files']),
          'bytes': output.stat().st_size, 'sha256': hashlib.sha256(output.read_bytes()).hexdigest()}
(HERE / 'review' / 'audit-package.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
print(json.dumps(result))
