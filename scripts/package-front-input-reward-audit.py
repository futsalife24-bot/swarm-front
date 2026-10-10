"""入力中断・戦果再試行の監査資料をcommitから作る。秘密・依存キャッシュは対象外。"""
from pathlib import Path
import hashlib, json, posixpath, re, subprocess, zipfile
base = 'a478059206c4b6d9bff4c238f4ff4bd5fb9e395e'
head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip()
changed = subprocess.check_output(['git','diff','--name-only',base,head],text=True).splitlines()
tracked = set(subprocess.check_output(['git','ls-tree','-r','--name-only',head],text=True).splitlines())
def content(path, ref=head): return subprocess.check_output(['git','show',f'{ref}:{path}'])
files = set(p for p in changed if p.startswith(('src/','tests/','scripts/','docs/evidence/front-input-reward-20261011/')))
files.update(['docs/FRONT-INPUT-REWARD-FIX.md','docs/STATE.md','AGENTS.md','docs/WORKFLOW.md','docs/skills/swarm-front-audit-release/SKILL.md','package.json','package-lock.json','tsconfig.json','tsconfig.worker.json','vite.config.ts','vitest.front.config.ts','vitest.save.config.ts','vitest.front-integration.config.ts','wrangler.production.jsonc','server/worker.ts','src/client/input.ts','src/shared/front-combat.ts','tests/front-network.integration.ts'])
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
payload['TARGET.json']=json.dumps({'base':base,'target':head,'implementation':'834c2b21db6608d2b41220d7bbfbe61d78cc76c6','scope':'未送信入力の中断時破棄、報酬保存再試行表示。バランス値/保存形式/付与量不変。','claude':'https://claude.ai/chat/8d71c544-a8e3-49b2-bec5-f7567c119072','limits':'通信混雑はbuffer圧だけ注入。実機スマホ/自然高遅延/長時間/実タブ非表示は未確認。実戦結果UIのコインは0、非ゼロ額は単体で検証。'},ensure_ascii=False,indent=2).encode()
manifest=[{'path':p,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()} for p,b in sorted(payload.items())]
payload['MANIFEST.json']=json.dumps(manifest,ensure_ascii=False,indent=2).encode()
out=Path('dist-validation/claude-balance');out.mkdir(parents=True,exist_ok=True)
archive=out/'front-input-reward-audit.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
    for p,b in payload.items():z.writestr(p,b)
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    for entry in manifest: assert hashlib.sha256(z.read(entry['path'])).hexdigest()==entry['sha256']
result={'base':base,'target':head,'files':len(payload),'bytes':archive.stat().st_size,'sha256':hashlib.sha256(archive.read_bytes()).hexdigest()}
(out/'package-result.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps(result))
