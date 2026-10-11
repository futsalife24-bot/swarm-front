"""PR163照準中心・弾形状の監査資料をcommitから作る。秘密・依存キャッシュは対象外。"""
from pathlib import Path
import hashlib, json, posixpath, re, subprocess, zipfile
base = '9f7f9d592ba021054c0eda28e013c38316b4e0d0'
head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip()
changed = subprocess.check_output(['git','diff','--name-only',base,head],text=True).splitlines()
tracked = set(subprocess.check_output(['git','ls-tree','-r','--name-only',head],text=True).splitlines())
def content(path, ref=head): return subprocess.check_output(['git','show',f'{ref}:{path}'])
files = set(p for p in changed if p.startswith(('src/','tests/','scripts/','docs/evidence/pr163-20261011/')))
files.update(['docs/PR163-AUDIT-RELEASE.md','docs/STATE.md','AGENTS.md','docs/WORKFLOW.md','docs/skills/swarm-front-audit-release/SKILL.md','package.json','package-lock.json','tsconfig.json','tsconfig.worker.json','vite.config.ts','vitest.front.config.ts','vitest.save.config.ts','vitest.front-integration.config.ts','wrangler.production.jsonc','server/worker.ts','src/client/input.ts','src/shared/front-combat.ts','tests/front-network.integration.ts'])
files.update(['tests/aim.test.ts','tests/render.test.ts','tests/maps.test.ts','tests/stages.test.ts','tests/weapon-stat-marks.test.ts','e2e/front-hud.spec.ts','e2e/training-scope.spec.ts','playwright.config.ts','vitest.config.ts','src/client/render.ts','src/client/combat-effects.ts','src/style.css'])
queue=list(files)
while queue:
    p=queue.pop()
    if not p.endswith(('.ts','.css','.mjs')): continue
    text=content(p).decode('utf-8-sig')
    for rel in re.findall(r'(?:from\s*|import\s*\(?\s*)[\"\'](\.[^\"\']+)',text):
        path=posixpath.normpath(posixpath.join(posixpath.dirname(p),rel))
        for candidate in [path,path+'.ts',path+'/index.ts']:
            if candidate in tracked and candidate not in files:
                files.add(candidate);queue.append(candidate);break
payload={p:content(p) for p in sorted(files)}
payload['DIFF.patch']=subprocess.check_output(['git','diff','--binary',base,head,'--','src','tests','scripts'])
payload['TARGET.json']=json.dumps({'base':base,'target':head,'implementation':'3bd6ed51ea1ef8bcc41cc416d330bfe4b461bfa9','scope':'照準の描画中心同期・弾形状。既存5ファイル失敗と依存high5件を公開可否判断へ開示。','limits':'実Android/人の難度/長時間GPU未確認。人工HUDと実Renderer射撃検証は物理実機ではない。'},ensure_ascii=False,indent=2).encode()
manifest=[{'path':p,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()} for p,b in sorted(payload.items())]
payload['MANIFEST.json']=json.dumps(manifest,ensure_ascii=False,indent=2).encode()
out=Path('dist-validation/pr163');out.mkdir(parents=True,exist_ok=True)
archive=out/'pr163-audit.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
    for p,b in payload.items():z.writestr(p,b)
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    for entry in manifest: assert hashlib.sha256(z.read(entry['path'])).hexdigest()==entry['sha256']
result={'base':base,'target':head,'files':len(payload),'bytes':archive.stat().st_size,'sha256':hashlib.sha256(archive.read_bytes()).hexdigest()}
(out/'package-result.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps(result))
