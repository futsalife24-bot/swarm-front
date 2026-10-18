"""PRISM改訂・連結個体2状態の新規発声。採用済み7系統はv2から同一PCMを保持。"""
import hashlib
import importlib.util
import json
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("voice_v2", Path(__file__).with_name("generate-anomaly-voices-v2.py"))
v2 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(v2)
RATE, TAU = v2.RATE, v2.TAU
gate, noise, tract, osc = v2.gate, v2.noise, v2.tract, v2.osc
OUT = ROOT / "public/assets/audio/anomaly-voice-v3"
RECIPES = {
    **v2.RECIPES,
    "spitter": (1.72, "殻が擦れて裂けるような声。ざらついた響きが不規則にせり上がり、砕けて止まる。"),
    "boss-linked": (2.15, "複数の空洞が唸る、長く膨らむ重い息。異なる響きがうねり、底へ沈む。"),
    "boss-separated": (1.68, "硬い顎を鳴らすような、荒い破裂声。ばらついた短い連声から擦れた叫びへ変わる。"),
    # 2026-10-18追加。既存20声のPCMは変えない（このキーだけ新規に生成）。
    "bastion": (1.55, "装甲の奥で唸る低い共鳴。帯が回るように音程がせり上がり、板が締まる硬い打音で途切れる。"),
}


def render(kind, variant):
    if kind not in ("spitter", "boss-linked", "boss-separated", "bastion"):
        return v2.render(kind, variant)
    duration = RECIPES[kind][0]
    t = v2.timeline(duration)
    n = len(t)
    seed = int.from_bytes(hashlib.sha256(f"anomaly-v3:{kind}:{variant}".encode()).digest()[:8], "big")
    rng = np.random.default_rng(seed)
    if kind == "spitter":
        # 打鐘・定周期の断続を廃止。連続する殻の擦過と曲がった倍音を主体にする。
        air = noise(rng, n, 700, 6500)
        points = [0, .14, .47, .59, 1.13, 1.44, duration] if variant == 0 else [0, .29, .38, .83, 1.19, 1.53, duration]
        f = np.interp(t, points, [720, 1620, 930, 2180, 1460, 2450, 570])
        jitter = np.interp(t, np.linspace(0, duration, 93), rng.uniform(-180, 180, 93))
        phase = osc(f + jitter)
        rasp = np.sin(phase + 2.9 * np.sin(phase * 1.713))
        rasp += .46 * np.sin(phase * 2.381 + .8 * air)
        abrasion = tract(air, [(1650, 730, 1), (3900, 1150, .7)])
        contour = np.interp(t, points, [.1, .87, .38, 1, .52, .75, 0])
        grain = np.interp(t, np.linspace(0, duration, 127), rng.uniform(.24, 1, 127))
        x = (rasp * .47 + abrasion * .75) * contour * grain
        x *= gate(t, .015, 1.67, .075, .14)
    elif kind == "boss-linked":
        # 通常型の打音・金属座屈を使わず、広い空洞を通る呼気の群れ。
        x = np.zeros(n)
        for i, center in enumerate((180, 395, 735, 1110)):
            breath = noise(rng, n, 75, 2400)
            cavity = tract(breath, [(center, center * .19, 1), (center * 2.31, center * .34, .24)])
            sway = .56 + .44 * np.sin(TAU * (.67 + i * .21) * t + i * 1.4) ** 2
            x += cavity * sway / (1 + i * .48)
        # 音程ではなく息の厚みが一度膨らみ、末尾へ下降する。
        env = gate(t, .02, 2.10, .72 if variant == 0 else .43, .58)
        if variant:
            env *= 1 - .55 * gate(t, .87, 1.19, .13, .15)
        pressure = .68 + .32 * np.sin(osc(17 + 8 * np.sin(TAU * .61 * t))) ** 2
        x *= env * pressure
    elif kind == "bastion":
        # 機構型。喉や息ではなく、金属殻の低い共鳴と回転する帯のうねり、
        # 末尾に装甲板が締まる二連の硬い打音。声帯的な母音は使わない。
        peak = .9 if variant == 0 else .74
        f0 = np.interp(t, [0, peak, 1.3, duration], [62, 118, 134, 70])
        ph = osc(f0)
        hum = np.sin(ph) + .55 * np.sin(2.01 * ph + .4) + .32 * np.sin(3.97 * ph)
        spin_rate = np.interp(t, [0, 1.25, duration], [5, 19 if variant == 0 else 23, 8])
        spin = .55 + .45 * np.sin(osc(spin_rate)) ** 2
        shell = tract(noise(rng, n, 180, 4200), [(420, 90, 1), (1180, 160, .55), (2650, 300, .3)])
        x = (hum * .6 + shell * .5) * spin * gate(t, .03, 1.30, .12, .22)
        hits = [1.28, 1.36] if variant == 0 else [1.22, 1.33]
        for i, start in enumerate(hits):
            age = np.maximum(t - start, 0)
            ring = np.sin(osc(np.full(n, 1730.0 + i * 410))) * np.exp(-age * 30)
            ring += noise(rng, n, 900, 6000) * np.exp(-age * 80)
            x += ring * (t >= start) * (1 - .25 * i) * .9
    else:
        # 分離後は群れの息から乾いた顎の破裂・掠れた叫びへ。等間隔にはしない。
        x = np.zeros(n)
        starts = [.025, .15, .43, .52] if variant == 0 else [.025, .25, .34, .65, .74]
        for i, start in enumerate(starts):
            age = np.maximum(t - start, 0)
            crack = noise(rng, n, 400, 5100)
            jaw = tract(crack, [(830, 420, 1), (2340, 670, .65)])
            x += jaw * np.exp(-age * 24) * gate(t, start, start + .17, .002, .025) * (1 - i * .06)
        ph = osc(350 + 190 * np.sin(np.pi * np.clip((t - .65) / .9, 0, 1)))
        scream = np.tanh(2.2 * np.sin(ph + 2.4 * np.sin(ph * 1.61)))
        scream += .65 * noise(rng, n, 600, 3900)
        ragged = np.interp(t, np.linspace(0, duration, 79), rng.uniform(.1, 1, 79))
        x += scream * ragged * gate(t, .69 if variant == 0 else .89, 1.63, .08, .28)
    x -= x.mean()
    x *= gate(t, 0, duration - 1 / RATE, .005, .018)
    x *= .22 / max(1e-9, float(np.sqrt(np.mean(x * x))))
    x = .69 * np.tanh(x / .69)
    x[0] = x[-1] = 0
    assert np.isfinite(x).all()
    return x


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    v2.OUT = OUT
    manifest = {"method": "species-and-state-specific procedural synthesis", "external_samples": False,
                "ai_generation": False, "credits_spent": 0, "sample_rate": RATE,
                "numpy_version": np.__version__, "files": [], "auditions": []}
    voices = {}
    for kind, (_, description) in RECIPES.items():
        for variant in (0, 1):
            x = render(kind, variant)
            voices[kind, variant] = x
            item = v2.save(f"{kind}-{variant}.wav", x)
            item["description"] = description
            manifest["files"].append(item)
    # 群れ比較に加えて、3つのボス声を同じ音量で順番に確認する。
    mixes = [
        ("pairs.wav", 14, [(a, i * 3.5 + .1 + j * .65, .62, 0)
          for i, pair in enumerate((("harrow", "calyx"), ("ant", "spider"), ("crawler", "boss"), ("spitter", "hornet")))
          for j, a in enumerate(pair)]),
        ("crowd-stress.wav", 10.5, [(a, .1 + i * 3.5, .32, 1)
          for i, group in enumerate((("harrow", "calyx", "ant", "spider"), ("crawler", "spitter", "hornet", "boss"),
                                    ("boss-linked", "boss-separated", "spitter", "harrow"))) for a in group]),
        ("boss-states.wav", 9, [(a, .1 + i * 3, .62, 0)
          for i, a in enumerate(("boss", "boss-linked", "boss-separated"))]),
    ]
    for name, duration, cues in mixes:
        mix = np.zeros(round(duration * RATE))
        for kind, at, gain, variant in cues:
            start = round(at * RATE)
            x = voices[kind, variant]
            mix[start:start + len(x)] += x * gain
        assert np.max(np.abs(mix)) < 1
        item = v2.save(name, mix)
        item["cues"] = [{"kind": k, "at": a, "gain": g, "variant": v} for k, a, g, v in cues]
        manifest["auditions"].append(item)
    (OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    (OUT / "CREDITS.txt").write_text("SWARM FRONT ANOMALY ボイス v3\n独自の数式・ノイズ合成。外部サンプル、人物音声、生成AI、外部APIは不使用。クレジット消費0。\n再生成: python scripts/generate-anomaly-voices-v3.py (Python 3.12 / NumPy / v2スクリプト併用)\nPRISM改訂と連結個体2状態を追加。採用済み7系統はv2と同一。\n", encoding='utf-8')
    print(json.dumps({"voices": len(manifest["files"]), "auditions": len(manifest["auditions"]), "path": str(OUT)}))


if __name__ == '__main__':
    main()
