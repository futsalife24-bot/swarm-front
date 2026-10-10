"""単一話者の生成原本を長い無音区間で11台詞に分け、再現可能に保存。"""
import array
import hashlib
import json
import math
from pathlib import Path
import wave

root = Path(__file__).resolve().parent
source = root / 'all-lines-take1.wav'
lines = [('reload', '装填中！'), ('reload-alt', 'リロード！'),
         ('empty', 'くっ、弾切れだ！'), ('cover', '援護する！'),
         ('warning', '大型接近！'), ('wave', '次が来るぞ！'),
         ('wave-alt', 'よし、迎え撃つ！'), ('hurt', 'ぐっ！'),
         ('hurt-alt-v2', 'ちっ、やるな！'), ('fire', 'くらえっ！'),
         ('fire-alt', '押し返すぞ！')]
with wave.open(str(source), 'rb') as w:
    assert (w.getnchannels(), w.getsampwidth(), w.getframerate()) == (1, 2, 24000)
    rate = w.getframerate()
    pcm = w.readframes(w.getnframes())
samples = array.array('h', pcm)
step = rate // 100
levels = [math.sqrt(sum(s*s for s in samples[i:i+step])/len(samples[i:i+step]))
          for i in range(0, len(samples), step)]
threshold = 32768 * 10 ** (-45 / 20)
gaps = []
start = None
for i, level in enumerate(levels + [32768]):
    if level < threshold:
        if start is None:
            start = i
    elif start is not None:
        if i-start >= 60 and start > 0 and i < len(levels):
            gaps.append((start*step, min(i*step, len(samples))))
        start = None
assert len(gaps) == len(lines)-1, f'台詞境界が10箇所ではありません: {len(gaps)}'
cuts = [0] + [(a+b)//2 for a, b in gaps] + [len(samples)]
clips = root / 'clips'
clips.mkdir(exist_ok=True)
entries = []
for (id, text), begin, end in zip(lines, cuts, cuts[1:]):
    # 無音をすべて消さず、-50dBFS以上の信号の前150ms/後180msを保持。
    active = [i for i in range(begin//step, min((end+step-1)//step, len(levels)))
              if levels[i] >= 32768 * 10 ** (-50 / 20)]
    assert active, id
    first = max(begin, active[0]*step-int(.15*rate))
    last = min(end, (active[-1]+1)*step+int(.18*rate))
    data = pcm[first*2:last*2]
    target = clips / (id+'.wav')
    with wave.open(str(target), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(data)
    with wave.open(str(target), 'rb') as w:
        assert w.readframes(w.getnframes()) == data
    clip_samples = array.array('h', data)
    peak = max(abs(s) for s in clip_samples)
    rms = math.sqrt(sum(s*s for s in clip_samples)/len(clip_samples))
    entries.append(dict(id=id, text=text, file='clips/'+target.name,
                        sourceStartSeconds=first/rate, sourceEndSeconds=last/rate,
                        seconds=(last-first)/rate, bytes=target.stat().st_size,
                        sha256=hashlib.sha256(target.read_bytes()).hexdigest(),
                        peakDbfs=round(20*math.log10(max(peak,1)/32768),2),
                        rmsDbfs=round(20*math.log10(max(rms,1)/32768),2),
                        clippedSamples=sum(abs(s)>=32767 for s in clip_samples),
                        sourcePcmMatches=True))
manifest = dict(series='まだ未熟な若い兵士', source=source.name,
                sourceSha256=hashlib.sha256(source.read_bytes()).hexdigest(),
                sourceSeconds=len(samples)/rate, channels=1, sampleRate=rate,
                sampleWidthBits=16, boundaryMethod='10ms RMS -45dBFS以下・600ms以上の無音10箇所',
                processing='区間抽出と前後の低レベル区間整理のみ。音量/速度/ピッチ不変',
                labeling='指定順と無音境界で対応。聴感による発音/内容確認は未実施',
                clips=entries)
(root/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(dict(sourceSeconds=manifest['sourceSeconds'], count=len(entries),
                     clippedSamples=sum(e['clippedSamples'] for e in entries),
                     clips=[dict(id=e['id'],seconds=e['seconds']) for e in entries]),ensure_ascii=False))
