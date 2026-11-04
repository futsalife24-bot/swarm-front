// プレビューを横画面2サイズで撮影し、配置・押しやすさ・動きを減らす設定を検査する。
// 前提: node design/survival-card-preview/serve.mjs を起動済み（既定 http://127.0.0.1:5190）。
// 実行（リポジトリのルートで）: node design/survival-card-preview/tools/capture.mjs
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, "..", "shots");
const origin = process.env.PREVIEW_ORIGIN || "http://127.0.0.1:5190";
const page0 = `${origin}/design/survival-card-preview/`;
fs.mkdirSync(out, { recursive: true });
const report = [];
const ok = (cond, msg) => {
  report.push(`${cond ? "OK  " : "NG  "}${msg}`.trimEnd());
  if (!cond) process.exitCode = 1;
};
const browser = await chromium.launch({ channel: "chrome" });
const SHOTS = [
  ["base-upgrades", "scene=base&tab=upgrades"],
  ["base-fusions", "scene=base&tab=fusions&inspect=fusion-collapse"],
  ["base-samples", "scene=base&tab=samples&inspect=sample-fire-split"],
  ["run-opening", "scene=run&case=opening"],
  ["run-levelup", "scene=run&case=levelup"],
  ["run-fusion", "scene=run&case=fusion"],
  ["run-samples", "scene=run&case=samples"],
  ["run-long", "scene=run&case=long"],
  ["run-picked", "scene=run&case=picked"],
  ["run-disabled", "scene=run&case=disabled"],
  ["hud", "scene=hud"],
  ["owned", "scene=owned"],
];

for (const [width, height] of [
  [844, 390],
  [640, 360],
]) {
  for (const reduce of [false, true]) {
    const ctx = await browser.newContext({
      viewport: { width, height },
      hasTouch: true,
      reducedMotion: reduce ? "reduce" : "no-preference",
    });
    const p = await ctx.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    const tag = `${width}x${height}${reduce ? "-reduce" : ""}`;
    for (const [name, query] of SHOTS) {
      await p.goto(`${page0}?ui=0&${query}${reduce ? "&motion=reduce" : ""}`, {
        waitUntil: "load",
      });
      await p.waitForFunction(() =>
        [...document.images].every((i) => i.complete),
      );
      await p.waitForTimeout(reduce ? 50 : 450);
      if (
        !reduce ||
        ["base-upgrades", "run-fusion", "run-picked", "owned"].includes(name)
      )
        await p.screenshot({ path: `${out}/${tag}-${name}.png` });
      const m = await p.evaluate(() => {
        const vw = innerWidth,
          vh = innerHeight;
        const rect = (e) => e.getBoundingClientRect();
        const cards = [...document.querySelectorAll(".sc-card")].filter(
          (e) => e.offsetParent,
        );
        const outside = cards.filter((e) => {
          const r = rect(e);
          return (
            r.left < -1 ||
            r.right > vw + 1 ||
            (r.top < -1 &&
              !e.closest(".pv-grid, .pv-upgrade-details, .pv-detail"))
          );
        }).length;
        // 3択のカードは本文が欠けない（内側の高さに収まる）こと。
        const lClipped = [
          ...document.querySelectorAll('.sc-card[data-size="L"] .sc-face'),
        ].filter((f) => f.scrollHeight > f.clientHeight + 1).length;
        const lCards = [
          ...document.querySelectorAll('.pv-cards .sc-card[data-size="L"]'),
        ].map(rect);
        let overlap = 0;
        for (let i = 0; i < lCards.length; i++)
          for (let j = i + 1; j < lCards.length; j++) {
            const a = lCards[i],
              b = lCards[j];
            if (
              a.left < b.right - 1 &&
              b.left < a.right - 1 &&
              a.top < b.bottom - 1 &&
              b.top < a.bottom - 1
            )
              overlap++;
          }
        const lBottom = Math.max(0, ...lCards.map((r) => r.bottom));
        // 当たり判定：デッキの出し入れ・詳細・3択。
        const checks = [...document.querySelectorAll(".sc-check")]
          .map(rect)
          .filter((r) => r.width);
        const picks = [...document.querySelectorAll(".sc-pick")]
          .map(rect)
          .filter((r) => r.width);
        const anim = [
          ...document.querySelectorAll('.sc-card[data-size="L"]'),
        ].map((e) => getComputedStyle(e).animationName);
        const scroll = document.documentElement.scrollWidth > vw + 1;
        const visibleM = [
          ...document.querySelectorAll(".pv-base .pv-grid .sc-card"),
        ].filter((e) => {
          const r = rect(e),
            g = rect(e.closest(".pv-grid"));
          return r.top >= g.top - 1 && r.bottom <= g.bottom + 1;
        }).length;
        return {
          outside,
          lClipped,
          overlap,
          lBottom,
          vh,
          minCheck: checks.length
            ? Math.min(...checks.map((r) => Math.min(r.width, r.height)))
            : null,
          minPickH: picks.length
            ? Math.min(...picks.map((r) => r.height))
            : null,
          anim,
          scroll,
          visibleM,
          lCount: lCards.length,
          lSize: lCards[0]
            ? `${Math.round(lCards[0].width)}×${Math.round(lCards[0].height)}`
            : "",
        };
      });
      ok(
        !m.scroll && m.outside === 0,
        `${tag} ${name}: 横スクロールなし・画面外のカード ${m.outside}`,
      );
      if (m.lCount) {
        ok(
          m.lClipped === 0 && m.overlap === 0 && m.lBottom <= m.vh,
          `${tag} ${name}: 3択 ${m.lCount}枚 ${m.lSize}px 本文欠け${m.lClipped} 重なり${m.overlap} 下端${Math.round(m.lBottom)}/${m.vh}`,
        );
        if (reduce)
          ok(
            m.anim.every((a) => a === "none"),
            `${tag} ${name}: 動きを減らす→カードのアニメーションなし（${[...new Set(m.anim)].join(",")}）`,
          );
        else if (name === "run-opening")
          ok(
            m.anim.every((a) => a === "sc-enter"),
            `${tag} ${name}: 通常→登場は短い sc-enter のみ`,
          );
        else if (name === "run-picked")
          ok(
            m.anim.includes("sc-pick"),
            `${tag} ${name}: 通常→決定時だけ sc-pick`,
          );
      }
      if (m.minCheck != null)
        ok(
          m.minCheck >= 36 && m.minPickH >= 40,
          `${tag} ${name}: 候補チェックの当たり判定 最小${Math.round(m.minCheck)}px、詳細の高さ${Math.round(m.minPickH)}px、全体表示 ${m.visibleM}枚`,
        );
    }
    // 常時アニメーションがないこと（融合カードを含む3択で、登場後に動き続ける要素がない）。
    await p.goto(
      `${page0}?ui=0&scene=run&case=fusion${reduce ? "&motion=reduce" : ""}`,
      { waitUntil: "load" },
    );
    await p.waitForTimeout(800);
    const running = await p.evaluate(
      () =>
        document.getAnimations().filter((a) => a.playState === "running")
          .length,
    );
    ok(
      running === 0,
      `${tag} 融合を含む3択で0.8秒後に動き続けるアニメーション ${running}件`,
    );
    // 操作：候補の出し入れと詳細の切替。
    await p.goto(
      `${page0}?ui=0&scene=base&tab=upgrades${reduce ? "&motion=reduce" : ""}`,
      { waitUntil: "load" },
    );
    const before = await p.locator(".pv-count").innerText();
    await p.locator('[data-pool="ricochet"]').tap();
    const after = await p.locator(".pv-count").innerText();
    await p.locator('[data-inspect="line-shot"]').tap();
    const detailName = await p
      .locator(".pv-detail .sc-name")
      .first()
      .innerText();
    ok(
      before !== after && detailName === "整列射",
      `${tag} 操作: 候補の出し入れ（${before}→${after}）、詳細の切替（${detailName}）`,
    );
    // aria-disabled でも押せる（押すと解放条件を案内する）ため、無効判定を飛ばして押す。
    await p.locator('[data-pool="power-cell"]').tap({ force: true });
    ok(
      /攻略4クリアで解放/.test(await p.locator(".pv-detail").innerText()) &&
        (await p.locator(".pv-count").innerText()) === after,
      `${tag} 操作: 未解放は出し入れせず解放条件を表示`,
    );
    await p.goto(
      `${page0}?ui=0&scene=run&case=opening${reduce ? "&motion=reduce" : ""}`,
      { waitUntil: "load" },
    );
    await p.waitForTimeout(400);
    await p.locator(".pv-cards [data-card]").nth(1).tap();
    ok(
      (await p.locator('.pv-cards [data-state="picked"]').count()) === 1 &&
        (await p.locator('.pv-cards [data-state="dismissed"]').count()) === 2,
      `${tag} 操作: 3択を押すと決定・他は非選択`,
    );
    await p.goto(
      `${page0}?ui=0&scene=run&case=levelup${reduce ? "&motion=reduce" : ""}`,
      { waitUntil: "load" },
    );
    await p.locator("#pv-owned-open").tap();
    await p.waitForTimeout(100);
    if (!reduce)
      await p.screenshot({ path: `${out}/${tag}-run-owned-dialog.png` });
    ok(
      (await p.locator("#pv-owned-dialog .sc-card").count()) === 3,
      `${tag} 操作: 3択中に「現在の強化」を開ける`,
    );
    ok(
      errors.length === 0,
      `${tag} ページ例外 ${errors.length}件 ${errors.slice(0, 2).join(" | ")}`,
    );
    await ctx.close();
  }
}
// 比較表は全体を1枚に。
{
  const ctx = await browser.newContext({
    viewport: { width: 844, height: 390 },
  });
  const p = await ctx.newPage();
  await p.goto(`${page0}?ui=0&scene=compare`, { waitUntil: "load" });
  await p.waitForFunction(() => [...document.images].every((i) => i.complete));
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${out}/compare-844.png`, fullPage: true });
  await ctx.close();
}
await browser.close();
fs.writeFileSync(path.join(out, "report.txt"), report.join("\n") + "\n");
console.log(report.join("\n"));
