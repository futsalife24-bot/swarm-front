from pathlib import Path
import subprocess, zipfile, io, hashlib, json

root = Path(__file__).resolve().parents[1]
out = root / 'dist-validation/anomaly-voices-20261013'
out.mkdir(parents=True, exist_ok=True)
head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip()
initial = 'ea2c94799827042a7980fdaea81401f355d1caa5'
base = '27208f1de0d491bcfbba191a75c861bed0c29418'
paths = ['src', 'server', 'tests', 'package.json', 'package-lock.json',
         'tsconfig.json', 'tsconfig.worker.json', 'vite.config.ts', 'vitest.config.ts',
         'wrangler.production.jsonc', 'scripts/generate-anomaly-voices.py',
         'scripts/anomaly-anticipation-preview.html', 'scripts/anomaly-anticipation-preview.ts',
         'scripts/tsconfig.anomaly-anticipation.json', 'public/anomaly-voices.html',
         'public/assets/audio/anomaly-voice-v1', 'docs/ANOMALY-ANTICIPATION-VOICES.md',
         'docs/STRUCTURE-ANOMALY-v2.md', 'docs/evidence/anomaly-anticipation-voices-20261013']
models = {'hound':'v1','leaper':'v3','pleat':'v5','prism':'v1','ray':'v1',
          'foundry_zero':'v1','calyx':'v1','harrow':'v14'}
paths += [f'public/assets/enemies/{n}_motion_{v}.glb' for n,v in models.items()]
archive = subprocess.check_output(['git','archive','--format=zip',head,'--',*paths],cwd=root)
entries = {}
with zipfile.ZipFile(io.BytesIO(archive)) as source:
    for info in source.infolist():
        if not info.is_dir(): entries['source/'+info.filename] = source.read(info.filename)
entries['initial-to-final.patch'] = subprocess.check_output(['git','diff','--binary',initial,head],cwd=root)
entries['base-to-final.patch'] = subprocess.check_output(['git','diff','--binary',base,head],cwd=root)
entries['changed-files.txt'] = subprocess.check_output(['git','diff','--stat',initial,head],cwd=root)
for name in ['build-final.log','worker-build-final.log','qa-build-seek.log','changelog-recovery.log']:
    p=out/name
    if p.exists(): entries['validation/'+name]=p.read_bytes()
entries['README.txt'] = f'''全ANOMALY 予備動作・赤予告・固有ボイス PR177 再監査資料
PR: https://github.com/futsalife24-bot/swarm-front/pull/177
base: {base}
初回監査: {initial}
今回対象の完全SHA: {head}
source/ は今回対象SHAからgit archiveしたソース、現行8モデル、16声、検証記録。
initial-to-final.patch は初回監査からの修正。base-to-final.patch はmainからの全差分。
初回監査の必須P2 5件の対応と追加のUI確認結果はsource/docs/ANOMALY-ANTICIPATION-VOICES.md後半。
初回監査回答はsource/docs/evidence/anomaly-anticipation-voices-20261013/audit-initial.md。
記録の旧未送信・未確認・失敗は履歴であり、最新結果/限界を区別してください。
声は独自の手続き合成（外部AI生成ではなく費用0）。8 GLB/16 WAVの原本は初回と不変。
構え→赤範囲→攻撃、弾道/壁/寿命一致、LEAPERの移動跳躍割り込み抑止、連結FOUNDRYレーザー範囲、音声中断時のノード停止を重点再監査してください。
自己検証は独立監査を代替しません。未公開・main未反映です。
最終判定・完全SHA・必須P0/P1/P2・任意指摘・検証限界を明記してください。
'''.encode('utf-8')
assert not any('private-draft' in n or '/.env' in n or '/node_modules/' in n for n in entries)
manifest={n:hashlib.sha256(data).hexdigest() for n,data in entries.items()}
entries['sha256.json']=json.dumps(manifest,ensure_ascii=False,indent=2).encode('utf-8')
dest=out/f'anomaly-reaudit-{head[:7]}.zip'
with zipfile.ZipFile(dest,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    for n,data in entries.items(): z.writestr(n,data)
with zipfile.ZipFile(dest) as z:
    assert z.testzip() is None
    assert all(hashlib.sha256(z.read(n)).hexdigest()==h for n,h in manifest.items())
result={'head':head,'file':str(dest),'entries':len(entries),'bytes':dest.stat().st_size,'sha256':hashlib.sha256(dest.read_bytes()).hexdigest()}
(out/'reaudit-package.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(result,ensure_ascii=False))
