"""PR159の監査資料をcommitの実物から作成する。秘密・依存キャッシュは含めない。"""
from pathlib import Path
import subprocess, hashlib, json, re, zipfile, posixpath
base = 'f1298bb1632ce3844023a822fe495db6445227d1'
head = subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
changed = subprocess.check_output(['git','diff','--name-only',base,head],text=True).splitlines()
tracked = set(subprocess.check_output(['git','ls-tree','-r','--name-only',head],text=True).splitlines())
def content(path, ref=head): return subprocess.check_output(['git','show',f'{ref}:{path}'])
files = set(p for p in changed if p.startswith(('src/','tests/','scripts/','docs/evidence/fusion-roll-20261010/')))
files.update(['docs/FUSION-ROLL-POLISH.md','docs/STATE.md','AGENTS.md','docs/WORKFLOW.md','docs/skills/swarm-front-audit-release/SKILL.md','package.json','package-lock.json','tsconfig.json','tsconfig.worker.json','vite.config.ts','vitest.front.config.ts','vitest.save.config.ts','wrangler.production.jsonc','public/assets/characters/swarm-soldier.glb','src/client/render.ts','src/shared/front-run.ts','src/client/front-network.ts','server/worker.ts'])
queue=list(files)
while queue:
 p=queue.pop()
 if not p.endswith(('.ts','.css','.mjs')): continue
 text=content(p).decode('utf-8-sig')
 for rel in re.findall(r'(?:from\s*|import\s*\(?\s*)[\"\'](\.[^\"\']+)', text):
  path=posixpath.normpath(posixpath.join(posixpath.dirname(p),rel))
  for candidate in [path,path+'.ts',path+'/index.ts']:
   if candidate in tracked and candidate not in files:
    files.add(candidate);queue.append(candidate);break
out=Path('dist-validation/fusion-roll');out.mkdir(parents=True,exist_ok=True)
payload={p:content(p) for p in sorted(files)}
payload['before/src/client/standard-trooper.ts']=content('src/client/standard-trooper.ts',base)
payload['DIFF.patch']=subprocess.check_output(['git','diff','--binary',base,head,'--','src','tests','scripts'])
payload['TARGET.json']=json.dumps({'base':base,'target':head,'implementation':'3481d5469ecb6deaf6eb211dde721825473f22af','pr':'https://github.com/futsalife24-bot/swarm-front/pull/159','audit':'未送信・未合格','scope':'融合条件・発見記録・命名・回避描画','limits':'実機スマホ・長時間GPU未確認。回避fixtureはHMR consoleエラーあり。詳細文書参照。'},ensure_ascii=False,indent=2).encode()
manifest=[{'path':p,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()} for p,b in sorted(payload.items())]
payload['MANIFEST.json']=json.dumps(manifest,ensure_ascii=False,indent=2).encode()
with zipfile.ZipFile(out/'fusion-roll-audit.zip','w',zipfile.ZIP_DEFLATED) as z:
 for p,b in payload.items():z.writestr(p,b)
result={'target':head,'files':len(payload),'zipBytes':(out/'fusion-roll-audit.zip').stat().st_size,'sha256':hashlib.sha256((out/'fusion-roll-audit.zip').read_bytes()).hexdigest()}
(out/'package-result.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps(result))
