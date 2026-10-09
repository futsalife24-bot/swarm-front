"""Build a focused re-audit ZIP from the previous reviewed package and current commit."""
from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED
import hashlib,json,subprocess,sys
root=Path.cwd(); prior=Path(sys.argv[1]); out=Path(sys.argv[2])
def git(*args): return subprocess.check_output(['git',*args],cwd=root)
head=git('rev-parse','HEAD').decode().strip(); base='de67860cfae978f3ee0bbd6784fc33a38ce68686'
files={}
with ZipFile(prior) as z:
 for name in z.namelist():
  if name in ['audit-manifest.json','implementation.diff']:continue
  p=(root/name).resolve()
  if root.resolve() not in p.parents: raise ValueError(name)
  files[name]=p.read_bytes() if p.is_file() else z.read(name)
for name in ['public/assets/characters/standard_trooper_v10.glb','AGENTS.md','PROJECT_TEAM.md','src/client/front-app.ts','src/client/soldier-live-review.ts','front-live-review.html','scripts/summarize-soldier-live.py','scripts/check-soldier-upper-aim.mjs','scripts/export-initial-soldier.mjs','scripts/render-soldier-generations.py','src/shared/state-wire.ts','tests/state-wire.test.ts','tests/soldier-accent-slot.test.ts','vitest.config.ts','soldier-integration-review.html','src/client/soldier-integration-review.ts','src/client/battle-loading.ts','vite.soldier-review.config.ts','scripts/summarize-soldier-capture.py','scripts/package-soldier-reaudit.py']:
 files[name]=(root/name).read_bytes()
for p in (root/'evidence/soldier-motion-20261009').rglob('*'):
 if p.is_file():files[p.relative_to(root).as_posix()]=p.read_bytes()
for name in ['soldier-accent-tests.log','soldier-accent-build.log','soldier-integration-build.log','soldier-live-build.log']:
 files['self-checks/'+name]=(root/name).read_bytes()
files['implementation.diff']=git('diff',base,head,'--','src','tests','vitest.config.ts','soldier-integration-review.html','front-live-review.html','vite.soldier-review.config.ts','scripts/summarize-soldier-capture.py','scripts/summarize-soldier-live.py')
manifest={'head':head,'base':base,'pr':'https://github.com/futsalife24-bot/swarm-front/pull/154','scope':'残存P2-01へ通常ソロ・通常敵あり・Controls自動入力の録画と同じ姿勢の手元拡大を追加。低フレームレートを保持し実時間性能は未検証。詳細はLIVE-SOLO.md。3武器の固定入力証拠も保持。旧監査の合格を意味しない。','files':[{'path':n,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()} for n,b in sorted(files.items())]}
files['audit-manifest.json']=json.dumps(manifest,ensure_ascii=False,indent=2).encode()
with ZipFile(out,'w',ZIP_DEFLATED,compresslevel=6) as z:
 for n,b in sorted(files.items()):z.writestr(n,b)
print(json.dumps({'head':head,'files':len(files),'bytes':out.stat().st_size,'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'zip':str(out)},ensure_ascii=False))
