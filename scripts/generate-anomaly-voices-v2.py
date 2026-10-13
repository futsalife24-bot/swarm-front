"""ANOMALYの種別ごとに異なる発音機構・時間構造を合成する。

Python 3.12 / NumPy。外部サンプル・音声APIは不使用。v1は比較用に保持。
波形検査は聴感評価ではない。合成・検査・本人の試聴採否を区別する。
"""
import hashlib
import json
from pathlib import Path
import wave

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public/assets/audio/anomaly-voice-v2"
RATE = 32000
TAU = 2 * np.pi
RECIPES = {
    "harrow": (1.85, "割れた喉の咆哮。短い喉鳴りの後、一息で吼えて途切れる。"),
    "calyx": (1.85, "空洞へ吸い込む息が膨らみ、口を閉じるように急に止まる。"),
    "ant": (1.12, "乾いた短い二連吠え。二声の間に明確な間を置く。"),
    "spider": (1.30, "細い鳴き声が三連から加速し、短い擦れ声で終わる。"),
    "crawler": (1.75, "襞を引きずる湿った擦れ。喉の奥の不規則な脈動を伴う。"),
    "spitter": (1.55, "硬い殻が三段に共鳴する、短く澄んだ不協和の鳴き声。"),
    "hornet": (1.65, "鋭い息が断続的に震え、後半で細い笛声へ収束する。"),
    "boss": (2.10, "低い殻鳴りの後、重い金属がたわむ長い軋みが残る。"),
}


def timeline(seconds):
    return np.arange(round(seconds * RATE)) / RATE


def gate(t, start, end, attack=0.012, release=0.04):
    a = np.clip((t - start) / attack, 0, 1)
    b = np.clip((end - t) / release, 0, 1)
    return np.sin(a * np.pi / 2) ** 2 * np.sin(b * np.pi / 2) ** 2


def unit(x):
    return x / max(1e-9, float(np.sqrt(np.mean(x * x))))


def noise(rng, n, lo, hi):
    # 周期音源を混ぜず、滑らかな帯域端を持つ息・摩擦の音源を作る。
    x = rng.standard_normal(n)
    f = np.fft.rfftfreq(n, 1 / RATE)
    hp = (f / max(lo, 1)) ** 4
    shape = hp / (1 + hp) / (1 + (f / hi) ** 6)
    return unit(np.fft.irfft(np.fft.rfft(x) * shape, n))


def tract(x, bands):
    f = np.fft.rfftfreq(len(x), 1 / RATE)
    shape = sum(gain * np.exp(-0.5 * ((f - hz) / width) ** 2)
                for hz, width, gain in bands)
    return unit(np.fft.irfft(np.fft.rfft(x) * shape, len(x)))


def osc(frequency):
    return TAU * np.cumsum(frequency) / RATE


def render(kind, v):
    duration, _ = RECIPES[kind]
    t = timeline(duration)
    n = len(t)
    seed = int.from_bytes(hashlib.sha256(f"anomaly-v2:{kind}:{v}".encode()).digest()[:8], "big")
    rng = np.random.default_rng(seed)
    x = np.zeros(n)
    if kind == "harrow":
        # 非線形に割れた声帯。短い前鳴き→咆哮。変種は息継ぎと終わり方も変更。
        f = 105 + 110 * np.exp(-((t - .50) / .28) ** 2) - 27 * t
        f *= 1 + .11 * np.sin(TAU * 37 * t) + .065 * np.sin(TAU * 53.7 * t)
        phase = osc(f)
        raw = np.tanh(2.8 * (np.sin(phase) + .52 * np.sin(phase * .499)))
        raw += .3 * noise(rng, n, 450, 3100)
        roar = tract(raw, [(490, 180, 1), (1450, 390, .65), (2450, 450, .28)])
        env = .45 * gate(t, .03, .20) + gate(t, .27, 1.69 if v == 0 else 1.38, .035, .15)
        if v:
            env += .6 * gate(t, 1.46, 1.76, .02, .11)
        x = roar * env * (.8 + .2 * np.sin(TAU * 23 * t))
    elif kind == "calyx":
        # 吸気のみ。声帯・金属音を使わず、空洞の息が開閉する。
        air = noise(rng, n, 120, 3600)
        low = tract(air, [(360, 95, 1), (840, 175, .65)])
        high = tract(air, [(1350, 310, 1), (2700, 520, .6)])
        opening = np.clip(t / 1.25, 0, 1) ** 1.6
        env = gate(t, .025, 1.62, .95 if v == 0 else .67, .055)
        if v:
            env *= 1 - .78 * gate(t, .65, .83, .045, .06)
        x = (low * (1 - .75 * opening) + high * opening * .8) * env
        # 閉口後の空洞の短い残響。
        after = np.maximum(t - 1.61, 0)
        x += .2 * np.sin(TAU * 340 * after) * np.exp(-after * 25) * gate(t, 1.61, 1.83, .006, .035)
    elif kind == "ant":
        # 二つの声をそれぞれ急降下する短い吠えとして発声。持続うなりなし。
        for start, length, strength in ([(.025, .28, 1), (.53, .38, .84)] if v == 0
                                         else [(.025, .38, .85), (.68, .25, 1)]):
            age = np.maximum(t - start, 0)
            ph = osc(110 + 160 * np.exp(-age * 15))
            raw = np.tanh(3 * np.sin(ph)) + .48 * noise(rng, n, 160, 2500)
            bark = tract(raw, [(660, 260, 1), (1720, 400, .45)])
            x += bark * strength * gate(t, start, start + length, .005, .10) * np.exp(-age * 3)
    elif kind == "spider":
        # 小さい発音器官の連鳴き。回数・間隔を変種で変え、単なる移調をしない。
        starts = [.025, .27, .45, .60, .73] if v == 0 else [.025, .18, .36, .59, .78, .93]
        for j, start in enumerate(starts):
            age = np.maximum(t - start, 0)
            f = 1050 + 950 * np.clip(age / .11, 0, 1)
            ph = osc(f)
            squeak = np.sin(ph + 1.15 * np.sin(ph * 1.43))
            squeak += .4 * noise(rng, n, 1800, 4400)
            x += squeak * gate(t, start, start + .12, .009, .025) * (.80 + .04 * j)
        x += .35 * noise(rng, n, 1300, 4600) * gate(t, 1.04, 1.27, .03, .1)
    elif kind == "crawler":
        # 襞の擦過音。摩擦の塊と非周期的な湿った破裂で、低音の高さに依存しない。
        rub = noise(rng, n, 95, 1100)
        grain = noise(rng, n, 800, 2400)
        rhythm = np.maximum(0, np.sin(TAU * (5.7 * t + .8 * t * t))) ** 2
        env = gate(t, .025, 1.70, .11, .22)
        if v:
            env *= 1 - .85 * gate(t, .72, .91, .05, .065)
        x = (rub * (.3 + .7 * rhythm) + .25 * grain * rhythm) * env
        for start in rng.uniform(.12, 1.5, 15 if v == 0 else 21):
            age = np.maximum(t - start, 0)
            x += .42 * np.sin(TAU * (170 * age - 90 * age * age)) * np.exp(-age * 70) * gate(t, start, start + .09, .002, .015)
    elif kind == "spitter":
        # 殻の固有振動。呼気や声帯を入れず、非整数倍の硬い共鳴を三段で鳴らす。
        strikes = [(0.025, 1), (.34, .68), (.69, .85)] if v == 0 else [(.025, .65), (.24, .86), (.63, 1)]
        for j, (start, strength) in enumerate(strikes):
            age = np.maximum(t - start, 0)
            for k, f in enumerate((1170, 1787, 2791, 3960)):
                # 各打音が違う面に伝わる。音楽的な等間隔・和音を避ける。
                tone = np.sin(TAU * f * (1 + .014 * j) * age + .12 * np.sin(TAU * 19 * age))
                x += strength * tone * np.exp(-age * (6 + k * 2.8)) / (1 + k) * gate(t, start, start + .8, .003, .06)
    elif kind == "hornet":
        # 高域の息を粗く刻み、終盤だけ細い笛へ収束。HARROWの声帯式を共有しない。
        buzzphase = osc(47 + 38 * t + 12 * np.sin(TAU * 3.1 * t))
        chop = .08 + .92 * np.maximum(0, np.sin(buzzphase)) ** 3
        air = noise(rng, n, 2900, 6200)
        whistle = np.sin(osc(3150 - 900 * np.clip(t / 1.6, 0, 1) + 80 * np.sin(TAU * 11 * t)))
        ending = np.clip((t - .78) / .65, 0, 1)
        env = gate(t, .025, 1.60, .025, .18)
        if v:
            env *= 1 - .94 * gate(t, .54, .73, .015, .025)
        x = (air * chop * (1 - .65 * ending) + .42 * whistle * ending) * env
    elif kind == "boss":
        # 厚い外殻の座屈。二つの鈍い打音→伸びる軋み。スマホでも残る中域を含む。
        for start, strength in ([(.025, 1), (.30, .65)] if v == 0 else [(.025, .65), (.46, 1)]):
            age = np.maximum(t - start, 0)
            for j, f in enumerate((74, 123, 207, 337, 593)):
                x += strength * np.sin(TAU * f * age) * np.exp(-age * (4.5 + j)) / (1 + j * .4) * gate(t, start, start + .9, .006, .1)
        bend = 260 + 100 * np.sin(np.pi * np.clip((t - .3) / 1.8, 0, 1))
        ph = osc(bend)
        creak = np.sin(ph + 2.8 * np.sin(ph * 1.381))
        creak *= .55 + .45 * np.maximum(0, np.sin(TAU * 16 * t))
        x += .85 * creak * gate(t, .38 if v == 0 else .56, 2.05, .15, .42)
        x += .22 * noise(rng, n, 110, 600) * gate(t, .03, 2.07, .10, .45)
    else:
        raise ValueError(kind)
    # 共通なのはDC除去、端点、出力レベルの処理だけ。音源・発声の構造は種別。
    x -= x.mean()
    x *= gate(t, 0, duration - 1 / RATE, .005, .018)
    x *= .105 / max(1e-9, float(np.sqrt(np.mean(x * x))))
    peak = float(np.max(np.abs(x)))
    if peak > .69:
        x *= .69 / peak
    x[0] = x[-1] = 0
    assert np.isfinite(x).all()
    return x


def save(name, x):
    path = OUT / name
    pcm = np.rint(x * 32767).astype('<i2')
    with wave.open(str(path), 'wb') as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(RATE)
        audio.writeframes(pcm.tobytes())
    return {"file": name, "seconds": len(x) / RATE,
            "peak_dbfs": round(float(20 * np.log10(np.max(np.abs(x)))), 2),
            "rms_dbfs": round(float(20 * np.log10(np.sqrt(np.mean(x * x)))), 2),
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = {"method": "species-specific procedural synthesis", "external_samples": False,
                "ai_generation": False, "credits_spent": 0, "sample_rate": RATE,
                "numpy_version": np.__version__, "files": [], "auditions": []}
    voices = {}
    for kind, (_, description) in RECIPES.items():
        for v in (0, 1):
            x = render(kind, v)
            voices[kind, v] = x
            item = save(f"{kind}-{v}.wav", x)
            item["description"] = description
            manifest["files"].append(item)
    # モノラル・同じ定位で重ねる。左右配置の違いで識別できたように見せない。
    # 2声を0.65秒差で鳴らす4組。実ゲームと同じ間隔・最大2声の範囲。
    groups = [("harrow", "calyx"), ("ant", "spider"), ("crawler", "boss"), ("spitter", "hornet")]
    mix = np.zeros(round(14 * RATE))
    cues = []
    for i, pair in enumerate(groups):
        for j, kind in enumerate(pair):
            at = i * 3.5 + .1 + j * .65
            start = round(at * RATE)
            x = voices[kind, 0]
            mix[start:start + len(x)] += x * .62
            cues.append({"kind": kind, "at": at})
    item = save("pairs.wav", mix)
    item["cues"] = cues
    manifest["auditions"].append(item)
    # 意図的な負荷試聴。実ゲームの2声制限とは別に、4声同時でも破綻しないかを聞く。
    stress = np.zeros(round(7 * RATE))
    cues = []
    for i, group in enumerate((list(RECIPES)[:4], list(RECIPES)[4:])):
        for kind in group:
            at = .1 + i * 3.5
            start = round(at * RATE)
            x = voices[kind, 1]
            stress[start:start + len(x)] += x * .32
            cues.append({"kind": kind, "at": at})
    item = save("crowd-stress.wav", stress)
    item["cues"] = cues
    manifest["auditions"].append(item)
    (OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    (OUT / "CREDITS.txt").write_text("SWARM FRONT ANOMALY ボイス v2\n独自の数式・ノイズ合成。外部サンプル、人物音声、生成AI、外部APIは不使用。クレジット消費0。\n再生成: python scripts/generate-anomaly-voices-v2.py (Python 3.12 / NumPy)\n旧版は比較用に保持。本人の聴感採用とは区別する。\n", encoding='utf-8')
    print(json.dumps({"voices": len(manifest["files"]), "auditions": len(manifest["auditions"]), "path": str(OUT)}))


if __name__ == '__main__':
    main()
