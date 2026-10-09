import shutil,json,hashlib
from pathlib import Path
p=Path(__file__).resolve().parent
repo=Path('C:/Users/futsa/Documents/Codex/2026-10-09/swarm-soldier-motion')
base=repo/'assets/blender/source/swarm_soldier_20261009'
dest=base/p.name;dest.mkdir(parents=True,exist_ok=True)
names=['inspect-source.py','source-reference.py','retarget-ual.py','retarget-combat.py','polish-motion.py','check-motion.py','inspect-export.py','render-motion-video.py','reference-plan.json','retarget-report.json','polish-report.json','export-check.json','motion-check.json','video-segments.json','walk-jog-sprint.mp4','soldier-polished-candidate.blend','soldier-motion-candidate.glb']
names+=['soldier-rig-input.blend','hand-rig-repair.json','repair-hand-rig.py','verify-hand-rig.py','hand-rig-check.json','render-combat-check.py','player-accent.js','progress-20261009.md','grip-side-repaired.png','hand-rest-diagnostic.png']
names+=['export-game.py','check-game-export.py','game-export.json','game-contract-check.json','soldier-game.blend','swarm-soldier.glb','build-contact-sheet.py','save-work-package.py']
names+=['check-body-ground.py','body-ground-before.json','body-ground-check.json','measure-stride.py','stride-samples.json','stride-fit.json','refine-ground.py','ground-refinement.json','render-ground-check.py','build-ground-sheet.py','ground-render-check.json','ground-contact-sheet.png']
names+=['check-export-timing.py','export-timing-check.json','inspect-imported-meshes.py']
names+=['refine-rocket-reload.py','inspect-reload-arm.py','reload-arm-inspection.json','rocket-reload-candidate.json','compare-reload-export.py','reload-export-difference.json','soldier-reload-candidate.blend','runtime-reload-refined-100.png','runtime-reload-refined-200.png','runtime-reload-actual-100.png','runtime-reload-actual-300.png']
names+=['soldier-grounded-down-candidate.blend','grounded-down-check.json','soldier-sling-motion-candidate.blend','animate-sling.py','sling-motion-candidate.json','probe-sling-motion.py','sling-motion-probe.json','probe-shoulder-roll.py','shoulder-roll-probe.json','candidate-decisions.json','weapon-ground-current.json','runtime-equipped-down.png','runtime-equipped-roll.png','runtime-sling-roll-010.png','runtime-sling-roll-015.png','runtime-sling-recovered.png','runtime-rocket-reload-current.png','runtime-grounded-down.png','arm-roll.py','armed-roll-check.json','soldier-armed-roll-candidate.blend','probe-equipped-contact.py','equipped-contact-probe.json','ground-equipped.py','equipped-contact-candidate.json','weapon-ground-armed.json','runtime-back-sling.png','runtime-armed-roll-middle.png','runtime-armed-roll-inverted.png']
if (p/'exported-ground-check.json').exists():names+=['exported-ground-check.json']
names+=['refine-switch-handoff.py','refine-switch-handoff-direct.py','inspect-switch-handoff.py','inspect-switch-path.py','compare-switch-export.py','switch-handoff-before.json','switch-handoff-candidate.json','switch-handoff-exported.json','switch-handoff-direct-exported.json','switch-path-inspection.json','switch-path-direct.json','switch-export-difference.json','soldier-switch-candidate.blend','switch-preview/swarm-soldier.glb','switch-preview/game-export.json','runtime-walk-reload-100.png']
names+=['runtime-switch-flank-0150.png','runtime-switch-flank-0383.png']
names+=['refine-switch-support.py','soldier-switch-support-candidate.blend','switch-support-candidate.json','switch-support-export-difference.json','switch-support-handoff-exported.json','check-back-body-runtime.py','back-body-runtime-check.json','runtime-switch-support-0383.png','runtime-switch-support-0483.png','runtime-switch-support-0600.png','runtime-switch-support-rear-0233.png']
names+=['search-back-mount.py','back-mount-search.json','back-mount-floor-search.json','back-depth-floor-probe.json','probe-back-pivot.py','back-pivot-feasibility.json','refine-back-mount.py','back-mount-candidate.json','soldier-back-mount-candidate.blend','back-mount-preview/swarm-soldier.glb','back-mount-preview/game-export.json']
names+=['back-mount-preview/game-contract-check.json','back-mount-weapon-ground.json','runtime-back-mount-idle.png','runtime-back-mount-roll-0150.png']
names+=['refine-roll-grips.py','soldier-roll-grips-candidate.blend','roll-grips-candidate.json','check-roll-grips-export.py','roll-grips-export-check.json','roll-grips-preview/swarm-soldier.glb','roll-grips-preview/game-export.json','roll-grips-preview/game-contract-check.json','roll-grip-Shotgun.json','roll-grip-Rocket.json','roll-grips-weapon-ground.json','roll-grips-rocket-0150.png','roll-grips-shotgun-0150.png','back-mount-close-candidate.json']
names+=['low-evade-mounts.json','author-low-evade.py','mount-low-evade.py','check-low-evade-export.py','low-evade-export-check.json','low-evade-candidate.json','soldier-low-evade-candidate.blend','soldier-low-evade-integrated.blend','soldier-low-evade-handoff.json','soldier-low-evade-integrated.json','low-evade-handoff-exported.json','low-evade-baseline.glb','low-evade-integrated-preview/swarm-soldier.glb','low-evade-integrated-preview/game-export.json','low-evade-integrated-preview/exported-ground-check.json','low-evade-back-body-check.json','low-evade-grip-Rifle.json','low-evade-grip-Shotgun.json','low-evade-grip-Rocket.json','runtime-low-evade-side.png','Crouch_Fwd_Loop-reference.png','probe-grounded-bank.py','grounded-bank-probe.json']
for n in names:
 (dest/n).parent.mkdir(parents=True,exist_ok=True)
 shutil.copy2(p/n,dest/n)
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
manifest={'status':'制作途中・ローカル描画へ接続済み。実プレイ・監査・公開は未完了','base':'de67860cfae978f3ee0bbd6784fc33a38ce68686','branch':'codex/soldier-motion-reference-20261009','workspace':str(p),'preview':'soldier-motion-20261009/review.html','rebuild':['Blender --background --disable-autoexec --python soldier-motion-20261009/retarget-ual.py','Blender --background --disable-autoexec --python soldier-motion-20261009/retarget-combat.py','Blender --background --disable-autoexec --python soldier-motion-20261009/polish-motion.py'],'notes':['Pythonのhttp.server等でこのフォルダーを127.0.0.1に配信し、previewを開く。','Quaternius元アクションを削除せず再生成。銃動作の比較元は既存ゲーム資産。','元のキット正本と既存ゲームブランチは上書きしていない。'],'files':{str(f.relative_to(base)).replace('\\','/'):hashlib.sha256(f.read_bytes()).hexdigest() for f in base.rglob('*') if f.is_file()}}
manifest['files'].pop('manifest.json',None)
manifest['rebuild']+=['Blender --background --disable-autoexec --python soldier-motion-20261009/refine-ground.py','Blender --background --disable-autoexec --python soldier-motion-20261009/arm-roll.py','Blender --background --disable-autoexec --python soldier-motion-20261009/ground-equipped.py -- --down-only','Blender --background --disable-autoexec --python soldier-motion-20261009/animate-sling.py','Blender --background --disable-autoexec --python soldier-motion-20261009/export-game.py -- --source=soldier-motion-20261009/soldier-sling-motion-candidate.blend','Blender --background --disable-autoexec --python soldier-motion-20261009/check-body-ground.py -- --exported --strict']
manifest['rebuild'].insert(-2,'Blender --background --disable-autoexec --python soldier-motion-20261009/refine-rocket-reload.py')
manifest['rebuild']=[v.replace('--source=soldier-motion-20261009/soldier-sling-motion-candidate.blend','--source=soldier-motion-20261009/soldier-reload-candidate.blend') for v in manifest['rebuild']]
manifest['rebuild'].insert(-2,'Blender --background --disable-autoexec --python soldier-motion-20261009/refine-switch-handoff.py')
manifest['rebuild'].insert(-2,'Blender --background --disable-autoexec --python soldier-motion-20261009/refine-switch-support.py')
manifest['rebuild']=[v.replace('--source=soldier-motion-20261009/soldier-reload-candidate.blend','--source=soldier-motion-20261009/soldier-switch-support-candidate.blend') for v in manifest['rebuild']]
manifest['notes']+=['ground-equipped.pyは--down-onlyを採用し、回避の全身持ち上げ案は不採用。詳細はcandidate-decisions.json。','review.htmlとsoldier-motion-candidate.glbは制作側の骨名の比較用。現行ゲーム表示は/soldier-review.htmlとpublic/assets/characters/swarm-soldier.glbを使う。','現行746e35は持ち替えの左右腕を修正した制作途中版。構造・秒数・他30動作の不変を照合。床検査と回避画像は8ec17d版の証拠であり、装填差分と持ち替え差分の2報告で対象動作・形状・骨基準の不変を確認した。','背面装備の後方20cm案は回避・転倒で最大約19cm床下へ入るため不採用。720配置を探索し、静止で交差0の114配置も既存の回避/転倒ではすべて床貫通。別のback-mount候補で3軸の傾きを試作中。回避左側の床貫通・体干渉・持ち替え位置・自然さが未解決のため現行746e35は変更しない。']
manifest['notes']+=['4色シェーダーは実装済み。肩の橙・紫・ライムへの切替をChrome実描画で確認。実ゲームでの識別性は未検証。','入力Blendには兵士本人の頭・体・骨格のみ。元キットの隠し素体・サンプルは含めない。','修正スクリプトrepair-hand-rig.pyは元のローカル中間データ用。通常の再生成は保存済みsoldier-rig-input.blendから開始する。']
manifest['rebuild'].insert(-2,'Blender --background --disable-autoexec --python soldier-motion-20261009/refine-roll-grips.py')
manifest['rebuild'].insert(-2,'Blender --background --disable-autoexec --python soldier-motion-20261009/author-low-evade.py')
manifest['rebuild'].insert(-2,'Blender --background --disable-autoexec --python soldier-motion-20261009/mount-low-evade.py')
manifest['rebuild'].insert(-2,'Blender --background --disable-autoexec --python soldier-motion-20261009/refine-switch-handoff.py -- --source=soldier-motion-20261009/soldier-low-evade-mounted.blend --output-stem=soldier-low-evade-handoff')
manifest['rebuild'].insert(-2,'Blender --background --disable-autoexec --python soldier-motion-20261009/refine-switch-support.py -- --source=soldier-motion-20261009/soldier-low-evade-handoff.blend --output-stem=soldier-low-evade-integrated')
manifest['rebuild']=[v.replace('--source=soldier-motion-20261009/soldier-switch-support-candidate.blend','--source=soldier-motion-20261009/soldier-low-evade-integrated.blend') for v in manifest['rebuild']]
manifest['notes'].append('現行はbea488の34動作。上記746e35や前転の課題記述は旧版の履歴。2026-10-09ユーザーが低い踏み込み回避を承認し、一瞬の武器の床貫通を許容。新回避3種・密着した背面位置・持ち替え再調整をローカル採用。実ゲーム/監査/公開は未完了。')
(base/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'files':len(manifest['files']),'bytes':sum(f.stat().st_size for f in base.rglob('*') if f.is_file()),'destination':str(base)},ensure_ascii=False))
