import shutil,json,hashlib
from pathlib import Path
p=Path(__file__).resolve().parent
repo=Path('C:/Users/futsa/Documents/Codex/2026-10-09/swarm-soldier-motion')
base=repo/'assets/blender/source/swarm_soldier_20261009'
dest=base/p.name;dest.mkdir(parents=True,exist_ok=True)
names=['inspect-source.py','source-reference.py','retarget-ual.py','retarget-combat.py','polish-motion.py','check-motion.py','inspect-export.py','render-motion-video.py','reference-plan.json','retarget-report.json','polish-report.json','export-check.json','motion-check.json','video-segments.json','walk-jog-sprint.mp4','soldier-polished-candidate.blend','soldier-motion-candidate.glb']
names+=['soldier-rig-input.blend','hand-rig-repair.json','repair-hand-rig.py','verify-hand-rig.py','hand-rig-check.json','render-combat-check.py','player-accent.js','progress-20261009.md','grip-side-repaired.png','hand-rest-diagnostic.png']
names+=['export-game.py','check-game-export.py','game-export.json','game-contract-check.json','soldier-game.blend','swarm-soldier.glb','build-contact-sheet.py','save-work-package.py']
for n in names:shutil.copy2(p/n,dest/n)
for n in ['combat-render-check.json','combat-contact-sheet.png','player-1-cyan.png','player-2-orange.png','player-3-purple.png','player-4-lime.png','runtime-shotgun-reload.png']:
 if (p/n).exists():shutil.copy2(p/n,dest/n)
for n in ['ual-source.blend','game-trooper.glb','rifle.glb','shotgun.glb','rocket.glb','ual/Animation Library[Standard]/Godot/AnimationLibrary_Godot_Standard.glb','ual/Animation Library[Standard]/License.txt']:
 src=p/'source'/n
 if not src.exists():continue
 target=dest/'source'/n;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src,target)
# Store the sanitized user output. Raw kit donor intermediates stay local.
legacy=base/'soldier-rig-20261009/weighted.blend'
if legacy.exists():legacy.unlink()
kit=p.parent/'tools/charakuru-1.0.2/charakuru-1.0.2-2026-10-07T16-58-19-992Z/public/vendor'
(dest/'vendor').mkdir(exist_ok=True)
for n in ['three.module.js','GLTFLoader.js','OrbitControls.js','BufferGeometryUtils.js','THREE-LICENSE.txt']:shutil.copy2(kit/n,dest/'vendor'/n)
html=(p/'review.html').read_text(encoding='utf-8').replace('../tools/charakuru-1.0.2/charakuru-1.0.2-2026-10-07T16-58-19-992Z/public/vendor/','vendor/')
(dest/'review.html').write_text(html,encoding='utf-8')
# Match the repository's LF policy so manifest hashes survive a clean checkout.
for f in base.rglob('*'):
 if f.is_file() and f.suffix in ['.py','.json','.js','.html','.txt','.md']:
  text=f.read_text(encoding='utf-8').replace('\r\n','\n')
  if f.name=='License.txt':text=text.replace('CC0 1.0 Universal (CC0 1.0) \n','CC0 1.0 Universal (CC0 1.0)\n')
  if f.name=='three.module.js':text=text.replace('\t\t\t \tmaterial = getMaterial( data.material );','\t\t\t\tmaterial = getMaterial( data.material );')
  f.write_bytes(text.encode('utf-8'))
manifest={'status':'制作途中・ゲーム未反映','base':'de67860cfae978f3ee0bbd6784fc33a38ce68686','branch':'codex/soldier-motion-reference-20261009','workspace':str(p),'preview':'soldier-motion-20261009/review.html','rebuild':['Blender --background --disable-autoexec --python soldier-motion-20261009/retarget-ual.py','Blender --background --disable-autoexec --python soldier-motion-20261009/retarget-combat.py','Blender --background --disable-autoexec --python soldier-motion-20261009/polish-motion.py'],'notes':['Pythonのhttp.server等でこのフォルダーを127.0.0.1に配信し、previewを開く。','Quaternius元アクションを削除せず再生成。銃動作の比較元は既存ゲーム資産。','元のキット正本と既存ゲームブランチは上書きしていない。'],'files':{str(f.relative_to(base)).replace('\\','/'):hashlib.sha256(f.read_bytes()).hexdigest() for f in base.rglob('*') if f.is_file()}}
manifest['files'].pop('manifest.json',None)
manifest['notes']+=['4色シェーダーは実装済み。肩の橙・紫・ライムへの切替をChrome実描画で確認。実ゲームでの識別性は未検証。','入力Blendには兵士本人の頭・体・骨格のみ。元キットの隠し素体・サンプルは含めない。','修正スクリプトrepair-hand-rig.pyは元のローカル中間データ用。通常の再生成は保存済みsoldier-rig-input.blendから開始する。']
(base/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'files':len(manifest['files']),'bytes':sum(f.stat().st_size for f in base.rglob('*') if f.is_file()),'destination':str(base)},ensure_ascii=False))
