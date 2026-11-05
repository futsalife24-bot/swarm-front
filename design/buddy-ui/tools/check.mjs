// バディUIの撮影と検査（開発サーバーの起動後に実行）。
// 実行: node design/buddy-ui/tools/check.mjs [http://127.0.0.1:5191]
// 出力: design/buddy-ui/shots/*.png と report.txt
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, "../shots");
fs.mkdirSync(out, { recursive: true });
const base = (process.argv[2] || "http://127.0.0.1:5191") + "/design/buddy-ui/";
const report = [];
const ok = (cond, msg) => {
  report.push(`${cond ? "OK" : "NG"}  ${msg}`.trimEnd());
  if (!cond) console.log("NG", msg);
};
const browser = await chromium.launch({ channel: "chrome" });
const SCENES = [
  "starter",
  "roster",
  "roster-cap",
  "roster-short",
  "roster-max",
  "roster-unowned",
  "recruit",
  "recruit-short",
  "recruit-guarantee",
  "recruit-all",
  "recruit-busy",
  "result-new",
  "result-dup",
  "save-fail",
  "missing",
  "locked",
];

for (const [w, h] of [
  [844, 390],
  [640, 360],
]) {
  for (const reduce of [false, true]) {
    const tag = `${w}x${h}${reduce ? "-reduce" : ""}`;
    const ctx = await browser.newContext({
      viewport: { width: w, height: h },
      hasTouch: true,
      deviceScaleFactor: 1,
      reducedMotion: "no-preference",
    });
    const p = await ctx.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    const open = async (scene, extra = "") => {
      await p.goto(
        `${base}?scene=${scene}&ui=0${reduce ? "&motion=reduce" : ""}${extra}`,
        {
          waitUntil: "load",
          timeout: 240000,
        },
      );
      await p.waitForFunction(
        () => [...document.images].every((i) => i.complete),
        null,
        { timeout: 20000 },
      );
      await p.waitForTimeout(
        scene.startsWith("result") || scene === "save-fail" ? 900 : 250,
      );
    };

    for (const scene of SCENES) {
      await open(scene);
      const r = await p.evaluate(() => {
        const vw = innerWidth,
          vh = innerHeight;
        const root = document.querySelector(".bd-root");
        const rb = root.getBoundingClientRect();
        const scrollers = [
          ...root.querySelectorAll(
            ".bd-detail, .bd-list, .bd-recruit > section, .bd-starter-grid",
          ),
        ].filter((e) => e.scrollHeight > e.clientHeight + 1);
        const buttons = [...root.querySelectorAll("button")].filter(
          (b) => b.offsetParent,
        );
        const small = buttons.filter((b) => {
          const r = b.getBoundingClientRect();
          return r.height < 36 || r.width < 36;
        });
        const off = buttons.filter((b) => {
          const r = b.getBoundingClientRect();
          return (
            r.right > vw + 1 || r.bottom > vh + 1 || r.left < -1 || r.top < -1
          );
        });
        // 1行の文字が箱からはみ出していないか（横）。
        const clipped = [
          ...root.querySelectorAll("strong, small, span, b, p, h2"),
        ].filter(
          (e) =>
            e.offsetParent &&
            e.children.length === 0 &&
            e.scrollWidth > e.clientWidth + 1 &&
            getComputedStyle(e).overflow !== "visible",
        );
        return {
          hscroll: document.documentElement.scrollWidth > vw + 1,
          rootInView: rb.bottom <= vh + 1 && rb.right <= vw + 1,
          rootOverflow: root.scrollHeight > root.clientHeight + 1,
          scrollers: scrollers.map((e) => e.className.split(" ")[0]),
          small: small.map(
            (b) =>
              `${b.textContent.trim().slice(0, 8)}:${Math.round(b.getBoundingClientRect().height)}`,
          ),
          off: off.map((b) => b.textContent.trim().slice(0, 8)),
          clipped: clipped.map((e) => e.textContent.slice(0, 10)),
          broken: [...document.images].filter(
            (i) =>
              !i.naturalWidth &&
              i.closest(".bd-portrait") &&
              !i.src.includes("missing"),
          ).length,
        };
      });
      const bad =
        r.hscroll ||
        !r.rootInView ||
        r.rootOverflow ||
        r.off.length ||
        r.small.length ||
        r.clipped.length ||
        r.broken;
      ok(
        !bad,
        `${tag} ${scene}: はみ出し・欠け・小さい押し所なし${r.scrollers.length ? `（内側スクロールあり: ${r.scrollers.join(",")}）` : ""}${bad ? " " + JSON.stringify(r) : ""}`,
      );
      if (!reduce || ["result-new", "starter"].includes(scene))
        await p.screenshot({ path: `${out}/${tag}-${scene}.png` });
    }

    // 初回選択：選ぶまで確定できず、選んで確定すると編成へ移る。
    await open("starter");
    const disabledFirst = await p
      .locator("[data-bd=starter-confirm]")
      .isDisabled();
    await p.locator('[data-bd=starter-pick][data-id="yosuga"]').tap();
    await p.locator("[data-bd=starter-confirm]").tap();
    await p.waitForSelector('.bd-root[data-view="roster"]', { timeout: 5000 });
    const escort = await p.locator(".bd-row .bd-tag.is-escort").count();
    ok(
      disabledFirst && escort === 1,
      `${tag} 操作: 初回選択は選ぶまで確定不可、確定で同行中になる`,
    );

    // 同行の変更と外す。
    await open("roster");
    await p.locator('[data-bd=focus][data-id="tobari"]').tap();
    await p.locator('[data-bd=equip][data-id="tobari"]').tap();
    await p.waitForFunction(
      () =>
        document.querySelector('[data-bd=focus][data-id="tobari"] .is-escort'),
      null,
      { timeout: 5000 },
    );
    await p.locator('[data-bd=equip][data-id=""]').tap();
    await p.waitForFunction(
      () => !document.querySelector(".bd-row .is-escort"),
      null,
      { timeout: 5000 },
    );
    ok(true, `${tag} 操作: 同行の変更と解除`);

    // 限界突破：上限到達・素材ありで成功、上限が上がる。
    await open("roster-cap");
    await p.locator("[data-bd=breakthrough]").tap();
    await p.waitForFunction(
      () =>
        /10 → 20/.test(document.querySelector(".bd-toast")?.textContent ?? ""),
      null,
      { timeout: 5000 },
    );
    const cap = await p.locator(".bd-growth-lv").innerText();
    ok(
      /\/\s*20/.test(cap),
      `${tag} 操作: 限界突破でLv上限 10→20（${cap.replace(/\s+/g, " ")}）`,
    );

    // 素材不足・上限未到達・最大突破では押せず理由を表示。
    for (const [scene, re] of [
      ["roster-short", /足りません/],
      ["roster", /Lv10で突破/],
      ["roster-max", /最大まで突破済み/],
    ]) {
      await open(scene);
      const dis = await p.locator("[data-bd=breakthrough]").isDisabled();
      const why = await p.locator(".bd-growth").innerText();
      ok(dis && re.test(why), `${tag} ${scene}: 限界突破は押せず理由を表示`);
    }

    // 招集：結果の表示と、所持・チケットの更新。
    await open("recruit");
    const before = await p.locator(".bd-wallet .bd-res-ticket").innerText();
    await p.locator("[data-bd=draw]").tap();
    await p.waitForSelector(".bd-result", { timeout: 5000 });
    const after = await p.locator(".bd-wallet .bd-res-ticket").innerText();
    ok(
      before.trim() === "3" && after.trim() === "2",
      `${tag} 操作: 招集でチケット ${before.trim()}→${after.trim()}、結果を表示`,
    );
    await p.locator("[data-bd=result-close]").tap();
    ok(
      (await p.locator(".bd-result").count()) === 0,
      `${tag} 操作: 結果を閉じると招集画面に戻る`,
    );

    // 不足：押せず、不足枚数と入手方法を表示。
    await open("recruit-short");
    ok(
      (await p.locator("[data-bd=draw]").isDisabled()) &&
        /1枚足りません/.test(await p.locator("[data-bd=draw]").innerText()) &&
        /初回突破/.test(await p.locator(".bd-income").innerText()),
      `${tag} recruit-short: 押せず、不足枚数と入手方法を表示`,
    );

    // 処理中：二重に送らない。
    await open("recruit-busy");
    const busy = await p.locator("[data-bd=draw]").getAttribute("aria-busy");
    await p.locator("[data-bd=draw]").tap({ force: true });
    const ids = await p.evaluate(() => window.__drawIds.length);
    ok(
      busy === "true" && ids === 1,
      `${tag} recruit-busy: 処理中表示・二重送信なし（送信${ids}回）`,
    );

    // 保存失敗：理由と再試行。再試行は同じ要求IDで、成功すると結果を出す。
    await open("save-fail");
    const alert = await p.locator(".bd-failure").innerText();
    await p.locator("[data-bd=retry]").tap();
    await p.waitForSelector(".bd-result", { timeout: 5000 });
    const sameId = await p.evaluate(
      () =>
        window.__drawIds.length === 2 &&
        window.__drawIds[0] === window.__drawIds[1],
    );
    ok(
      /チケットはまだ使われていません/.test(alert) && sameId,
      `${tag} save-fail: 失敗を表示し、同じ要求IDで再試行して成功`,
    );

    // 欠損：立ち絵が無い・読めない時は紋章、出現率が無い時は招集を止める。
    await open("missing");
    const fallback = await p.locator(".bd-portrait.is-fallback").count();
    await p.locator('[data-bd=tab][data-tab="recruit"]').tap();
    if (!reduce)
      await p.screenshot({ path: `${out}/${tag}-missing-recruit.png` });
    ok(
      fallback >= 2 &&
        (await p.locator("[data-bd=draw]").isDisabled()) &&
        (await p.locator(".bd-odds-missing").count()) === 1,
      `${tag} missing: 立ち絵の代わりに紋章（${fallback}箇所）、出現率なしで招集停止`,
    );

    // 変更不可（出撃中など）。
    await open("locked");
    ok(
      (await p.locator("[data-bd=equip]").isDisabled()) &&
        (await p.locator(".bd-locked").count()) > 0,
      `${tag} locked: 同行変更を止め理由を表示`,
    );

    // 動き：結果の登場は通常で短い動き、軽減で動きなし。0.8秒後に動き続けるものはない。
    await open("result-new");
    const anims = await p.evaluate(() => {
      const names = getComputedStyle(
        document.querySelector(".bd-result .bd-portrait"),
      ).animationName;
      return {
        names,
        running: document
          .getAnimations()
          .filter(
            (a) =>
              a.playState === "running" &&
              a.effect?.getComputedTiming().iterations === Infinity,
          ).length,
      };
    });
    ok(
      reduce ? anims.names === "none" : anims.names.includes("bd-reveal"),
      `${tag} 動き: 結果の登場 ${anims.names}`,
    );
    ok(
      anims.running === 0,
      `${tag} 動き: 常時動き続けるアニメーション ${anims.running}件`,
    );

    // 音量0：UIは音を鳴らさずに同じ情報を表示する（音は既存Soundの音量に従う）。
    await open("recruit", "&sound=0");
    await p.locator("[data-bd=draw]").tap();
    await p.waitForSelector(".bd-result", { timeout: 5000 });
    const muted = await p.evaluate(() => window.__buddySounds.length);
    await open("recruit");
    await p.locator("[data-bd=draw]").tap();
    await p.waitForSelector(".bd-result", { timeout: 5000 });
    const cues = await p.evaluate(() => window.__buddySounds.join(","));
    ok(
      muted === 0 && cues.length > 0,
      `${tag} 音: 音量0で再生要求0件・結果は表示、通常は ${cues}`,
    );

    // 戦闘HUD：既存の操作ボタンと重ならず、画面内。待ち時間・使用可能・押下。
    await open("hud", "&cd=12&freeze=1");
    const hud = await p.evaluate(() => {
      const rects = window.__buddyHud.rects();
      const me = rects.find((r) => r.id === "buddy");
      const hit = rects.filter(
        (r) =>
          r.id !== "buddy" &&
          me.left < r.left + r.size + 4 &&
          me.left + me.size + 4 > r.left &&
          me.top < r.top + r.size + 4 &&
          me.top + me.size + 4 > r.top,
      );
      const b = document.querySelector(".bd-skill-btn");
      const label = b.querySelector(".bd-skill-name").getBoundingClientRect();
      return {
        hit: hit.map((r) => r.id),
        inView:
          me.left >= 0 &&
          me.top >= 88 &&
          me.left + me.size <= innerWidth &&
          label.bottom <= innerHeight,
        size: Math.round(me.size),
        state: b.dataset.state,
        sec: b.querySelector(".bd-skill-sec").textContent,
        aria: b.getAttribute("aria-label"),
      };
    });
    ok(
      !hud.hit.length && hud.inView && hud.size >= 44,
      `${tag} HUD: 既存ボタンと重ならず画面内（${hud.size}px）${hud.hit.length ? " 重なり:" + hud.hit : ""}`,
    );
    ok(
      hud.state === "cooldown" &&
        hud.sec === "12" &&
        /再使用まで12秒/.test(hud.aria),
      `${tag} HUD: 再使用待ちを数字と読み上げで表示（${hud.sec}秒）`,
    );
    await p.screenshot({ path: `${out}/${tag}-hud-cooldown.png` });
    await open("hud");
    await p.waitForTimeout(200);
    const ready = await p.evaluate(
      () => document.querySelector(".bd-skill-btn").dataset.state,
    );
    await p.locator(".bd-skill-btn").tap();
    await p.waitForTimeout(100);
    const afterUse = await p.evaluate(() => {
      const b = document.querySelector(".bd-skill-btn");
      return {
        state: b.dataset.state,
        sec: b.querySelector(".bd-skill-sec").textContent,
      };
    });
    ok(
      ready === "ready" && ["active", "cooldown"].includes(afterUse.state),
      `${tag} HUD: 使用可能→押すと使用中・再使用待ち（${afterUse.sec}秒）`,
    );
    if (!reduce) await p.screenshot({ path: `${out}/${tag}-hud-ready.png` });

    ok(
      errors.length === 0,
      `${tag} ページ例外 ${errors.length}件 ${errors.slice(0, 2).join(" | ")}`,
    );
    await ctx.close();
  }
}
await browser.close();
fs.writeFileSync(path.join(out, "report.txt"), report.join("\n") + "\n");
console.log(
  report.filter((l) => l.startsWith("OK")).length,
  "OK /",
  report.length,
);
