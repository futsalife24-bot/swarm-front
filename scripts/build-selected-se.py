"""Build the three user-selected samples; source files stay outside public assets."""
import pathlib, subprocess, json, hashlib, wave
import numpy as np
ROOT=pathlib.Path(__file__).resolve().parents[1]
SRC=ROOT.parent/'references/weapon-se-20260914'
FF=SRC/'tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
OUT=ROOT/'public/assets/audio/selected-v1'; OUT.mkdir(parents=True,exist_ok=True)
spec=[('rifle','AR-04','Prepared SFX Library/AK-47/C_27P.wav','https://opengameart.org/content/the-free-firearm-sound-library'),('shotgun','SG-01','SG-01.mp3','https://elevenlabs.io/sound-effects/shotgun'),('rocket','RL-05','RL-05.mp3','https://mixkit.co/free-sound-effects/rocket/')]
rows=[]
for key,code,file,url in spec:
 raw=subprocess.check_output([str(FF),'-v','error','-i',str(SRC/file),'-f','f32le','-ac','1','-ar','32000','pipe:1'])
 a=np.frombuffer(raw,dtype='<f4').copy()
 if key=='rifle':
  # First AK-47 discharge ends before the second transient at about 0.36 s.
  start,end=round(.255*32000),round(.349*32000)
 else:
  active=np.flatnonzero(abs(a)>max(abs(a))*.015)
  start=max(0,int(active[0])-64);end=min(len(a),int(active[-1])+1600)
 a=a[start:end].copy();a[:32]*=np.linspace(0,1,32);fade=min(320,len(a)//5);a[-fade:]*=np.linspace(1,0,fade)
 gain=min((.80)/max(abs(a)),.18/max(np.sqrt(np.mean(a*a)),1e-8));a*=gain
 target=OUT/(key+'.wav')
 with wave.open(str(target),'wb') as w:
  w.setparams((1,2,32000,0,'NONE','not compressed'));w.writeframes((a*32767).astype('<i2').tobytes())
 rows.append(dict(key=key,candidate=code,source=file,url=url,source_sha256=hashlib.sha256((SRC/file).read_bytes()).hexdigest(),sha256=hashlib.sha256(target.read_bytes()).hexdigest(),seconds=len(a)/32000,start=start/32000,end=end/32000,peak=float(max(abs(a))),rms=float(np.sqrt(np.mean(a*a))),gain=float(gain)))
(OUT/'manifest.json').write_text(json.dumps({'assets':rows},ensure_ascii=False,indent=2),encoding='utf-8')
(OUT/'CREDITS.txt').write_text('''Selected weapon sound effects — 2026-09-14
AR-04: The Free Firearm Sound Library / AK-47 C_27P.wav
Ben Jaszczak, Brian Nelson, Kevin Heras, Matthew Nanney. CC0.
https://opengameart.org/content/the-free-firearm-sound-library
SG-01: Heavy shotgun blast, U1cjvUadak7Zu0Myj95g
Sound effect from ElevenLabs — elevenlabs.io
https://elevenlabs.io/sound-effects/shotgun
Free public-library download; attribution retained. No paid generation used.
RL-05: Fast rocket whoosh (1714), Mixkit Sound Effects Free License.
https://mixkit.co/free-sound-effects/rocket/
https://mixkit.co/license/
Edits: mono 32kHz PCM16, onset trim, gain adjustment, short edge fades.
AR-04: one discharge extracted from the selected burst recording, retriggered by each authoritative game shot.
Original samples are not included as a standalone sound library.
''',encoding='utf-8')
print(json.dumps(rows,ensure_ascii=False,indent=2))


