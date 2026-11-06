// 進撃の停止・ダウン・pauseボタンの表示確認（Claude担当分）。
// 実ソロ進撃を主担当 check-advance-pause-ui.mjs と同じ手順で開始し、配信される
// playtest-app.ts をメモリ上だけで差し替えて advance-pause-ui の関数を呼ぶ（製品ファイルは無変更）。
// 停止のバディ情報は主担当の getAdvanceBuddyView(world, 本人id) の実値と、表示データだけ差し替えた変種。
import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require("@playwright/test");
const origin = process.env.ORIGIN ?? "http://127.0.0.1:5194";
const out = process.argv[2] ?? "dist-validation/advance-pause-ui/design";
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", args: ["--use-angle=d3d11"] });
const results = [],
  fail = [];
const check = (name, ok, detail) => {
  results.push({ name, ok, detail });
  if (!ok) fail.push(`${name} ${JSON.stringify(detail)}`);
};
const cases = [
  { w: 844, h: 390, touch: false },
  { w: 640, h: 360, touch: true },
  { w: 568, h: 320, touch: true },
  { w: 844, h: 390, touch: true, safe: [44, 34, 0, 21], tag: "844-safe" },
];
const PATCH = `
window.__apMods = { pause: advancePauseMarkup, down: advanceDownMarkup, btn: pauseButtonMarkup };
`;
try {
  for (const c of cases) {
    const tag = c.tag ?? `${c.w}-${c.touch ? "touch" : "pc"}`;
    const page = await browser.newPage({
      viewport: { width: c.w, height: c.h },
      hasTouch: c.touch,
      serviceWorkers: "block",
    });
    page.setDefaultTimeout(60000);
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/pause-seed", (r) => r.fulfill({ contentType: "text/html", body: "<html></html>" }));
    await page.goto(origin + "/pause-seed");
    await page.evaluate(async () => {
      const { freshProgress, newSaveKey } = await import("/src/client/progression-save.ts");
      const { freshBuddyProgress, chooseStarterBuddy } = await import("/src/shared/buddy-progression.ts");
      const { ENEMY_REPORT_NAMES } = await import("/src/shared/enemy-identity.ts");
      const s = freshProgress("normal");
      s.buddies = chooseStarterBuddy(freshBuddyProgress(), "yosuga");
      s.encounters = Object.fromEntries(Object.keys(ENEMY_REPORT_NAMES).map((id) => [id, "solo"]));
      localStorage.setItem(newSaveKey("normal"), JSON.stringify(s));
      localStorage.setItem("swarm-front-player-name-v1", "停止画面検証");
    });
    await page.route(/\/src\/client\/render.ts(?:\?.*)?$/, async (route) => {
      const response = await route.fetch();
      await route.fulfill({
        response,
        body:
          (await response.text()) +
          "\nconst qaRender=Renderer.prototype.render;Renderer.prototype.render=function(...a){if(a[0]){window.qaWorld=a[0];if(!window.qaAllowDown && a[0].players[0])a[0].players[0].safe=999;}return qaRender.apply(this,a)};",
      });
    });
    await page.route(/\/src\/client\/playtest-app.ts(?:\?.*)?$/, async (route) => {
      const response = await route.fetch();
      // 主担当が接続済みの製品経路をそのまま使い、変種描画用に関数だけ公開する。
      const body = await response.text();
      if (!body.includes("advancePauseMarkup")) throw Error("製品側の接続が見つかりません");
      await route.fulfill({ response, body: body + PATCH });
    });
    await page.goto(origin + "/", { timeout: 180000 });
    if (c.safe) {
      await page.evaluate(([l, r, t, b]) => {
        const s = document.documentElement.style;
        s.setProperty("--safe-left", l + "px");
        s.setProperty("--safe-right", r + "px");
        s.setProperty("--safe-top", t + "px");
        s.setProperty("--safe-bottom", b + "px");
      }, c.safe);
    }
    const tap = async (sel) => {
      await page.waitForFunction(() => !document.querySelector(".split-shutter,.menu-route-shutter"));
      const l = page.locator(sel);
      c.touch ? await l.tap() : await l.click();
    };
    await tap(".title-entry-start");
    await tap("#solo");
    await tap('[data-operation="advance"]');
    if (await page.locator("#pt-confirm").count()) await tap("#pt-confirm");
    await tap("#pt-start");
    await page.getByRole("button", { name: "タップで戦場へ" }).click({ timeout: 180000 });
    if (await page.locator("#pt-tutorial-skip").count()) await tap("#pt-tutorial-skip");
    await page.locator("#controls").waitFor();
    await page.waitForFunction(() => window.qaWorld?.phase === "battle");
    await page.locator(".operation-cue").waitFor({ state: "detached" });
    if (c.safe) await page.evaluate(() => dispatchEvent(new Event("resize")));
    await page.waitForTimeout(300);

    // pauseボタン: 寸法・位置は既存layoutのまま、中心で押せる。
    const btn = await page.evaluate(() => {
      const el = document.getElementById("pause");
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      const bars = el.querySelector(".ap-pause-bars")?.getBoundingClientRect();
      const label = el.querySelector(".ap-pause-label")?.getBoundingClientRect();
      return {
        rect: [r.left, r.top, r.width, r.height].map(Math.round),
        styleSize: [el.style.width, el.style.height],
        hit: hit === el || el.contains(hit),
        inside: !!bars && !!label && label.bottom <= r.bottom + 0.5 && bars.top >= r.top - 0.5 && label.left >= r.left && label.right <= r.right,
        aria: el.getAttribute("aria-label"),
        name: el.innerText.replace(/\s+/g, ""),
      };
    });
    results.push({ tag, pauseButton: btn });
    check(`${tag}:pause:中心で押せる`, btn.hit, btn);
    check(`${tag}:pause:中身が枠内`, btn.inside, btn);
    check(`${tag}:pause:寸法はlayoutの指定`, `${btn.rect[2]}px` === btn.styleSize[0] && `${btn.rect[3]}px` === btn.styleSize[1], btn);
    check(`${tag}:pause:aria維持`, btn.aria === "一時停止メニュー", btn.aria);
    await page.screenshot({ path: `${out}/${tag}-battle.png` });

    const measureDialog = async (label) => {
      const m = await page.evaluate(() => {
        const d = document.querySelector("dialog.menu-dialog[open]");
        const body = d.querySelector(".menu-dialog-body");
        const r = d.getBoundingClientRect();
        const resume = document.getElementById("pt-resume");
        const rr = resume?.getBoundingClientRect();
        const hit = rr && document.elementFromPoint(rr.left + rr.width / 2, rr.top + rr.height / 2);
        const buttons = [...d.querySelectorAll(".ap-pause-actions button")].map((b) => Math.round(b.getBoundingClientRect().height));
        return {
          dialog: [r.left, r.top, r.width, r.height].map(Math.round),
          inViewport: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth,
          bodyScroll: body.scrollHeight - body.clientHeight,
          resumeHit: !!hit && (hit === resume || resume.contains(hit)),
          buttons,
          text: d.innerText,
        };
      });
      results.push({ tag, label, ...m });
      check(`${tag}:${label}:画面内`, m.inViewport, m.dialog);
      check(`${tag}:${label}:再開がスクロールなしで押せる`, m.resumeHit, m.bodyScroll);
      check(`${tag}:${label}:操作44px以上`, m.buttons.every((h) => h >= 44), m.buttons);
      check(`${tag}:${label}:undefined/NaNなし`, !/undefined|NaN|Infinity|null/.test(m.text), m.text);
      await page.screenshot({ path: `${out}/${tag}-pause-${label}.png` });
      return m;
    };

    await tap("#pause");
    await page.locator("#pt-resume").waitFor();
    await page.waitForTimeout(400);
    const real = await measureDialog("real");
    check(`${tag}:real:同行バディ名`, real.text.includes("ヨスガ") || real.text.includes("同行"), real.text);
    check(`${tag}:real:本体スクロールなし`, real.bodyScroll <= 0, real.bodyScroll);

    // 表示データだけ差し替えた変種（同じ実ダイアログの本文を置換。押下確認はしない）。
    const variants = {
      cooldown: { status: "present", name: "トバリ", level: 12, elementLabel: "氷結", skillName: "防御支援", skillText: "持ち主と5m内の味方を6秒、被ダメージ30%軽減。", cooldown: 25, remaining: 11.2, activeRemaining: 0, unavailable: null },
      active: { status: "present", name: "オリハ", level: 40, elementLabel: "電撃", skillName: "身体強化", skillText: "持ち主と5m内の味方を6秒、移動速度20%増・回避再使用20%短縮。", cooldown: 25, remaining: 22, activeRemaining: 3.4, unavailable: null },
      blocked: { status: "present", name: "ヨスガ", level: 1, elementLabel: "風", skillName: "自己回復", skillText: "持ち主だけを5秒で最大HPの25%回復。", cooldown: 25, remaining: 0, activeRemaining: 0, unavailable: "HPが満タンです" },
      fire: { status: "present", name: "タタラ", level: 7, elementLabel: "火炎", skillName: "範囲攻撃", skillText: "バディ中心4mの敵へ火炎攻撃。", cooldown: 20, remaining: 0, activeRemaining: 0, unavailable: null },
      missing: { status: "present", name: "", level: NaN, elementLabel: undefined, skillName: undefined, skillText: undefined, cooldown: NaN, remaining: undefined, activeRemaining: null, unavailable: undefined },
      escape: { status: "present", name: "<b>長い名前のバディ&テスト</b>", level: 40, elementLabel: "未知<i>", skillName: '"引用"<script>', skillText: "とても長い説明文。".repeat(6), cooldown: 25, remaining: 0.2, activeRemaining: null, unavailable: null },
      none: { status: "none" },
      unavailable: { status: "unavailable" },
    };
    for (const [label, view] of Object.entries(variants)) {
      await page.evaluate((v) => {
        const body = document.querySelector("dialog.menu-dialog[open] .menu-dialog-body");
        body.innerHTML = window.__apMods.pause(v);
      }, view);
      const m = await measureDialog(label);
      if (label === "escape")
        check(`${tag}:escape:タグを文字で表示`, m.text.includes("<b>長い名前") && (await page.locator("dialog[open] .ap-buddy script, dialog[open] .ap-buddy-name b").count()) === 0, m.text.slice(0, 80));
      if (label === "none") check(`${tag}:none:同行なし`, m.text.includes("同行なし"), m.text);
      if (label === "unavailable") check(`${tag}:unavailable:取得不可と区別`, m.text.includes("表示できません") && !m.text.includes("同行なし"), m.text);
      if (label === "cooldown") check(`${tag}:cooldown:再使用まで12秒`, m.text.includes("再使用まで") && m.text.includes("12秒"), m.text);
      if (label === "active") check(`${tag}:active:効果中`, m.text.includes("効果中") && m.text.includes("残り4秒"), m.text);
      if (label === "blocked") check(`${tag}:blocked:理由`, m.text.includes("HPが満タンです"), m.text);
    }
    await page.locator("dialog.menu-dialog[open] .dialog-close").click();
    await page.waitForFunction(() => !document.querySelector("dialog.menu-dialog[open]"));

    // 設定・操作（既存処理が本文を「メニュー」欄へ移す）でも崩れない。
    await tap("#pause");
    await page.locator("#pt-pause-layout").waitFor();
    await tap("#pt-pause-layout");
    await page.locator("#settings-save").waitFor();
    await page.waitForTimeout(300);
    const settings = await page.evaluate(() => {
      const s = document.getElementById("settings-save").getBoundingClientRect();
      const p = document.querySelector("#settings-save .ap-pause")?.getBoundingClientRect();
      return { save: [s.left, s.width].map(Math.round), pause: p ? [p.left, p.width].map(Math.round) : null, overflow: p ? p.right - s.right : null };
    });
    results.push({ tag, settings });
    check(`${tag}:settings:メニュー欄に収まる`, settings.pause && settings.overflow <= 1, settings);
    await page.screenshot({ path: `${out}/${tag}-pause-settings.png` });
    await page.locator("dialog.menu-dialog[open] .dialog-close").click();
    await page.waitForFunction(() => !document.querySelector("dialog.menu-dialog[open]"));

    // ダウン（実値）と欠損変種。
    await page.evaluate(() => {
      window.qaAllowDown = true;
      window.qaWorld.players[0].safe = 0;
      window.qaWorld.players[0].hp = 0;
    });
    await page.locator("#pt-defeat").waitFor();
    await page.waitForTimeout(400);
    const measureDown = async (label) => {
      const m = await page.evaluate(() => {
        const sec = document.querySelector("#ui .pt-screen");
        const b = document.getElementById("pt-defeat");
        const r = b.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        const down = sec.querySelector(".ap-down").getBoundingClientRect();
        const pause = document.getElementById("pause");
        return {
          defeatHit: hit === b || b.contains(hit),
          defeatH: Math.round(r.height),
          scroll: sec.scrollHeight - sec.clientHeight,
          downRect: [down.left, down.top, down.width, down.height].map(Math.round),
          inViewport: down.bottom <= innerHeight && down.right <= innerWidth && down.left >= 0,
          adNote: !!document.getElementById("pt-ad-note"),
          pauseHidden: pause.hidden ? getComputedStyle(pause).display : "shown",
          text: sec.innerText,
        };
      });
      results.push({ tag, label, ...m });
      check(`${tag}:down-${label}:敗北を確定が押せる`, m.defeatHit && m.defeatH >= 44, m);
      check(`${tag}:down-${label}:画面内・スクロールなし`, m.inViewport && m.scroll <= 0, m);
      check(`${tag}:down-${label}:pt-ad-note維持`, m.adNote, m.adNote);
      check(`${tag}:down-${label}:保存済・復活を出さない`, !/保存済|復活|再挑戦/.test(m.text), m.text);
      check(`${tag}:down-${label}:undefined/NaNなし`, !/undefined|NaN|Infinity|null/.test(m.text), m.text);
      if (m.pauseHidden !== "shown") check(`${tag}:down:pause非表示を維持`, m.pauseHidden === "none", m.pauseHidden);
      await page.screenshot({ path: `${out}/${tag}-down-${label}.png` });
      return m;
    };
    const d1 = await measureDown("real");
    check(`${tag}:down-real:戦況の実値`, /\d+体/.test(d1.text) && /\d+:\d\d/.test(d1.text), d1.text);
    for (const [label, stats] of Object.entries({
      missing: { stageLabel: "", elapsed: undefined, kills: null },
      long: { stageLabel: "ST 12 · WAVE 10 / 10 · 長い作戦名<テスト>", elapsed: "59:59", kills: 9999 },
    })) {
      await page.evaluate((s) => {
        const cur = document.querySelector("#ui .ap-down");
        window.__apOrig ??= cur;
        const t = document.createElement("template");
        t.innerHTML = window.__apMods.down(s);
        cur.replaceWith(t.content.firstElementChild);
      }, stats);
      const m = await measureDown(label);
      if (label === "missing") check(`${tag}:down-missing:—表示`, (m.text.match(/—/g) ?? []).length === 3, m.text);
    }
    // 既存bindの付いた元の要素へ戻し、実際に押して既存処理で結果へ進む。
    await page.evaluate(() => document.querySelector("#ui .ap-down").replaceWith(window.__apOrig));
    await tap("#pt-defeat");
    await page.waitForFunction(() => document.body.dataset.screen === "result", null, { timeout: 30000 }).then(
      () => check(`${tag}:down:敗北を確定で結果へ`, true, "result"),
      () => check(`${tag}:down:敗北を確定で結果へ`, false, "結果へ進まない"),
    );
    check(`${tag}:ページ例外なし`, errors.length === 0, errors);
    await page.close();
  }
} finally {
  fs.writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2) + "\n");
  await browser.close();
}
console.log(`${results.filter((r) => r.ok !== undefined).length}項目 / 失敗${fail.length}`);
if (fail.length) {
  console.log(fail.join("\n").slice(0, 6000));
  process.exitCode = 1;
}
