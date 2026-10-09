"""Preserve native recording timestamps and extract inspection frames."""
import hashlib,json,subprocess,sys
from pathlib import Path
source,target,ffmpeg=map(Path,sys.argv[1:4]);target.mkdir(parents=True,exist_ok=True)
d=json.loads((source/'metrics.json').read_text(encoding='utf-8')); rows=d['samples']
(target/'metrics.json').write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf-8')
def run(*args):subprocess.run([str(ffmpeg),'-hide_banner','-loglevel','error','-y',*map(str,args)],check=True)
run('-i',source/'capture.webm','-c:v','libx264','-crf',20,'-pix_fmt','yuv420p','-fps_mode','vfr',target/'normal.mp4')
run('-i',source/'capture.webm','-vf','setpts=2*PTS','-c:v','libx264','-crf',20,'-pix_fmt','yuv420p','-fps_mode','vfr',target/'half-speed.mp4')
selected=[]
for i,t in enumerate([.5,1.5,2.2,2.6,3.35,4.5,5.3,5.85,6.65,6.9,7.2,7.4,7.8,8.4,9.4]):
 r=min(rows,key=lambda r:abs(r['t']-t));selected.append(r)
 run('-ss',r['wall'],'-i',source/'capture.webm','-frames:v',1,target/f'frame-{i:02}.jpg')
checks={'forwardFire':any('KeyW' in r['keys'] and r['fire'] for r in rows),'backFire':any('KeyS' in r['keys'] and r['fire'] for r in rows),'leftFire':any('KeyA' in r['keys'] and r['fire'] for r in rows),'rightFire':any('KeyD' in r['keys'] and r['fire'] for r in rows),'movingReload':any(r['keys'] and r['reload']>0 for r in rows),'switchInterruptsReload':any(a['reload']>0 and b['slot']!=a['slot'] for a,b in zip(rows,rows[1:])),'evade':any(r['evade']>0 for r in rows),'fireAfterEvade':any(7.1<=r['t']<=7.5 and r['fire'] and r['evade']==0 for r in rows)}
assert all(checks.values()),checks
summary={'capture':source.name,'wallSeconds':d['seconds'],'renderedFrames':d['frames'],'gameSeconds':rows[-1]['t'],'maxEnemies':max(r['enemies'] for r in rows),'checks':checks,'selected':selected,'limitations':'通常ソロのControls自動入力。録画は実時間を維持。描画間隔が不均一で、実時間の滑らかさ/性能を保証しない。ライフルと散弾銃のみ。通常カメラは960px、拡大側は同じ姿勢で背景/影なし。'}
(target/'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
manifest=[{'path':p.name,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in target.iterdir() if p.is_file() and p.name!='manifest.json']
(target/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in summary.items() if k!='selected'},ensure_ascii=False))
