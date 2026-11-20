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
    await q("#open-bestiary").press("Enter");
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

    await p.evaluate(()=>{ window.uiEvents=[]; for(const type of ["click","keydown","keyup"]) document.addEventListener(type,e=>window.uiEvents.push({type,key:e.key,target:e.target.id,prevented:e.defaultPrevented}),true); });
    const snap=async(label)=>console.log(JSON.stringify({label,state:await p.evaluate(()=>({dialogs:document.querySelectorAll("dialog").length, active:document.activeElement?.id,events:window.uiEvents,live:window.live.size,starts:window.starts.length}))}));
    await snap("initial");
    for(const [selector,action] of [["#report-close","click"],["#open-bestiary","click"],["#report-close","enter"],["#open-bestiary","enter"]]) {
      if(action==="click") await q(selector).click({delay:100}); else await q(selector).press("Enter");
      await p.waitForTimeout(1000); await snap(selector+action);
    }
    await p.screenshot({path:`${out}/diagnostic.png`});
    await context.close();
    break;
  }
} finally { await browser.close(); }
