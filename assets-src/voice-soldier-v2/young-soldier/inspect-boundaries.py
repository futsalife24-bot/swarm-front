import array
import json
import math
from pathlib import Path
import wave

root = Path(__file__).resolve().parent
with wave.open(str(root / 'all-lines-take1.wav'), 'rb') as w:
    assert (w.getnchannels(), w.getsampwidth(), w.getframerate()) == (1, 2, 24000)
    rate = w.getframerate()
    samples = array.array('h', w.readframes(w.getnframes()))
step = rate // 100
levels = [math.sqrt(sum(s*s for s in samples[i:i+step]) / len(samples[i:i+step]))
          for i in range(0, len(samples), step)]
for db in [-40, -45, -50]:
    threshold = 32768 * 10 ** (db / 20)
    gaps = []
    start = None
    for i, rms in enumerate(levels + [32768]):
        if rms < threshold:
            if start is None:
                start = i
        elif start is not None:
            if i - start >= 20:
                gaps.append(dict(start=start*.01, end=i*.01, seconds=(i-start)*.01))
            start = None
    print(json.dumps(dict(db=db, duration=len(samples)/rate, gaps=gaps), ensure_ascii=False))
