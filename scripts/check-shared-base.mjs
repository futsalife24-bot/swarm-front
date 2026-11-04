// 共通基地の入口を実ブラウザーで確認する（毎回新しい隔離状態。実セーブは使わない）。
// 使い方: npm run dev -- --port 5186 の起動後に node scripts/check-shared-base.mjs [出力先]
import { chromium } from "@playwright/test";
import fs from "node:fs";
const origin = process.env.ORIGIN ?? "http://127.0.0.1:5186";
const out = process.argv[2] ?? "dist-validation/shared-base";
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=d3d11"],
});
const report = [];
const ok = (cond, msg) => {
  report.push(`${cond ? "OK  " : "NG  "}${msg}`.trimEnd());
  if (!cond) process.exitCode = 1;
};

for (const [width, height] of [
  [844, 390],
  [640, 360],
]) {
  const tag = `${width}x${height}`;
  const ctx = await browser.newContext({
    viewport: { width, height },
    hasTouch: true,
    serviceWorkers: "block",
  });
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  const settle = () =>
    p.locator(".split-shutter").waitFor({ state: "detached" });
  // 初回のタイトル入場画面（タップで開始）を閉じる。表示されない場合は何もしない。
  const enterTitle = async () => {
    const start = p.locator(".title-entry-start");
    try {
      await start.waitFor({ timeout: 8000 });
    } catch {
      return;
    }
    await start.tap();
    await p.locator(".title-entry").waitFor({ state: "detached" });
    await settle();
  };
  const shot = (name) => p.screenshot({ path: `${out}/${tag}-${name}.png` });
  // Layout probe: every visible button inside the active screen fits the viewport, and no two overlap.
  const layout = (sel) =>
    p.evaluate(
      ([sel, w, h]) => {
        const els = [...document.querySelectorAll(sel)].filter(
          (e) => e.offsetParent && !e.closest(".split-shutter"),
        );
        const rects = els.map((e) => ({
          t: e.textContent.trim().slice(0, 12),
          r: e.getBoundingClientRect(),
        }));
        const out = rects
          .filter(
            ({ r }) =>
              r.left < -1 || r.top < -1 || r.right > w + 1 || r.bottom > h + 1,
          )
          .map((x) => x.t);
        const overlaps = [];
        for (let i = 0; i < rects.length; i++)
          for (let j = i + 1; j < rects.length; j++) {
            const a = rects[i].r,
              b = rects[j].r;
            if (
              a.left < b.right - 1 &&
              b.left < a.right - 1 &&
              a.top < b.bottom - 1 &&
              b.top < a.bottom - 1
            )
              overlaps.push(`${rects[i].t}/${rects[j].t}`);
          }
        return { n: rects.length, out, overlaps };
      },
      [sel, width, height],
    );

  // 1. 生存タイトル → 基地（新規保存の確認を経由）→ 育成 → 基地
  await p.goto(origin + "/front", {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await p.locator("#open-armory").waitFor({ timeout: 120000 });
  await enterTitle();
  await settle();
  await p.locator("#open-armory").tap();
  await p.waitForURL(/\?base=1$/, { timeout: 60000 });
  const confirm = p
    .locator("dialog.menu-dialog[open]")
    .filter({ hasText: "新しい進行を開始" })
    .getByRole("button", { name: "確定" });
  await Promise.race([
    confirm.first().waitFor({ timeout: 60000 }),
    p.locator(".pt-base-menu").waitFor({ timeout: 60000 }),
  ]);
  const askedNewSave = (await confirm.count()) > 0;
  ok(
    askedNewSave,
    `${tag} 新規保存では基地の前に「新しい進行を開始」の確認が出る`,
  );
  await shot("1-newsave-confirm");
  if (askedNewSave) await confirm.first().tap();
  await p.locator(".pt-base-menu").waitFor();
  await settle();
  await shot("2-base-menu");
  const menu = await layout(".pt-base-menu button, .menu-header button");
  ok(
    menu.out.length === 0 && menu.overlaps.length === 0,
    `${tag} 基地メニュー ${menu.n}ボタン はみ出し[${menu.out}] 重なり[${menu.overlaps}]`,
  );
  const labels = await p
    .locator(".pt-base-menu button strong")
    .allTextContents();
  ok(
    labels.join(",") === "武器,アクセサリ,育成,生存カード,工房",
    `${tag} 基地の項目: ${labels.join(",")}`,
  );
  await p.locator("#pt-base-growth").tap();
  const skip = p.locator("#pt-tutorial-skip");
  await p.locator(".pt-growth").waitFor();
  if (await skip.count()) {
    await settle();
    await shot("3-growth-tutorial");
    await skip.tap();
  }
  await settle();
  ok(
    (await p.locator(".menu-header h1").innerText()) === "兵士の育成",
    `${tag} 基地→育成が開ける`,
  );
  await shot("3-growth");
  await p.locator("#pt-base").tap();
  await p.locator(".pt-base-menu").waitFor();
  await settle();
  ok(true, `${tag} 育成→基地へ戻れる`);

  // 2. 基地 → 生存カード → 基地
  await p.locator("#pt-base-survival").tap();
  await p.waitForURL(/\/front\?cards=1$/, { timeout: 60000 });
  await p.locator(".front-base .base-tile").first().waitFor({ timeout: 60000 });
  await settle();
  ok(
    (await p.locator(".front-base h1").innerText()) === "生存カード",
    `${tag} 基地→生存カードが開ける（見出し「生存カード」）`,
  );
  await shot("4-cards");
  const cards = await layout(
    ".front-base .menu-header button, .base-deck-bar button",
  );
  ok(
    cards.out.length === 0 && cards.overlaps.length === 0,
    `${tag} カード画面ヘッダー ${cards.n}ボタン はみ出し[${cards.out}] 重なり[${cards.overlaps}]`,
  );
  await p.locator("#base-back").tap();
  await p.waitForURL(/\?base=1$/, { timeout: 60000 });
  await p.locator(".pt-base-menu").waitFor({ timeout: 60000 });
  await settle();
  ok(
    (await p.locator(".pt-base-menu").count()) === 1 &&
      (await p.locator("dialog.menu-dialog[open]").count()) === 0,
    `${tag} 生存カード→戻るで基地へ戻る（保存済みなので確認なし）`,
  );
  await shot("5-back-to-base");

  // 3. 進撃側の基地: 武器・アクセサリ・育成が開け、工房は工事中のまま
  for (const [id, h1] of [
    ["pt-base-weapons", null],
    ["pt-base-accessories", null],
    ["pt-base-growth", "兵士の育成"],
  ]) {
    await p.locator("#" + id).tap();
    await settle();
    if (await p.locator("#pt-tutorial-skip").count()) {
      await p.locator("#pt-tutorial-skip").tap();
      await settle();
    }
    const title = await p.locator(".menu-header h1").first().innerText();
    ok(
      h1 ? title === h1 : title !== "基地",
      `${tag} 基地→${id} 画面「${title}」`,
    );
    await shot(`6-${id}`);
    await p.locator("#pt-base").tap();
    await p.locator(".pt-base-menu").waitFor();
    await settle();
  }
  ok(
    await p.locator("#pt-base-workshop").isDisabled(),
    `${tag} 工房は従来どおり工事中（無効）`,
  );

  // 4. 進撃タイトルの基地も同じメニュー
  await p.locator("#pt-home").tap();
  await p.locator("#open-armory").waitFor();
  await enterTitle();
  await settle();
  await p.locator("#open-armory").tap();
  await p.locator(".pt-base-menu").waitFor();
  ok(
    (await p.locator(".pt-base-menu button strong").allTextContents())
      .length === 5,
    `${tag} 進撃タイトル→基地も同じ5項目`,
  );

  // 5. 生存準備 → 生存カード → 戻るで準備へ
  await p.goto(origin + "/front?solo=1", { waitUntil: "domcontentloaded" });
  await p.locator("#front-base").waitFor({ timeout: 60000 });
  await settle();
  ok(
    (await p.locator("#front-base").innerText()) === "生存カード",
    `${tag} 生存準備のボタン名「生存カード」`,
  );
  await p.locator("#front-base").tap();
  await p.locator(".front-base .base-tile").first().waitFor();
  await settle();
  await p.locator("#base-back").tap();
  await p.locator(".front-prep").waitFor();
  await settle();
  ok(
    !/base=1/.test(p.url()) && (await p.locator(".front-prep").count()) === 1,
    `${tag} 生存準備→生存カード→戻るで準備へ戻る`,
  );
  await shot("7-prep-return");

  // 6. 保存済みの協力接続情報があっても ?base=1 は基地を開く（協力画面へ振り分けない）
  await p.evaluate(() =>
    localStorage.setItem(
      "swarm-front-session",
      JSON.stringify({
        version: 1,
        endpoint: "http://127.0.0.1:9",
        code: "a".repeat(32),
        token: "b".repeat(32),
        expiresAt: Date.now() + 3600000,
      }),
    ),
  );
  await p.goto(origin + "/?base=1", { waitUntil: "domcontentloaded" });
  await p.locator(".pt-base-menu").waitFor({ timeout: 60000 });
  ok(
    /\/\?base=1$/.test(p.url()),
    `${tag} 協力接続情報が残っていても ?base=1 は基地を表示`,
  );
  await p.goto(origin + "/", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(4000);
  const redirected = await p.evaluate(() => ({
    url: location.href,
    screen: document.body.dataset.screen ?? null,
    lobby: !!document.querySelector(".lobby,.room-entry,.front-lobby"),
  }));
  report.push(
    `INFO ${tag} 比較: base指定なしの / は ${JSON.stringify(redirected)}`,
  );
  await p.evaluate(() => localStorage.removeItem("swarm-front-session"));

  ok(
    errors.length === 0,
    `${tag} ページ例外 ${errors.length}件 ${errors.slice(0, 3).join(" | ")}`,
  );
  await ctx.close();
}
await browser.close();
fs.writeFileSync(`${out}/report.txt`, report.join("\n") + "\n");
console.log(report.join("\n"));
