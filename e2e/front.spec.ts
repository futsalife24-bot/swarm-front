import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { fresh, SAVE_KEY } from "../src/client/save";
import {
  emptyFrontProgress,
  FRONT_PROGRESS_KEY,
} from "../src/client/front-progress";
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
      page.getByRole("heading", { name: "最初の強化を選択", exact: true }),
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
    await page.screenshot({
      path: `${evidence}/selection-${viewport.width}x${viewport.height}.png`,
    });
    await page.getByRole("button", { name: /^導火：/ }).click();
    await expect(page.locator("#controls")).toBeVisible({ timeout: 10000 });
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("heading", { name: "一時停止", exact: true }),
    ).toBeVisible();
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
      p.getByRole("heading", { name: "最初の強化を選択", exact: true }),
    ).toBeVisible({ timeout: 65000 });
  await page.locator("[data-card='blast-core']").click();
  await expect(page.getByText("部隊の選択を待っています")).toBeVisible();
  await second.locator("[data-card='afterimage-mine']").click();
  for (const p of pages)
    await expect(p.locator("#controls")).toBeVisible({ timeout: 10000 });
  await page.locator("#pause").click();
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
