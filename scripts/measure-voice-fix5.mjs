// 実Chromeの管制AI出力を録音し、時間と自己相関による基本周波数を測る。
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const out = "docs/evidence/voice-fix5-20261115";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--autoplay-policy=no-user-gesture-required"],
});
const page = await browser.newPage();
await page.route("**/voice-probe", (r) =>
  r.fulfill({ contentType: "text/html", body: "<button>測定</button>" }),
);
await page.goto("http://127.0.0.1:5206/voice-probe");
const result = {
  browser: await browser.version(),
  measurements: [],
  errors: [],
};
page.on("pageerror", (e) => result.errors.push(e.message));
try {
  for (const kind of [
    "tone",
    "tone-unpreserved",
    "preview",
    "retire-ack",
    "tut-intro",
  ]) {
    for (const rate of [1, 1.3]) {
      const capture = await page.evaluate(
        async ({ kind, rate }) => {
          const { Sound } = await import("/src/client/audio.ts");
          const { controlVoicePacks: packs } =
            await import("/src/client/control-voice-packs.ts");
          await packs.download("hiromi");
          const wav = new ArrayBuffer(44 + 44100 * 3 * 2),
            v = new DataView(wav);
          const str = (at, s) =>
            [...s].forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0)));
          str(0, "RIFF");
          v.setUint32(4, wav.byteLength - 8, true);
          str(8, "WAVEfmt ");
          v.setUint32(16, 16, true);
          v.setUint16(20, 1, true);
          v.setUint16(22, 1, true);
          v.setUint32(24, 44100, true);
          v.setUint32(28, 88200, true);
          v.setUint16(32, 2, true);
          v.setUint16(34, 16, true);
          str(36, "data");
          v.setUint32(40, wav.byteLength - 44, true);
          for (let i = 0; i < 44100 * 3; i++)
            v.setInt16(
              44 + i * 2,
              10000 * Math.sin((2 * Math.PI * 220 * i) / 44100),
              true,
            );
          const s = kind.startsWith("tone")
            ? new Sound({ subscribe: () => () => {}, clip: async () => wav })
            : new Sound();
          s.setControlVoice("hiromi");
          s.setVolumes(1, 0, 0);
          s.controlVoiceVolume = 1;
          s.setControlVoiceRate(rate);
          s.unlock();
          const ctx = s.context,
            chunks = [];
          const recorder = ctx.createScriptProcessor(2048, 1, 1);
          recorder.onaudioprocess = (e) =>
            chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
          recorder.connect(ctx.destination);
          const original = ctx.createMediaElementSource.bind(ctx);
          let ended, audio, start, end;
          const finished = new Promise((r) => (ended = r));
          ctx.createMediaElementSource = (a) => {
            audio = a;
            if (kind === "tone-unpreserved") {
              const play = a.play.bind(a);
              a.play = () => {
                a.preservesPitch = false;
                return play();
              };
            }
            a.addEventListener("playing", () => (start = performance.now()), {
              once: true,
            });
            a.addEventListener(
              "ended",
              () => {
                end = performance.now();
                ended();
              },
              { once: true },
            );
            const node = original(a);
            node.connect(recorder);
            return node;
          };
          const id =
            kind.startsWith("tone") || kind === "preview" ? "home" : kind;
          await s.prepareControlVoice([id]);
          if (kind === "preview") await s.previewControlVoice("hiromi");
          else await s.say(id);
          await Promise.race([
            finished,
            new Promise((_, reject) =>
              setTimeout(() => reject(Error("音声終了待ち超過")), 25000),
            ),
          ]);
          await new Promise((r) => setTimeout(r, 100));
          recorder.disconnect();
          s.stop();
          const samples = Float32Array.from(
            chunks.flatMap((c) => Array.from(c)),
          );
          const f0 = [];
          // 40ms窓、20ms間隔、80〜450Hz。正規化自己相関の最初の強い局所最大。
          const size = Math.round(ctx.sampleRate * 0.04),
            hop = Math.round(ctx.sampleRate * 0.02);
          for (let at = 0; at + size < samples.length; at += hop) {
            let energy = 0;
            for (let i = 0; i < size; i++) energy += samples[at + i] ** 2;
            if (energy / size < 0.0001) continue;
            const scores = [];
            let best = 0;
            const min = Math.floor(ctx.sampleRate / 450),
              max = Math.ceil(ctx.sampleRate / 80);
            for (let lag = min; lag <= max; lag++) {
              let xy = 0,
                xx = 0,
                yy = 0;
              for (let i = 0; i < size - lag; i++) {
                const x = samples[at + i],
                  y = samples[at + i + lag];
                xy += x * y;
                xx += x * x;
                yy += y * y;
              }
              const corr = xy / Math.sqrt(xx * yy);
              scores[lag] = corr;
              best = Math.max(best, corr);
            }
            if (best < 0.75) continue;
            for (let lag = min + 1; lag < max; lag++)
              if (
                scores[lag] >= best * 0.94 &&
                scores[lag] > scores[lag - 1] &&
                scores[lag] >= scores[lag + 1]
              ) {
                f0.push(ctx.sampleRate / lag);
                break;
              }
          }
          f0.sort((a, b) => a - b);
          const metadata = {
            kind,
            rate,
            preservesPitch: audio.preservesPitch,
            elapsedMs: end - start,
            sampleRate: ctx.sampleRate,
            frames: samples.length,
            voicedWindows: f0.length,
            medianHz: f0[Math.floor(f0.length / 2)],
            p10Hz: f0[Math.floor(f0.length * 0.1)],
            p90Hz: f0[Math.floor(f0.length * 0.9)],
          };
          await ctx.close();
          return { metadata, samples: Array.from(samples) };
        },
        { kind, rate },
      );
      const { metadata: m, samples } = capture;
      const wav = Buffer.alloc(44 + samples.length * 2);
      wav.write("RIFF");
      wav.writeUInt32LE(wav.length - 8, 4);
      wav.write("WAVEfmt ", 8);
      wav.writeUInt32LE(16, 16);
      wav.writeUInt16LE(1, 20);
      wav.writeUInt16LE(1, 22);
      wav.writeUInt32LE(m.sampleRate, 24);
      wav.writeUInt32LE(m.sampleRate * 2, 28);
      wav.writeUInt16LE(2, 32);
      wav.writeUInt16LE(16, 34);
      wav.write("data", 36);
      wav.writeUInt32LE(wav.length - 44, 40);
      samples.forEach((x, i) =>
        wav.writeInt16LE(
          Math.round(Math.max(-1, Math.min(1, x)) * 32767),
          44 + i * 2,
        ),
      );
      await writeFile(`${out}/${kind}-${rate}.wav`, wav);
      result.measurements.push(m);
      console.log(JSON.stringify(m));
    }
  }
  for (const kind of ["tone", "preview", "retire-ack", "tut-intro"]) {
    const [normal, fast] = result.measurements.filter((x) => x.kind === kind);
    const pitchRatio = fast.medianHz / normal.medianHz;
    const durationRatio = normal.frames / fast.frames;
    assert.ok(Math.abs(pitchRatio - 1) < 0.06, `${kind}: pitch ${pitchRatio}`);
    assert.ok(
      Math.abs(durationRatio - 1.3) < 0.08,
      `${kind}: duration ${durationRatio}`,
    );
    assert.ok(fast.preservesPitch);
  }
  const control = result.measurements.filter(
    (x) => x.kind === "tone-unpreserved",
  );
  assert.ok(Math.abs(control[1].medianHz / control[0].medianHz - 1.3) < 0.02);
  result.passed = true;
  assert.deepEqual(result.errors, []);
} finally {
  await writeFile(`${out}/pitch.json`, JSON.stringify(result, null, 2));
  await browser.close();
}
