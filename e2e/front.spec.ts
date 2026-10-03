import { test, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { fresh, SAVE_KEY } from "../src/client/save";
import {
  emptyFrontProgress,
  FRONT_PROGRESS_KEY,
} from "../src/client/front-progress";
import { frontUpgradeDetails } from "../src/client/front-upgrade-ui";
import { createFrontRun, getFrontRunView } from "../src/shared/front-run";
import { localCreationKey } from "../tests/credentials";
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
    await page
      .getByRole("combobox", { name: "爆発", exact: true })
      .selectOption("fuse");
    const prep = page.locator(".front-prep");
    expect(
      await prep.evaluate((el) => el.scrollHeight <= el.clientHeight + 1),
    ).toBe(true);
    const bounds = await page.locator(".front-weapon-row").evaluateAll((rows) =>
      rows.map((el) => {
        const r = el.getBoundingClientRect();
        return { right: r.right, bottom: r.bottom };
      }),
    );
    expect(
      bounds.every(
        (r) => r.right <= viewport.width && r.bottom <= viewport.height,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `${evidence}/prep-${viewport.width}x${viewport.height}.png`,
    });
    await page.getByRole("button", { name: "出撃", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "強化を選べ", exact: true }),
    ).toBeVisible({ timeout: 65000 });
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
    await page.getByRole("button", { name: /^導火：/ }).click();
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
    await expect(page.getByText("強化 1/7", { exact: true })).toBeVisible();
    await expect(page.locator("#controls")).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole("list", { name: "取得済み強化" }),
    ).toBeVisible();
    await expect(
      page.getByRole("listitem", { name: "導火", exact: true }),
    ).toBeVisible();
    await page.screenshot({ path: `${evidence}/battle-${viewport.width}.png` });
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("heading", { name: "一時停止", exact: true }),
    ).toBeVisible();
    await expect(
      page.locator(".front-upgrade-details [data-upgrade='fuse']"),
    ).toContainText("手動命中で印を付け");
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
      "armor",
    ] as const)
      sample.levels[key] = 1;
    sample.picks = 7;
    sample.evolved = ["explosion", "piercing"];
    await page.locator(".front-upgrade-details").evaluate(
      (el, markup) => {
        el.outerHTML = markup;
      },
      frontUpgradeDetails(sample, "/"),
    );
    await expect(page.locator(".front-upgrade-details li")).toHaveCount(7);
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
      path: `${evidence}/pause-seven-${viewport.width}.png`,
    });
    await page.getByRole("button", { name: "再開", exact: true }).click();
    await expect(page.locator("#controls")).toBeVisible();
    await expect(
      page.locator(".front-upgrade-strip [role='listitem']"),
    ).toHaveCount(1);
    await page.locator("#pause").click();
    await page
      .getByRole("button", { name: "出撃メニューへ", exact: true })
      .click();
    await page.getByRole("button", { name: "旧版で遊ぶ", exact: true }).click();
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
    await p
      .getByRole("button", { name: "部屋を作る・参加", exact: true })
      .click();
    await p.getByText("接続先を手動設定（開発用）", { exact: true }).click();
    await p
      .getByRole("textbox", { name: "協力サーバー", exact: true })
      .fill("http://127.0.0.1:8789");
    await p
      .getByRole("textbox", { name: "部屋IDまたは招待リンク", exact: true })
      .fill(entry.roomId);
    await p.getByRole("button", { name: "参加", exact: true }).click();
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
  await page.locator("[data-card='blast-core']").click();
  await expect(page.getByText("部隊の選択を待っています")).toBeVisible();
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
    second.getByRole("listitem", { name: "残像地雷", exact: true }),
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
