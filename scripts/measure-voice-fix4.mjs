import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
const b = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--autoplay-policy=no-user-gesture-required"],
});
const p = await b.newPage();
p.on("console", (m) => console.log(m.text()));
p.on("pageerror", (e) => console.log(e.message));
await p.route("**/voice-probe", (r) =>
  r.fulfill({ contentType: "text/html", body: "<button>検証</button>" }),
);
await p.goto("http://127.0.0.1:5204/voice-probe");
const results = [];
for (const delay of [0, 1800]) {
  await p.route("**/assets/audio/se-v1/menu.wav", async (r) => {
    await new Promise((ok) => setTimeout(ok, delay));
    await r.continue();
  });
  results.push(
    await p.evaluate(async (delay) => {
      console.log("import");
      const { Sound } = await import("/src/client/audio.ts");
      const { controlVoicePacks: packs } =
        await import("/src/client/control-voice-packs.ts");
      console.log("download");
      await packs.download("hiromi");
      console.log("downloaded");
      const events = [];
      const old = AudioBufferSourceNode.prototype.start;
      AudioBufferSourceNode.prototype.start = function (...a) {
        if (this.buffer?.duration > 1)
          events.push({
            at: performance.now(),
            duration: this.buffer.duration,
          });
        return old.apply(this, a);
      };
      const s = new Sound();
      s.unlock();
      const t = performance.now();
      const result = await s.say("home");
      console.log("said", result);
      await new Promise((r) => setTimeout(r, 100));
      const elapsed = events.length ? events[0].at - t : null;
      await s.prepareControlVoice(["tut-intro", "tut-base"]);
      s.controlVoice.stop();
      const trigger = performance.now();
      s.controlVoice.request("tut-intro");
      const second = s.controlVoice.request("tut-base");
      await new Promise((r) => setTimeout(r, 1100));
      const waiting = s.controlVoice.waiting;
      const context = s.context;
      s.stop();
      AudioBufferSourceNode.prototype.start = old;
      return {
        delay,
        result,
        elapsed,
        second,
        waiting,
        events,
        trigger,
        contextsSame: context === s.context,
      };
    }, delay),
  );
  await p.unroute("**/assets/audio/se-v1/menu.wav");
}
await mkdir("docs/evidence/voice-fix4-20261115", { recursive: true });
await writeFile(
  "docs/evidence/voice-fix4-20261115/fixed.json",
  JSON.stringify(results, null, 2),
);
console.log(JSON.stringify(results));
await b.close();
