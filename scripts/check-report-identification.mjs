import { chromium } from "@playwright/test";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const base = process.argv[2] || "http://127.0.0.1:5216/";
const out =
  process.argv[3] || "docs/evidence/enemy-report-intro-20261116/local";
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
let currentPage;
try {
  // 実装のfreshProgressをそのまま検証fixture化する。製品配信への差し込みは行わない。
  const generated = await build({
    entryPoints: ["src/client/progression-save.ts"],
    bundle: true,
    platform: "node",
    format: "cjs",
    write: false,
  });
  const mod = { exports: {} };
  new Function("module", "exports", "require", generated.outputFiles[0].text)(
    mod,
    mod.exports,
    require,
  );
  fixture = mod.exports.freshProgress("normal");
  for (const [voice, mode] of [
    ...voices.map((v) => [v, "solo"]),
    ["hiromi", "coop"],
    ["hiromi", "unknown"],
    ["hiromi", "missing"],
    ["hiromi", "disabled"],
    ["hiromi", "oldpack"],
    ["hiromi", "corrupt"],
  ].filter(
    ([, mode]) => !process.env.REPORT_CASE || process.env.REPORT_CASE === mode,
  )) {
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
          mode === "corrupt" ? "{broken" : JSON.stringify(save),
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
        window.played = [];
        window.ended = [];
        window.rejected = [];
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
            this.addEventListener(
              "playing",
              () => window.played.push(this.src),
              { once: true },
            );
            this.addEventListener("ended", () => window.ended.push(this.src), {
              once: true,
            });
            window.live.add(this);
            window.maxLive = Math.max(window.maxLive, window.live.size);
            this.addEventListener("ended", () => window.live.delete(this), {
              once: true,
            });
          }
          const promise = play.apply(this, args);
          if (this.src.startsWith("blob:"))
            promise?.catch((e) => window.rejected.push(e.message));
          return promise;
        };
        HTMLMediaElement.prototype.pause = function (...args) {
          window.live.delete(this);
          return pause.apply(this, args);
        };
      },
      { voice, mode, save },
    );
    const p = await context.newPage();
    currentPage = p;
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
      await p.evaluate(
        async ({ voice, mode }) => {
          const path = `assets/voice-packs/control-voice-${voice}-v${mode === "oldpack" ? 3 : 4}.bin`;
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
        },
        { voice, mode },
      );
    }
    await p.getByText("TAP START", { exact: true }).click();
    await q("#open-bestiary").waitFor();
    await q(".title-entry").waitFor({ state: "detached" });
    await p.waitForTimeout(700);
    // 既存home発話をレポート側の集計から分離する。
    await p.evaluate(() => {
      window.starts = [];
      window.played = [];
      window.ended = [];
      window.maxLive = window.live.size;
    });
    const before = await p.evaluate(() =>
      localStorage.getItem("swarm-front-shared-progress-v3"),
    );
    await q("#open-bestiary").click({ delay: 100 });
    await p.waitForTimeout(1000);
    await p.waitForFunction(
      () => document.querySelector("dialog.bestiary")?.open,
    );
    const guidance =
      "ここはエネミーレポートです。会敵したANOMALYのデータを照会できます。左のメニューからANOMALYを選択してください。";
    async function checkEmpty() {
      assert.equal(await q("[data-enemy][aria-pressed=true]").count(), 0);
      assert.equal(await q(".enemy-description").textContent(), guidance);
      assert.equal(await q(".specimen").isVisible(), false);
      assert.equal(await q(".enemy-description").isVisible(), true);
    }
    await checkEmpty();
    const introSpeaking = !["missing", "disabled", "oldpack"].includes(mode);
    const introPack = await readFile(
      `public/assets/voice-packs/control-voice-${voice}-v4.bin`,
    );
    const introN = introPack.readUInt32LE(8);
    const introClip = JSON.parse(
      introPack.subarray(12, 12 + introN),
    ).clips.find(
      (c) => c.key === `voice-control-${voice}-v1/enemy-report-intro`,
    );
    const introHash = sha(
      introPack.subarray(
        12 + introN + introClip.offset,
        12 + introN + introClip.offset + introClip.length,
      ),
    );
    async function checkIntro() {
      if (introSpeaking) {
        await p.waitForFunction(() => window.played.length === 1);
        const actual = await p.evaluate(async () =>
          [
            ...new Uint8Array(
              await crypto.subtle.digest(
                "SHA-256",
                await window.blobs.get(window.starts[0].url).arrayBuffer(),
              ),
            ),
          ]
            .map((x) => x.toString(16).padStart(2, "0"))
            .join(""),
        );
        assert.equal(actual, introHash);
      } else {
        await p.waitForTimeout(500);
        assert.equal(await p.evaluate(() => window.starts.length), 0);
      }
    }
    async function resetEvents() {
      await p.evaluate(() => {
        window.starts = [];
        window.played = [];
        window.ended = [];
      });
    }
    await checkIntro();
    // 再描画・一覧スクロール・自然終了でも導入を繰り返さない。
    await q(".enemy-list").evaluate((el) => {
      el.scrollTop = 50;
      el.dispatchEvent(new Event("scroll"));
    });
    await p.setViewportSize({ width: 1280, height: 720 });
    await p.setViewportSize({ width: 844, height: 390 });
    await checkEmpty();
    await p.screenshot({ path: `${out}/${voice}-${mode}-intro.png` });
    if (introSpeaking) await p.waitForFunction(() => window.ended.length === 1);
    await p.waitForTimeout(300);
    assert.equal(
      await p.evaluate(() => window.starts.length),
      introSpeaking ? 1 : 0,
    );
    // 再遷移では一度再生し、閉じたら止まる。
    await q("#report-close").click({ delay: 100 });
    await p.waitForTimeout(1000);
    await q(".bestiary").waitFor({ state: "detached" });
    await resetEvents();
    await q("#open-bestiary").click({ delay: 100 });
    await p.waitForTimeout(1000);
    await checkEmpty();
    await checkIntro();
    await q("#report-close").click({ delay: 100 });
    await p.waitForTimeout(1000);
    await q(".bestiary").waitFor({ state: "detached" });
    assert.equal(await p.evaluate(() => window.live.size), 0);
    await resetEvents();
    // 導入中の最初の項目選択で停止し、以降の10種に干渉しない。
    await q("#open-bestiary").click({ delay: 100 });
    await p.waitForTimeout(1000);
    await checkEmpty();
    await checkIntro();
    const introURL = await p.evaluate(() => window.starts[0]?.url);
    await resetEvents();
    const speaking = mode === "solo";
    const map = {
      crawler: "pleat",
      ant: "volley",
      spider: "leaper",
      spitter: "prism",
      boss: "foundry",
      hornet: "ray",
      bastion: "bastion",
      worm: "catena",
      calyx: "calyx",
      harrow: "harrow",
    };
    const pack = await readFile(
      `public/assets/voice-packs/control-voice-${voice}-v4.bin`,
    );
    const n = pack.readUInt32LE(8),
      index = JSON.parse(pack.subarray(12, 12 + n));
    const clipHashes = [];
    for (const [i, key] of keys.entries()) {
      const row = q(`[data-enemy="${key}"]`);
      // 初期項目PLEATも含め、キーボード確定後の選択状態を照合する。
      await row.click();
      await row.press("Enter");
      console.log(
        JSON.stringify({
          voice,
          mode,
          selecting: key,
          selected: await q("[data-enemy][aria-pressed=true]").getAttribute(
            "data-enemy",
          ),
        }),
      );
      await p.waitForFunction(
        (key) =>
          document
            .querySelector(`[data-enemy="${key}"]`)
            ?.getAttribute("aria-pressed") === "true",
        key,
      );
      if (i === 0)
        assert.equal(
          await p.evaluate(
            (url) => [...window.live].some((a) => a.src === url),
            introURL,
          ),
          false,
        );
      if (speaking) {
        await p.waitForFunction(
          (count) => window.starts.length === count,
          i + 1,
        );
        await p.waitForFunction(
          (count) => window.played.length === count,
          i + 1,
        );
        const clipHash = await p.evaluate(async (i) => {
          const bytes = await window.blobs
            .get(window.starts[i].url)
            .arrayBuffer();
          return [
            ...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
          ]
            .map((x) => x.toString(16).padStart(2, "0"))
            .join("");
        }, i);
        const clip = index.clips.find(
          (c) => c.key === `voice-control-${voice}-v1/anomaly-${map[key]}`,
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
        clipHashes.push({ key, id: `anomaly-${map[key]}`, sha256: clipHash });
        assert.equal(await p.evaluate((i) => window.starts[i].loop, i), false);
        // 再生中の連打も自然終了後の再選択も追加再生にならない。
        await row.press("Enter");
        await p.waitForFunction(
          (count) => window.ended.length === count,
          i + 1,
        );
        await row.press("Enter");
      }
      await p.waitForTimeout(300);
      assert.equal(
        await p.evaluate(() => window.starts.length),
        speaking ? i + 1 : 0,
      );
      assert.equal(
        await q(".enemy-description h3").textContent(),
        ["coop", "unknown", "corrupt"].includes(mode)
          ? "？？？"
          : {
              crawler: "PLEAT",
              ant: "HOUND / VOLLEY",
              spider: "HOUND / LEAPER",
              spitter: "PRISM",
              boss: "FOUNDRY ZERO",
              hornet: "RAY",
              bastion: "BASTION",
              worm: "CATENA",
              calyx: "CALYX",
              harrow: "HARROW",
            }[key],
      );
    }
    if (["coop", "unknown", "corrupt"].includes(mode)) {
      assert.equal(
        await q(".enemy-viewport").evaluate((el) => el.style.filter),
        mode === "coop" ? "brightness(0)" : "",
      );
      if (mode !== "coop")
        assert.equal(
          await q(".enemy-viewport").getAttribute("data-asset"),
          "locked",
        );
    }
    await p.screenshot({ path: `${out}/${voice}-${mode}-844.png` });
    if (speaking) {
      await q('[data-enemy="calyx"]').press("Enter");
      await p.waitForFunction(() => window.played.length === 11);
      // 発話中に別の選択へ移ると、古い音声は即座に停止する。
      await q('[data-enemy="crawler"]').press("Enter");
      await p.waitForFunction(() => window.played.length === 12);
      assert.ok(await p.evaluate(() => window.live.size <= 1));
      assert.equal(
        await p.evaluate(() =>
          [...window.live].some((a) => a.src === window.starts[10].url),
        ),
        false,
      );
    }
    await q("#report-close").click({ delay: 100 });
    await p.waitForTimeout(1000);
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
    assert.deepEqual(await p.evaluate(() => window.rejected), []);
    assert.equal(network.length, mode === "missing" ? 0 : 1); // 検証fixtureの明示取得だけ。レポートから通信しない。
    results.push({
      voice,
      mode,
      intro: {
        included: true,
        sha256: introHash,
        played: introSpeaking,
        transitions: 3,
        guidance: true,
        unselected: true,
        stopped: true,
      },
      clipHashes,
      starts: await p.evaluate(() => window.starts.length),
      maxLive: await p.evaluate(() => window.maxLive),
      playing: await p.evaluate(() => window.played.length),
      ended: await p.evaluate(() => window.ended.length),
      rejected: await p.evaluate(() => window.rejected),
      chromeVersion: browser.version(),
      network,
      errors,
    });
    await writeFile(
      `${out}/case-${voice}-${mode}.json`,
      JSON.stringify(results.at(-1), null, 2) + "\n",
    );
    console.log(JSON.stringify({ completed: true, voice, mode }));
    await context.close();
  }
  await writeFile(
    `${out}/results-${process.env.REPORT_CASE || "all"}.json`,
    JSON.stringify({ base, passed: true, results }, null, 2) + "\n",
  );
  console.log(JSON.stringify({ passed: true, cases: results.length }));
} catch (error) {
  if (currentPage && !currentPage.isClosed()) {
    await currentPage.screenshot({ path: `${out}/failed.png` });
    await writeFile(
      `${out}/failed.json`,
      JSON.stringify(
        await currentPage.evaluate(() => ({
          text: document.body.innerText,
          starts: window.starts,
          played: window.played,
          ended: window.ended,
          rejected: window.rejected,
          live: window.live.size,
          active: document.activeElement?.outerHTML,
          dialogs: document.querySelectorAll("dialog").length,
        })),
        null,
        2,
      ),
    );
  }
  throw error;
} finally {
  await browser.close();
}
