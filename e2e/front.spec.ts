import { test, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { fresh, SAVE_KEY } from "../src/client/save";
import {
  emptyFrontProgress,
  FRONT_PROGRESS_KEY,
} from "../src/client/front-progress";
import {
  frontUpgradeDetails,
  frontUpgradeCardMarkup,
} from "../src/client/front-upgrade-ui";
import { createFrontRun, getFrontRunView } from "../src/shared/front-run";
import { localCreationKey } from "../tests/credentials";
import { freshProgress, newSaveKey } from "../src/client/progression-save";
import { makeWeapon } from "../src/shared/progression";
import { FRONT_FUSION_IDS } from "../src/shared/front-upgrades";
const evidence =
  process.env.FRONT_E2E_EVIDENCE ?? "docs/evidence/front-feedback-20261003";
const prior = JSON.stringify(fresh()),
  progress = {
    ...emptyFrontProgress(),
    runs: 1,
    wins: 1,
    credits: 100,
    unlocks: [...emptyFrontProgress().unlocks, "fuse"],
  };
test.use({
  storageState: {
    cookies: [],
    origins: [
      {
        origin: "http://127.0.0.1:5186",
        localStorage: [
          { name: SAVE_KEY, value: prior },
          { name: FRONT_PROGRESS_KEY, value: JSON.stringify(progress) },
          { name: "front-test-legacy-ledger", value: "旧版の日次台帳" },
        ],
      },
    ],
  },
});
for (const width of [844, 640])
  test(`融合の光枠・攻略装備・個人候補：横${width}`, async ({ page }) => {
    mkdirSync(evidence, { recursive: true });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width, height: width === 844 ? 390 : 360 });
    if (width === 640) await page.emulateMedia({ reducedMotion: "reduce" });
    const save = freshProgress("normal");
    save.armoryMigration = 1;
    save.missions = {
      "2:normal": [true, false, false],
      "4:normal": [true, false, false],
      "6:normal": [true, false, false],
    };
    for (let n = 0; n < 15; n++)
      save.inventory.push(
        makeWeapon(
          `fusion-ui-${n}`,
          (["rifle", "shotgun", "rocket"] as const)[n % 3],
          n % 5,
          { power: 20, reload: -10, range: 20, rate: 20 },
          false,
          save.serial++,
        ),
      );
    const raw = JSON.stringify(save);
    await page.addInitScript(
      ({ key, raw }) => {
        if (!localStorage.getItem(key)) localStorage.setItem(key, raw);
      },
      { key: newSaveKey("normal"), raw },
    );
    await page.goto("/front.html");
    await page.locator("#solo").click();
    await expect(page.locator("[data-row]")).toHaveCount(18);
    await page.locator('[data-row="fusion-ui-1"] .pt-stat-inner').click();
    await expect(page.locator('[data-front-slot="0"]')).toContainText("SG-4");
    await page.screenshot({ path: `${evidence}/campaign-prep-${width}.png` });
    await page.locator("#front-base").click();
    await expect(page.locator('[data-pool="life-drain"]')).toBeEnabled();
    await page.locator('[data-pool="magnet"]').uncheck();
    await page.locator("#front-save-pool").click();
    await page.locator("#front-dialog-back").click();
    await page.reload();
    await page.locator("#solo").click();
    await page.locator("#front-base").click();
    await expect(page.locator('[data-pool="magnet"]')).not.toBeChecked();
    await page.screenshot({ path: `${evidence}/pool-${width}.png` });
    await page.locator("#front-dialog-back").click();
    await page.locator("#front-launch").click();
    await expect(page.locator(".rebuild-card")).toHaveCount(3, {
      timeout: 65000,
    });
    // 実画面へ共通描画関数の融合候補を表示し、枠・画像・短い横画面の収まりを検証。
    const view = getFrontRunView(
      createFrontRun({
        runId: "visual",
        seed: 1,
        fusion: true,
        players: [{ id: "p" }],
      }),
      "p",
    );
    await page.locator(".rebuild-cards").evaluate(
      (el, markup) => {
        el.innerHTML = markup;
      },
      FRONT_FUSION_IDS.slice(3)
        .map((id) => frontUpgradeCardMarkup(view, id, "/"))
        .join(""),
    );
    await expect(page.locator(".front-fused")).toHaveCount(3);
    await expect(page.locator(".front-acquisition").first()).toHaveText(
      "↑融合進化",
    );
    const metrics = await page.locator(".front-fused").evaluateAll((elements) =>
      elements.map((el) => {
        const r = el.getBoundingClientRect(),
          css = getComputedStyle(el);
        return {
          x: r.x,
          right: r.right,
          bottom: r.bottom,
          animation: css.animationName,
          shadow: css.boxShadow,
        };
      }),
    );
    expect(
      metrics.every(
        (r) =>
          r.x >= 0 &&
          r.right <= width &&
          r.bottom <= (width === 844 ? 390 : 360),
      ),
    ).toBe(true);
    expect(
      metrics.every((r) =>
        width === 640
          ? r.animation === "none"
          : r.animation.includes("front-fusion-glow"),
      ),
    ).toBe(true);
    await page.screenshot({ path: `${evidence}/fusion-${width}.png` });
    await expect(page.locator(".front-fusion-sources")).toHaveCount(3);
    await expect(page.locator(".front-fused").first()).toContainText(
      "リジェネアーマー",
    );
    await expect(page.locator(".front-fusion-sources").first()).toContainText(
      "装甲補強×生命回収",
    );
    await expect(page.locator(".rebuild-cards")).not.toContainText("継承");
    await page.locator(".rebuild-cards").evaluate(
      (el, markup) => {
        el.innerHTML = markup;
      },
      FRONT_FUSION_IDS.slice(0, 3)
        .map((id) => frontUpgradeCardMarkup(view, id, "/"))
        .join(""),
    );
    const sourceFits = await page
      .locator(".front-fusion-sources")
      .evaluateAll((elements) =>
        elements.every((el) => el.scrollWidth <= el.clientWidth + 1),
      );
    expect(sourceFits).toBe(true);
    await expect(page.locator(".front-fused").nth(1)).toContainText(
      "リフレクトバースト",
    );
    await page.screenshot({ path: `${evidence}/fusion-chain-${width}.png` });
    expect(
      await page.evaluate(
        (key) => localStorage.getItem(key),
        newSaveKey("normal"),
      ),
    ).toBe(raw);
    expect(errors).toEqual([]);
  });
for (const viewport of [
  { width: 1280, height: 720 },
  { width: 844, height: 390 },
  { width: 640, height: 360 },
])
  test(`横画面 ${viewport.width}：初期候補・3択・再開・旧版保護`, async ({
    page,
  }) => {
    mkdirSync(evidence, { recursive: true });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize(viewport);
    if (viewport.width === 640)
      await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/front.html");
    await page
      .getByRole("button", { name: "ソロで出撃準備", exact: true })
      .click();
    await page.getByRole("button", { name: "強化候補", exact: true }).click();
    await page
      .getByRole("combobox", { name: "爆発", exact: true })
      .selectOption("fuse");
    await page.getByRole("button", { name: "候補を保存", exact: true }).click();
    await page.getByRole("button", { name: "戻る", exact: true }).click();
    await page.getByRole("button", { name: "設定・操作", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "設定・操作" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "戻る", exact: true }).click();
    const prep = page.locator(".front-prep");
    expect(
      await prep.evaluate((el) => el.scrollHeight <= el.clientHeight + 1),
    ).toBe(true);
    await page.locator('[data-front-slot="1"]').click();
    await page.locator('.front-weapon-row [data-weapon="smg"]').last().click();
    await expect(page.locator('[data-front-slot="1"]')).toContainText("SMG-3");
    await page.locator('[data-front-slot="0"]').click();
    await page.locator('.front-weapon-row [data-weapon="smg"]').last().click();
    await expect(page.locator('[data-front-slot="0"]')).toContainText("SMG-3");
    await expect(page.locator('[data-front-slot="1"]')).toContainText("AR-9");
    await expect(page.locator("[data-initial]")).toHaveCount(0);
    const launch = await page.locator("#front-launch").boundingBox();
    expect(launch!.x).toBeGreaterThan(viewport.width / 2);
    expect(launch!.y).toBeGreaterThan(viewport.height * 0.7);
    await page
      .locator('[data-front-weapon-row="rifle"] .pt-stat-inner')
      .click();
    await expect(page.locator('[data-front-slot="0"]')).toContainText("AR-9");
    // 元の装備に戻して、既存の戦闘・強化検証を続行。
    await page
      .locator('.front-weapon-row [data-weapon="rifle"]')
      .last()
      .click();
    await page.locator('[data-front-slot="1"]').click();
    await page
      .locator('.front-weapon-row [data-weapon="shotgun"]')
      .last()
      .click();
    const layout = await page.locator(".front-weapon-table").evaluate((el) => {
      const r = el.getBoundingClientRect();
      const rows = [...el.querySelectorAll(".front-weapon-row")];
      return {
        x: r.x,
        right: r.right,
        bottom: r.bottom,
        scroll: el.scrollWidth - el.clientWidth,
        heights: rows.map((row) => row.getBoundingClientRect().height),
      };
    });
    expect(layout.right).toBeLessThanOrEqual(viewport.width);
    expect(layout.bottom).toBeLessThanOrEqual(viewport.height);
    expect(layout.heights).toEqual([30, 30, 30]);
    if (viewport.width >= 844) expect(layout.scroll).toBeLessThanOrEqual(1);
    const fixed = await page
      .locator(".front-weapon-row .gear-pinned-label")
      .first()
      .boundingBox();
    await page
      .locator(".front-weapon-table")
      .evaluate((el) => (el.scrollLeft = 500));
    expect(
      (await page
        .locator(".front-weapon-row .gear-pinned-label")
        .first()
        .boundingBox())!.x,
    ).toBe(fixed!.x);
    const offsets = await page
      .locator(".front-weapon-table .pt-stat-inner")
      .evaluateAll((es) => es.map((el) => el.getBoundingClientRect().x));
    expect(offsets.every((x) => Math.abs(x - offsets[0]) < 1)).toBe(true);
    await page
      .locator(".front-weapon-table")
      .evaluate((el) => (el.scrollLeft = 0));
    await page.screenshot({
      path: `${evidence}/prep-${viewport.width}x${viewport.height}.png`,
    });
    await page.getByRole("button", { name: "ソロ出撃 ↗", exact: true }).click();
    await expect(
      page.getByRole("progressbar", { name: "準備の進捗" }),
    ).toBeVisible();
    await page.screenshot({
      path: `${evidence}/loading-${viewport.width}x${viewport.height}.png`,
    });
    await expect(
      page.getByRole("heading", { name: "強化を選べ", exact: true }),
    ).toBeVisible({ timeout: 65000 });
    await expect(page.locator(".rebuild-card")).toHaveCount(3);
    const originalChoices = await page
      .locator(".rebuild-card")
      .evaluateAll((es) => es.map((e) => e.getAttribute("data-card")));
    await page
      .getByRole("button", { name: "現在の強化 0/6枠", exact: true })
      .click();
    const owned = page.getByRole("dialog", { name: "現在の強化", exact: true });
    await expect(owned).toBeVisible();
    await expect(owned).toContainText("まだ強化を取得していません");
    await page.screenshot({
      path: `${evidence}/owned-empty-${viewport.width}.png`,
    });
    const acquiredSample = getFrontRunView(
      createFrontRun(
        { runId: "owned-layout", seed: 1, players: [{ id: "p" }] },
        0,
      ),
      "p",
    );
    for (const id of [
      "blast-core",
      "fuse",
      "compressed-charge",
      "armor-piercer",
      "ricochet",
      "line-shot",
    ] as const)
      acquiredSample.levels[id] = 2;
    acquiredSample.picks = 12;
    // 実際の詳細ダイアログに最大取得状態の描画だけを入れて収まりを検証。
    await owned.locator(".front-upgrade-details").evaluate(
      (el, markup) => {
        el.outerHTML = markup;
      },
      frontUpgradeDetails(acquiredSample, "/"),
    );
    await expect(owned.locator("li")).toHaveCount(6);
    await owned.locator(".front-evolution-progress").scrollIntoViewIfNeeded();
    await expect(
      page.getByRole("button", { name: "3択へ戻る", exact: true }),
    ).toBeInViewport();
    expect(
      await owned.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return (
          r.left >= 0 &&
          r.top >= 0 &&
          r.right <= innerWidth &&
          r.bottom <= innerHeight &&
          el.scrollWidth <= el.clientWidth
        );
      }),
    ).toBe(true);
    await page.screenshot({
      path: `${evidence}/owned-six-${viewport.width}.png`,
    });
    await page.getByRole("button", { name: "3択へ戻る", exact: true }).click();
    await expect(owned).not.toBeVisible();
    await page
      .getByRole("button", { name: "現在の強化 0/6枠", exact: true })
      .click();
    await page.keyboard.press("Escape");
    await expect(owned).not.toBeVisible();
    await expect(
      page.getByRole("heading", { name: "強化を選べ", exact: true }),
    ).toBeVisible();
    expect(
      await page
        .locator(".rebuild-card")
        .evaluateAll((es) => es.map((e) => e.getAttribute("data-card"))),
    ).toEqual(originalChoices);
    await expect(page.locator(".rebuild-card")).toHaveCount(3);
    expect(await page.locator(".rebuild-selection footer").count()).toBe(0);
    const cards = await page.locator(".rebuild-card").evaluateAll((nodes) =>
      nodes.map((el) => {
        const r = el.getBoundingClientRect(),
          image = el.querySelector("img")!,
          style = getComputedStyle(el);
        return {
          left: r.left,
          right: r.right,
          top: r.top,
          bottom: r.bottom,
          loaded: image.complete && image.naturalWidth === 256,
          animation: style.animationName,
          delay: style.animationDelay,
        };
      }),
    );
    expect(
      cards.every(
        (c) =>
          c.left >= 0 &&
          c.right <= viewport.width &&
          c.top >= 0 &&
          c.bottom <= viewport.height &&
          c.loaded,
      ),
    ).toBe(true);
    expect(cards.map((c) => c.animation)).toEqual(
      viewport.width === 640
        ? ["none", "none", "none"]
        : ["rebuild-card-enter", "rebuild-card-enter", "rebuild-card-enter"],
    );
    if (viewport.width === 844)
      expect(cards.map((c) => c.delay)).toEqual(["0s", "0.07s", "0.14s"]);
    const title = page.locator(".front-choice-title");
    expect(
      await title.evaluate((el) => getComputedStyle(el).animationName),
    ).toBe(viewport.width === 640 ? "none" : "front-title-enter");
    await page
      .locator(".rebuild-card")
      .last()
      .evaluate(async (el) => {
        await Promise.all(
          el.getAnimations().map((animation) => animation.finished),
        );
      });
    await page.screenshot({
      path: `${evidence}/selection-${viewport.width}x${viewport.height}.png`,
    });
    const panel = await page.locator(".rebuild-selection").evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    });
    expect(panel.width).toBeLessThanOrEqual(viewport.width * 0.85);
    expect(panel.height).toBeLessThan(viewport.height * 0.65);
    expect(
      Math.abs(panel.x + panel.width / 2 - viewport.width / 2),
    ).toBeLessThan(2);
    expect(
      Math.abs(panel.y + panel.height / 2 - viewport.height / 2),
    ).toBeLessThan(2);
    expect(
      await page
        .locator("#ui")
        .evaluate((el) => getComputedStyle(el).backgroundColor),
    ).toBe("rgba(0, 0, 0, 0)");
    const transition = page.evaluate(
      () =>
        new Promise<{
          elapsed: number;
          picked: string;
          disabled: number;
          cue: boolean;
        }>((resolve) => {
          const ui = document.getElementById("ui")!;
          ui.addEventListener(
            "click",
            () => {
              const started = performance.now();
              let picked = "",
                disabled = 0,
                cue = false;
              const observe = () => {
                cue ||= ui.textContent?.includes("まもなく再開") ?? false;
                const card = ui.querySelector(".is-picked");
                if (card) {
                  picked = getComputedStyle(card).animationName;
                  disabled = ui.querySelectorAll("[data-card]:disabled").length;
                }
                const elapsed = performance.now() - started;
                if (
                  !document.getElementById("controls")!.hidden ||
                  elapsed > 2000
                )
                  resolve({ elapsed, picked, disabled, cue });
                else requestAnimationFrame(observe);
              };
              requestAnimationFrame(observe);
            },
            { once: true, capture: true },
          );
        }),
    );
    await page.getByRole("button", { name: /導火：/ }).click();
    const selected = await transition;
    expect(selected.elapsed).toBeLessThan(700);
    expect(selected.picked).toBe(
      viewport.width === 640 ? "none" : "front-card-pick",
    );
    expect(selected.disabled).toBe(3);
    expect(selected.cue).toBe(false);
    writeFileSync(
      `${evidence}/choice-${viewport.width}.json`,
      JSON.stringify({ viewport, panel, transition: selected }, null, 2) + "\n",
    );
    await expect(page.getByText("強化 1/6枠", { exact: true })).toBeVisible();
    await expect(page.locator("#controls")).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole("list", { name: "取得済み強化" }),
    ).toBeVisible();
    await expect(
      page.getByRole("listitem", { name: "導火 1段階", exact: true }),
    ).toBeVisible();
    await page.screenshot({ path: `${evidence}/battle-${viewport.width}.png` });
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("heading", { name: "一時停止", exact: true }),
    ).toBeVisible();
    await expect(
      page.locator(".front-upgrade-details [data-upgrade='fuse']"),
    ).toContainText("命中で印、次の命中で起爆");
    await page.screenshot({ path: `${evidence}/pause-${viewport.width}.png` });
    // 合成した最大取得状態で、詳細欄だけを実際の描画関数から差し替える。
    const sample = getFrontRunView(
      createFrontRun({ runId: "layout", seed: 1, players: [{ id: "p" }] }, 0),
      "p",
    );
    for (const key of [
      "blast-core",
      "fuse",
      "compressed-charge",
      "armor-piercer",
      "ricochet",
      "line-shot",
    ] as const)
      sample.levels[key] = 2;
    sample.picks = 12;
    sample.evolved = ["explosion", "piercing"];
    await page.locator(".front-upgrade-details").evaluate(
      (el, markup) => {
        el.outerHTML = markup;
      },
      frontUpgradeDetails(sample, "/"),
    );
    await expect(page.locator(".front-upgrade-details li")).toHaveCount(6);
    await expect(page.locator(".front-upgrade-evolutions")).toContainText(
      "連鎖崩落",
    );
    const fit = await page.locator(".front-pause").evaluate((el) => {
      const r = el.getBoundingClientRect();
      const controls = [...el.querySelectorAll("button")].map((b) =>
        b.getBoundingClientRect(),
      );
      return (
        r.left >= 0 &&
        r.right <= innerWidth &&
        r.top >= 0 &&
        r.bottom <= innerHeight &&
        controls.every((b) => b.top >= r.top && b.bottom <= r.bottom)
      );
    });
    expect(fit).toBe(true);
    await page.locator(".front-upgrade-evolutions").scrollIntoViewIfNeeded();
    await expect(page.locator(".front-upgrade-evolutions")).toBeInViewport();
    await page.screenshot({
      path: `${evidence}/pause-six-${viewport.width}.png`,
    });
    await page.getByRole("button", { name: "再開", exact: true }).click();
    await expect(page.locator("#controls")).toBeVisible();
    await expect(
      page.locator(".front-upgrade-strip [role='listitem']"),
    ).toHaveCount(1);
    await page.locator("#pause").click();
    await page.getByRole("button", { name: "タイトルへ", exact: true }).click();
    await page
      .getByRole("button", { name: "攻略モード（従来版）", exact: true })
      .click();
    await expect(page).toHaveURL("http://127.0.0.1:5186/");
    const data = await page.context().storageState();
    const local = data.origins.find(
      (o) => o.origin === "http://127.0.0.1:5186",
    )!.localStorage;
    expect(local.find((item) => item.name === SAVE_KEY)?.value).toBe(prior);
    expect(local.find((item) => item.name === FRONT_PROGRESS_KEY)?.value).toBe(
      JSON.stringify(progress),
    );
    expect(
      local.find((item) => item.name === "front-test-legacy-ledger")?.value,
    ).toBe("旧版の日次台帳");
    expect(errors).toEqual([]);
  });
for (const width of [1280, 844, 640])
  test(`強化の区別 ${width}：取得済みと新規を同時表示`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 1280 ? 720 : 360 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/front.html");
    const sample = getFrontRunView(
      createFrontRun(
        { runId: "mixed-layout", seed: 1, players: [{ id: "p" }] },
        0,
      ),
      "p",
    );
    sample.levels["compressed-charge"] = 2;
    sample.levels["armor"] = 1;
    sample.picks = 3;
    // 同時出現する状態を合成。カードは本番と同じ描画関数で検証する。
    await page.locator("#ui").evaluate(
      (el, markup) => {
        document.body.dataset.screen = "battle";
        el.innerHTML = markup;
      },
      `<section class="pause-card rebuild-panel rebuild-selection"><header><button id="front-choice-owned">現在の強化 3/12</button><h1 class="front-choice-title">強化を選べ</h1><div class="rebuild-selection-actions"><span>あと15秒</span><button id="rebuild-reroll">再抽選 残り2</button></div></header><div class="rebuild-cards">${(["compressed-charge", "emergency-armor", "armor"] as const).map((id) => frontUpgradeCardMarkup(sample, id, "/")).join("")}</div></section>`,
    );
    await expect(
      page.getByRole("button", { name: /^段階アップ・2 → 3段階：/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^新規獲得・未取得 → 1段階：/ }),
    ).toBeVisible();
    const layout = await page.locator(".rebuild-selection").evaluate((el) => {
      const r = el.getBoundingClientRect();
      const header = [...el.querySelectorAll("header > *")].map((e) =>
        e.getBoundingClientRect(),
      );
      const fit = [...el.querySelectorAll("button")].every(
        (e) => e.scrollWidth <= e.clientWidth + 1,
      );
      return {
        height: r.height,
        fit,
        overlap:
          header[0].right > header[1].left || header[1].right > header[2].left,
        inView:
          r.left >= 0 &&
          r.right <= innerWidth &&
          r.top >= 0 &&
          r.bottom <= innerHeight,
      };
    });
    expect(layout.inView).toBe(true);
    expect(layout.fit).toBe(true);
    expect(layout.overlap).toBe(false);
    expect(layout.height).toBeLessThan((width === 1280 ? 720 : 360) * 0.65);
    mkdirSync(evidence, { recursive: true });
    await page.screenshot({ path: `${evidence}/mixed-${width}.png` });
  });

test("実ブラウザ2人：準備・共同選択・独立報酬・再読込", async ({
  page,
  context,
  browser,
}) => {
  const response = await fetch("http://127.0.0.1:8789/rooms", {
    method: "POST",
    headers: { "X-Room-Creation-Key": localCreationKey() },
    body: JSON.stringify({
      name: "画面検証",
      listed: false,
      ruleset: "front-v1",
      mode: "defense",
    }),
  });
  expect(response.status).toBe(200);
  const entry = await response.json();
  const secondContext = await browser.newContext({
    viewport: { width: 844, height: 390 },
    storageState: await context.storageState(),
  });
  const second = await secondContext.newPage(),
    pages = [page, second];
  for (const p of pages) {
    await p.goto("/front.html");
    await p.getByRole("button", { name: "協力プレイ", exact: true }).click();

    await p.getByText("接続先を手動設定（開発用）", { exact: true }).click();
    await p
      .getByRole("textbox", { name: "協力サーバー", exact: true })
      .fill("http://127.0.0.1:8789");
    await p
      .getByRole("textbox", { name: "部屋IDまたは招待リンク", exact: true })
      .fill(entry.roomId);
    await p.getByRole("button", { name: "参加", exact: true }).click();
    await expect(
      p.getByRole("heading", { name: "出撃準備", exact: true }),
    ).toBeVisible();
    await expect(p.locator(".front-room-mode")).toContainText("防衛戦");
    await expect(p.locator("#front-mode")).toHaveCount(0);
    await p.getByRole("button", { name: "準備完了", exact: true }).click();
    await expect(
      p.getByRole("heading", { name: "防衛戦 · 協力部隊", exact: true }),
    ).toBeVisible({ timeout: 10000 });
  }
  await expect(
    page.getByRole("button", { name: "出撃", exact: true }),
  ).toBeEnabled({ timeout: 65000 });
  await page.getByRole("button", { name: "出撃", exact: true }).click();
  for (const p of pages)
    await expect(
      p.getByRole("heading", { name: "強化を選べ", exact: true }),
    ).toBeVisible({ timeout: 65000 });
  await second
    .getByRole("button", { name: "現在の強化 0/6枠", exact: true })
    .click();
  const coopOwned = second.getByRole("dialog", {
    name: "現在の強化",
    exact: true,
  });
  await expect(coopOwned).toContainText("部隊の選択時間は進みます");
  await page.locator("[data-card='blast-core']").click();
  await expect(page.getByText("部隊の選択を待っています")).toBeVisible();
  await expect(coopOwned).toBeVisible();
  await second.getByRole("button", { name: "3択へ戻る", exact: true }).click();
  await second.locator("[data-card='afterimage-mine']").click();
  for (const p of pages)
    await expect(p.locator("#controls")).toBeVisible({ timeout: 10000 });
  await page.locator("#pause").click();
  await expect(
    page.locator(".front-upgrade-details [data-upgrade='blast-core']"),
  ).toBeVisible();
  await expect(
    page.locator(".front-upgrade-details [data-upgrade='afterimage-mine']"),
  ).toHaveCount(0);
  await expect(
    second.getByRole("listitem", { name: "残像地雷 1段階", exact: true }),
  ).toBeVisible();
  await page.locator("#front-settings").click();
  const timer = page.locator(".mission-line > b");
  const beforeSettings = await timer.innerText();
  await expect.poll(() => timer.innerText()).not.toBe(beforeSettings);
  await expect(
    page.getByRole("heading", { name: "設定・操作", exact: true }),
  ).toBeVisible();
  await page.locator("#front-setting-fireSensitivity").press("ArrowRight");
  await page.screenshot({ path: `${evidence}/coop-settings.png` });
  await page.locator("#front-settings-back").click();
  await page.locator("#front-resume").click();
  await expect(page.locator("#controls")).toBeVisible({ timeout: 5000 });
  const result = await fetch(
    `http://127.0.0.1:8789/fixtures/${entry.code}/front-result`,
    { method: "POST" },
  );
  expect(result.status).toBe(200);
  for (const p of pages)
    await expect(
      p.getByRole("heading", { name: "作戦成功", exact: true }),
    ).toBeVisible({ timeout: 10000 });
  await expect(
    page.getByText("功績 +100 · 初期候補 5/9種を解放", { exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: `${evidence}/coop-result.png` });
  await secondContext.close();
  await page.reload();
  const stored = await context.storageState(),
    values = stored.origins.find(
      (o) => o.origin === "http://127.0.0.1:5186",
    )!.localStorage;
  const progress = JSON.parse(
    values.find((v) => v.name === FRONT_PROGRESS_KEY)!.value,
  );
  expect(progress.wins).toBe(2);
  expect(progress.credits).toBe(200);
  expect(progress.runs).toBe(2);
  expect(progress.receipts).toHaveLength(1);
  expect(values.find((v) => v.name === SAVE_KEY)?.value).toBe(prior);
});
