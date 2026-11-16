import { chromium } from "@playwright/test";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const base = process.argv[2] || "http://127.0.0.1:5216/";
const out =
  process.argv[3] || "docs/evidence/enemy-report-idname-20261116/local";
await mkdir(out, { recursive: true });
const sha = (b) => createHash("sha256").update(b).digest("hex");
const voices = ["hiromi", "hiyori", "yoko"];
const keys = [
  "crawler",
  "ant",
  "spider",
  "spitter",
  "boss",
  "hornet",
  "bastion",
  "worm",
  "calyx",
  "harrow",
];
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const results = [];
let fixture;
try {
  const seed = await browser.newPage();
  await seed.goto("http://127.0.0.1:5216/front.html", {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  fixture = await seed.evaluate(async () => {
    const { freshProgress } = await import("/src/client/progression-save.ts");
    return freshProgress("normal");
  });
  await seed.close();
  for (const [voice, mode] of [
    ...voices.map((v) => [v, "solo"]),
    ["hiromi", "coop"],
    ["hiromi", "unknown"],
    ["hiromi", "missing"],
    ["hiromi", "disabled"],
  ]) {
    const context = await browser.newContext({
      viewport: { width: 844, height: 390 },
      serviceWorkers: "block",
    });
    const save = structuredClone(fixture);
    save.encounters = Object.fromEntries(
      keys
        .filter(() => mode !== "unknown")
        .map((k) => [k, mode === "coop" ? "coop" : "solo"]),
    );
    await context.addInitScript(
      ({ voice, mode, save }) => {
        localStorage.setItem(
          "swarm-front-shared-progress-v3",
          JSON.stringify(save),
        );
        localStorage.setItem("swarm-front-control-voice-v1", voice);
        localStorage.setItem(
          "swarm-front-control-voice-unlocks-v1",
          JSON.stringify(["hiromi", "hiyori", "yoko"]),
        );
        localStorage.setItem(
          "swarm-front-control-voice-enabled-v1",
          String(mode !== "disabled"),
        );
        window.starts = [];
        window.live = new Set();
        window.maxLive = 0;
        window.blobs = new Map();
        const objectURL = URL.createObjectURL;
        URL.createObjectURL = function (blob) {
          const url = objectURL.call(this, blob);
          window.blobs.set(url, blob);
          return url;
        };
        const play = HTMLMediaElement.prototype.play,
          pause = HTMLMediaElement.prototype.pause;
        HTMLMediaElement.prototype.play = function (...args) {
          if (this.src.startsWith("blob:")) {
            window.starts.push({ url: this.src, loop: this.loop });
            window.live.add(this);
            window.maxLive = Math.max(window.maxLive, window.live.size);
            this.addEventListener("ended", () => window.live.delete(this), {
              once: true,
            });
          }
          return play.apply(this, args);
        };
        HTMLMediaElement.prototype.pause = function (...args) {
          window.live.delete(this);
          return pause.apply(this, args);
        };
      },
      { voice, mode, save },
    );
    const p = await context.newPage();
    const errors = [];
    const network = [];
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("request", (r) => {
      if (r.url().includes("voice-packs/")) network.push(r.url());
    });
    const q = (s) => p.locator("css:light=" + s);
    p.setDefaultTimeout(60000);
    await p.goto(new URL("front.html", base).href, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
    if (mode !== "missing") {
      await p.evaluate(async (voice) => {
        const path = `assets/voice-packs/control-voice-${voice}-v2.bin`;
        const response = await fetch(new URL(path, location.href));
        const bytes = await response.arrayBuffer();
        const hash = [
          ...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
        ]
          .map((x) => x.toString(16).padStart(2, "0"))
          .join("");
        await (
          await caches.open("swarm-front-voice-packs-v1")
        ).put(
          new URL(path, location.href).href,
          new Response(bytes, {
            headers: { "x-swarm-voice-pack-sha256": hash },
          }),
        );
      }, voice);
    }
    await p.getByText("TAP START", { exact: true }).click();
    await q("#open-bestiary").waitFor();
    await q(".title-entry").waitFor({ state: "detached" });
    await p.waitForTimeout(700);
    // 既存home発話をレポート側の集計から分離する。
    await p.evaluate(() => {
      window.starts = [];
      window.maxLive = window.live.size;
    });
    const before = await p.evaluate(() =>
      localStorage.getItem("swarm-front-shared-progress-v3"),
    );
    await q("#open-bestiary").click();
    await p.waitForFunction(
      () => document.querySelector("dialog.bestiary")?.open,
    );
    await p.waitForTimeout(300);
    await q('[data-enemy="calyx"]').click();
    if (mode === "unknown") await q('[data-enemy="calyx"]').press("Enter");
    assert.equal(
      await q("[data-enemy][aria-pressed=true]").getAttribute("data-enemy"),
      "calyx",
    );
    const speaking = mode === "solo";
    if (speaking) await p.waitForFunction(() => window.starts.length === 1);
    else await p.waitForTimeout(350);
    assert.equal(
      await q(".enemy-description h3").textContent(),
      mode === "coop" || mode === "unknown" ? "？？？" : "CALYX",
    );
    assert.equal(
      await p.evaluate(() => window.starts.length),
      speaking ? 1 : 0,
    );
    let clipHash;
    if (speaking) {
      clipHash = await p.evaluate(async () => {
        const b = await window.blobs.get(window.starts[0].url).arrayBuffer();
        return [...new Uint8Array(await crypto.subtle.digest("SHA-256", b))]
          .map((x) => x.toString(16).padStart(2, "0"))
          .join("");
      });
      const pack = await readFile(
        `public/assets/voice-packs/control-voice-${voice}-v2.bin`,
      );
      const n = pack.readUInt32LE(8),
        index = JSON.parse(pack.subarray(12, 12 + n));
      const clip = index.clips.find(
        (c) => c.key === `voice-control-${voice}-v1/anomaly-calyx`,
      );
      assert.equal(
        clipHash,
        sha(
          pack.subarray(
            12 + n + clip.offset,
            12 + n + clip.offset + clip.length,
          ),
        ),
      );
      assert.equal(await p.evaluate(() => window.starts[0].loop), false);
      await p.waitForFunction(() => window.live.size === 0);
      // 自然終了後にも再要求・モーション操作・時間経過でループしない。
      await q('[data-enemy="calyx"]').click();
      await p.waitForTimeout(250);
      assert.equal(await p.evaluate(() => window.starts.length), 1);
    }
    if (voice === "hiromi" && (mode === "solo" || mode === "coop"))
      await p.screenshot({ path: `${out}/${mode}-844.png` });
    for (const key of keys.filter((k) => k !== "calyx"))
      await q(`[data-enemy="${key}"]`).click();
    await p.waitForTimeout(250);
    assert.equal(
      await p.evaluate(() => window.starts.length),
      speaking ? 1 : 0,
    );
    if (speaking) {
      await q('[data-enemy="calyx"]').click();
      await p.waitForFunction(() => window.starts.length === 2);
      await q('[data-enemy="harrow"]').click();
      assert.equal(await p.evaluate(() => window.live.size), 0);
      // 既存キューの250ms重複抑制を維持する。
      await p.waitForTimeout(300);
      await q('[data-enemy="calyx"]').click();
      await p.waitForFunction(() => window.starts.length === 3);
    }
    await q("#report-close").click();
    await q(".bestiary").waitFor({ state: "detached" });
    assert.equal(await p.evaluate(() => window.live.size), 0);
    assert.equal(
      await p.evaluate(() =>
        localStorage.getItem("swarm-front-shared-progress-v3"),
      ),
      before,
    );
    assert.equal(await q(".control-caption").count(), 0);
    assert.ok(await p.evaluate(() => window.maxLive <= 1));
    assert.deepEqual(errors, []);
    assert.equal(network.length, mode === "missing" ? 0 : 1); // 検証fixtureの明示取得だけ。レポートから通信しない。
    results.push({
      voice,
      mode,
      clipHash,
      starts: await p.evaluate(() => window.starts.length),
      maxLive: await p.evaluate(() => window.maxLive),
      network,
      errors,
    });
    await context.close();
  }
  await writeFile(
    `${out}/results.json`,
    JSON.stringify({ base, passed: true, results }, null, 2) + "\n",
  );
  console.log(JSON.stringify({ passed: true, cases: results.length }));
} finally {
  await browser.close();
}
