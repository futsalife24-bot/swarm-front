import array
import hashlib
import json
import math
from pathlib import Path
import wave

root = Path(__file__).resolve().parent
results = []
for p in sorted((root / 'candidates').glob('*.wav')):
    with wave.open(str(p), 'rb') as w:
        channels, width, rate, frames = w.getnchannels(), w.getsampwidth(), w.getframerate(), w.getnframes()
        assert channels == 1 and width == 2
        samples = array.array('h', w.readframes(frames))
    active = [i for i, s in enumerate(samples) if abs(s) >= 328]
    peak = max(abs(s) for s in samples)
    rms = math.sqrt(sum(s*s for s in samples)/len(samples))
    results.append(dict(file=p.name, bytes=p.stat().st_size, sha256=hashlib.sha256(p.read_bytes()).hexdigest(), channels=channels, sampleRate=rate, seconds=frames/rate, peakDbfs=round(20*math.log10(max(peak,1)/32768),2), rmsDbfs=round(20*math.log10(max(rms,1)/32768),2), clippedSamples=sum(abs(s)>=32767 for s in samples), leadingBelowMinus40DbSeconds=round(active[0]/rate,3) if active else None, trailingBelowMinus40DbSeconds=round((frames-active[-1]-1)/rate,3) if active else None))
(root/'candidate-metrics.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(results,ensure_ascii=False,indent=2))
