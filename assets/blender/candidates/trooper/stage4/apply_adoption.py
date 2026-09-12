"""Apply already-reviewed candidate after the four-stage goal passes."""
from pathlib import Path
import hashlib,json,shutil
Q=Path(__file__).resolve().parent;GAME=Q.parents[4]
assert (Q/'audit-final-pass.md').exists(),'Wait for actual independent final PASS'
src=GAME/'src/client/standard-trooper.ts';expected=json.loads((Q/'runtime-before-hash.json').read_text())['sha256']
assert hashlib.sha256(src.read_bytes()).hexdigest()==expected,'Concurrent runtime changes: review before applying'
out=GAME/'dist-validation/trooper-v5';before=out/'before';before.mkdir(parents=True,exist_ok=True)
for p in [src,GAME/'src/client/changelog.ts',GAME/'docs/STATE.md']:
 target=before/p.name;assert not target.exists(),'Do not overwrite the pre-adoption backup';shutil.copy2(p,target)
src.write_text((Q/'standard-trooper-adopted.ts.txt').read_text(encoding='utf-8'),encoding='utf-8')
public=GAME/'public/assets/characters';target=public/'standard_trooper_v5.glb';assert not target.exists();shutil.copy2(Q/'trooper_stage4_candidate.glb',target)
manifest=json.loads((Q/'motion-manifest.json').read_text());contract={'version':5,'rig_version':'SF_Humanoid_3','height_m':1.866,'up':'+Y','forward':'-Z','root_motion':False,'bones':57,'skin_contract':'Use the v5 GLB inverse bind matrices. v4 names are preserved but 32 stage2 and two approved stage3 bind refinements are included. Do not bind v4 clothing blindly.','clips':{x['name'].removeprefix('Trial_'):x['duration'] for x in manifest['clips']},'authored_clip_prefix':'Trial_','switch':{'source_duration':1,'runtime_duration':.5,'holster_normalized':.45,'draw_normalized':.6},'source_blend':'trooper_stage4_candidate.blend','triangles':manifest['triangles']}
(public/'standard_trooper_v5.json').write_text(json.dumps(contract,indent=2),encoding='utf-8')
changelog=GAME/'src/client/changelog.ts';text=changelog.read_text(encoding='utf-8');needle='export const CHANGELOG: Release[] = [';assert text.count(needle)==1
entry='\n  {\n    date: "2026-09-11",\n    items: [\n      "兵士の首・肩・腰・腕・脚を作り直し、戦闘服と防具が自然につながる体型へ調整しました。",\n      "武器の持ち替えと構えを更新し、ライフル・ショットガン・ロケットの装填動作を追加しました。",\n    ],\n  },'
changelog.write_text(text.replace(needle,needle+entry),encoding='utf-8')
(out/'adoption-files.json').write_text(json.dumps({'files':['src/client/standard-trooper.ts','src/client/changelog.ts','public/assets/characters/standard_trooper_v5.glb','public/assets/characters/standard_trooper_v5.json'],'candidateGlbSHA256':hashlib.sha256(target.read_bytes()).hexdigest(),'previousRuntimeSHA256':expected},indent=2))
print('ADOPTION APPLIED; original v4 blend/scripts/GLB remain intact')
