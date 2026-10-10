"""Archive fixed-frame render evidence, including measured body-relative emission."""
import hashlib, json, shutil, subprocess, sys
from pathlib import Path

source, target, ffmpeg = map(Path, sys.argv[1:4])
target.mkdir(parents=True, exist_ok=True)
data = json.loads((source / 'metrics.json').read_text(encoding='utf-8'))
emissions = data['emissionSamples']
assert data['review'] == 'roll-shot' and data['frames'] == 180
assert emissions and max(e['error'] for e in emissions) < 1e-8
profile = int(source.name.split('-')[0])
evades = [r['t'] for r in data['samples'] if r['players'][profile]['evade'] > 0]
assert any(4 < t < 4.5 for t in evades) and any(6.5 < t < 7 for t in evades)

def run(*args):
    subprocess.run([str(ffmpeg), '-hide_banner', '-loglevel', 'error', '-y', *map(str, args)], check=True)

run('-framerate', 24, '-i', source / '%04d.jpg', '-c:v', 'libx264', '-crf', 19,
    '-pix_fmt', 'yuv420p', target / 'normal.mp4')
run('-i', target / 'normal.mp4', '-vf', 'setpts=2*PTS', '-c:v', 'libx264', '-crf', 19,
    '-pix_fmt', 'yuv420p', target / 'half-speed.mp4')
shutil.copy2(source / 'metrics.json', target / 'metrics.json')
for n in [26, 55, 75, 98, 99, 100, 101, 102, 103, 104, 106, 158, 159, 160, 161, 162, 164, 166]:
    shutil.copy2(source / f'{n:04}.jpg', target / f'frame-{n:04}.jpg')
summary = dict(capture=source.name, frames=data['frames'], fps=data['fps'], seconds=7.5,
               emissionSamples=len(emissions), maxEmissionError=max(e['error'] for e in emissions),
               evadingSamples=len(evades), limitations='実ゲームstep/Renderer、敵なし・影なし・注目1人。固定24fpsで実時間性能やネットワークの保証ではない。ロケット実体と煙は従来の権威座標。')
(target / 'summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding='utf-8')
manifest = [dict(path=p.name, bytes=p.stat().st_size, sha256=hashlib.sha256(p.read_bytes()).hexdigest())
            for p in target.iterdir() if p.is_file() and p.name != 'manifest.json']
(target / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
print(json.dumps(summary, ensure_ascii=False))
