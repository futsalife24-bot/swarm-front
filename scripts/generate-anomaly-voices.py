"""Render original non-verbal monster calls. No samples, speech or external API.

The glottal source, turbulent breath, vocal-tract resonances and hard-shell
resonances are synthesized independently. Fixed seeds make every WAV reproducible.
"""
import hashlib
import json
import math
from pathlib import Path
import random
import struct
import wave

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public/assets/audio/anomaly-voice-v1"
RATE = 32000
# kind: duration, fundamental, pitch contour, formants, breath, irregularity
PROFILES = {
    "harrow": (1.65, 93, (0.75, 1.9, 0.72), (390, 1120, 2310), 0.29, 0.36),
    "calyx": (1.85, 124, (0.72, 1.25, 0.82), (280, 720, 1640), 0.55, 0.13),
    "ant": (1.10, 142, (1.18, 0.78, 0.70), (540, 1410, 2680), 0.22, 0.27),
    "spider": (1.30, 188, (0.72, 1.65, 0.83), (610, 1630, 3100), 0.29, 0.32),
    "crawler": (1.45, 57, (0.95, 0.77, 0.61), (220, 570, 1240), 0.37, 0.46),
    "spitter": (1.55, 226, (0.76, 1.33, 0.98), (790, 1820, 3250), 0.12, 0.05),
    "hornet": (1.70, 290, (0.62, 1.46, 0.69), (930, 2110, 3560), 0.30, 0.08),
    "boss": (2.05, 42, (0.78, 1.03, 0.62), (145, 440, 910), 0.43, 0.37),
}


def resonator(signal, frequency, bandwidth):
    r = math.exp(-math.pi * bandwidth / RATE)
    a = 2 * r * math.cos(2 * math.pi * frequency / RATE)
    b = r * r
    y1 = y2 = 0.0
    out = []
    for x in signal:
        y = (1 - r) * x + a * y1 - b * y2
        y2, y1 = y1, y
        out.append(y)
    return out


def render(kind, variant):
    duration, f0, contour, formants, breath, irregularity = PROFILES[kind]
    seed = int.from_bytes(hashlib.sha256(f"swarm-anomaly-v1:{kind}:{variant}".encode()).digest()[:8], "big")
    rng = random.Random(seed)
    n = round(duration * RATE)
    phase = subphase = 0.0
    turbulence = 0.0
    source, envelope, shell = [], [], []
    pitch = 1.0 if variant == 0 else 0.91
    for i in range(n):
        t, u = i / RATE, i / (n - 1)
        # Two connected pitch gestures, not a stationary synthesizer note.
        f = contour[0] + (contour[1] - contour[0]) * min(1, u / 0.32)
        if u > 0.32:
            f = contour[1] + (contour[2] - contour[1]) * ((u - 0.32) / 0.68)
        jitter = irregularity * (0.22 * math.sin(t * 121) + 0.17 * math.sin(t * 47.3))
        frequency = f0 * pitch * f * (1 + jitter)
        phase += frequency / RATE
        subphase += frequency * 0.499 / RATE
        p = phase % 1
        # Asymmetric opening/closure of a fictitious throat with subharmonic fry.
        glottis = math.sin(math.pi * p / 0.42) if p < 0.42 else -0.24 * math.sin(math.pi * (p - 0.42) / 0.58)
        turbulence = 0.76 * turbulence + 0.24 * rng.uniform(-1, 1)
        rough = (1 - irregularity * 0.35) + irregularity * 0.35 * math.sin(t * 2 * math.pi * 31)
        v = (glottis + 0.4 * math.sin(2 * math.pi * subphase)) * rough
        v += breath * (0.6 * rng.uniform(-1, 1) + 1.6 * turbulence)
        env = min(1, t / 0.055) ** 1.2 * max(0, 1 - u) ** 0.72
        env *= 0.65 + 0.35 * math.sin(math.pi * min(1, u / 0.62))
        if kind == "ant":
            env *= 0.12 + 0.88 * (math.exp(-((u - 0.20) / 0.12) ** 4) + 0.80 * math.exp(-((u - 0.65) / 0.18) ** 4))
        if kind == "calyx":
            env *= 0.25 + 0.75 * math.sin(math.pi * u) ** 0.7
        source.append(v)
        envelope.append(env * min(1, (n - 1 - i) / (RATE * 0.09)))
        metal = sum(math.sin(2 * math.pi * frequency * ratio * t + 0.7 * math.sin(t * 17)) / (j + 2)
                    for j, ratio in enumerate((1.0, 1.4142, 2.719)))
        shell.append(metal)
    bands = [resonator(source, f * pitch, 65 + f * 0.07) for f in formants]
    shell_gain = {"spitter": 0.55, "boss": 0.20, "hornet": 0.15}.get(kind, 0.035)
    samples = []
    for i in range(n):
        throat = 1.9 * bands[0][i] + bands[1][i] + 0.55 * bands[2][i] + 0.10 * source[i]
        samples.append(math.tanh(throat * 1.8 + shell_gain * shell[i]) * envelope[i])
    # Short resonant cavity, followed by a guaranteed silent endpoint.
    delay = round(RATE * (0.027 if kind != "boss" else 0.049))
    for i in range(n - 1, delay - 1, -1):
        samples[i] += 0.14 * samples[i - delay] * (1 - i / n)
    peak = max(abs(x) for x in samples)
    samples = [x / peak * 0.69 for x in samples]
    samples[0] = samples[-1] = 0.0
    return samples


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = {"method": "original procedural vocal synthesis", "external_samples": False,
                "ai_generation": False, "credits_spent": 0, "sample_rate": RATE, "files": []}
    for kind in PROFILES:
        for variant in (0, 1):
            samples = render(kind, variant)
            name = f"{kind}-{variant}.wav"
            path = OUT / name
            with wave.open(str(path), "wb") as audio:
                audio.setnchannels(1)
                audio.setsampwidth(2)
                audio.setframerate(RATE)
                audio.writeframes(struct.pack(f"<{len(samples)}h", *(round(x * 32767) for x in samples)))
            rms = math.sqrt(sum(x * x for x in samples) / len(samples))
            manifest["files"].append({"file": name, "seconds": len(samples) / RATE,
                "peak_dbfs": round(20 * math.log10(max(abs(x) for x in samples)), 2),
                "rms_dbfs": round(20 * math.log10(rms), 2),
                "sha256": hashlib.sha256(path.read_bytes()).hexdigest()})
    (OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"rendered": len(manifest["files"]), "path": str(OUT), "credits_spent": 0}))


if __name__ == "__main__":
    main()
