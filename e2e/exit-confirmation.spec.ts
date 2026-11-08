import { confirmDeparture } from "./confirm-departure";
import { test, expect, type Page } from "@playwright/test";
import { localCreationKey } from "../tests/credentials";

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    // A fresh test-only profile; never read or import the user's saves.
    localStorage.setItem("swarm-front-player-name-v1", "終了確認テスト");
  });
  // New Playwright contexts only. No production saves, rooms or telemetry.
  await page.route("https://**/*", (route) => route.abort());
  await page.route("**/exit-test-outside", (route) =>
    route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: "<h1>ゲーム外のテストページ</h1>",
    }),
  );
});

async function home(page: Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "SWARM FRONT はじめる", exact: true })
    .click();
  await expect(page.locator(".title-entry")).toHaveCount(0);
}
const state = (page: Page) =>
  page.evaluate(() => ({
    url: location.href,
    history: history.length,
    screen: document.body.dataset.screen,
    saves: Object.fromEntries(Object.entries(localStorage)),
  }));

test("P2-03: 操作先行失敗の後も次の終了確認を処理できる", async ({ page }) => {
  await home(page);
  await expect(
    confirmDeparture(
      page,
      async () => {
        throw new Error("先行失敗");
      },
      false,
    ),
  ).rejects.toThrow("先行失敗");
  expect(page.listenerCount("dialog")).toBe(0);
  await confirmDeparture(page, () => page.reload({ timeout: 5000 }), false);
  await expect(page.locator("#solo")).toBeVisible();
});

test("P2-03: 想定外の実alertを回収し次の終了確認を処理できる", async ({
  page,
}) => {
  await home(page);
  await expect(
    confirmDeparture(
      page,
      () => page.evaluate(() => alert("試験用alert")),
      false,
    ),
  ).rejects.toThrow("想定外のダイアログ");
  expect(page.listenerCount("dialog")).toBe(0);
  await confirmDeparture(page, () => page.reload({ timeout: 5000 }), false);
  await expect(page.locator("#solo")).toBeVisible();
});

test("外部Back取消を繰り返しても設定・保存・履歴を保持し、続行/Forwardできる", async ({
  page,
}) => {
  await page.goto("http://127.0.0.1:5379/exit-test-outside");
  await home(page);
  await page.locator("#home-settings").click();
  await expect(
    page.getByRole("heading", { name: "設定", exact: true }),
  ).toBeVisible();
  const before = await state(page);
  for (let i = 0; i < 4; i++) {
    await confirmDeparture(page, () => page.goBack({ timeout: 5000 }), false);
    expect(await state(page)).toEqual(before);
    await expect(page.locator("dialog[open]")).toBeVisible();
  }
  let burstDialogs = 0;
  const dismissBurst = async (dialog: import("@playwright/test").Dialog) => {
    expect(dialog.type()).toBe("beforeunload");
    burstDialogs++;
    await dialog.dismiss();
  };
  page.on("dialog", dismissBurst);
  await page.evaluate(() => {
    history.back();
    history.back();
    history.back();
  });
  await expect.poll(() => burstDialogs).toBeGreaterThan(0);
  // Let the browser coalesce/process the intentionally overlapping traversals.
  await page.waitForTimeout(300);
  page.off("dialog", dismissBurst);
  expect(await state(page)).toEqual(before);
  await page.screenshot({
    path: "dist-validation/exit-confirmation/cancel-keeps-settings.png",
  });
  await confirmDeparture(page, () => page.goBack({ timeout: 5000 }), true);
  await expect(
    page.getByRole("heading", { name: "ゲーム外のテストページ" }),
  ).toBeVisible();
  await page.goForward();
  await expect(page.locator("#solo")).toBeAttached();
  expect(await page.evaluate(() => history.length)).toBe(before.history);
});

test("更新の取消と続行、タブ閉じるの取消と続行", async ({ page }) => {
  await home(page);
  const before = await state(page);
  await confirmDeparture(page, () => page.reload({ timeout: 5000 }), false);
  expect(await state(page)).toEqual(before);
  await confirmDeparture(page, () => page.reload({ timeout: 5000 }), true);
  await page
    .getByRole("button", { name: "SWARM FRONT はじめる", exact: true })
    .click();
  await expect(page.locator(".title-entry")).toHaveCount(0);
  await confirmDeparture(
    page,
    () => page.close({ runBeforeUnload: true }),
    false,
  );
  expect(page.isClosed()).toBe(false);
  await expect(page.locator("#solo")).toBeVisible();
  const closed = page.waitForEvent("close");
  await confirmDeparture(
    page,
    () => page.close({ runBeforeUnload: true }),
    true,
  );
  await closed;
});

test("通常戻る・モーダル閉じる・進撃/生存/協力入口の明示移動は終了確認なし", async ({
  page,
}) => {
  const unexpected: string[] = [];
  page.on("dialog", async (dialog) => {
    unexpected.push(dialog.type());
    await dialog.dismiss();
  });
  await home(page);
  await page.locator("#open-armory").click();
  if (await page.locator("#pt-confirm").isVisible())
    await page.locator("#pt-confirm").click();
  await expect(
    page.getByRole("heading", { name: "基地", exact: true }),
  ).toBeVisible();
  await page.locator("#pt-base-buddy").click();
  await page.locator("#pt-base").click();
  await page.locator("#pt-home").click();
  await page.locator("#solo").click();
  await page.locator('[data-operation="survival"]').click();
  await expect(page.locator("#front-base")).toBeVisible();
  await page.locator("#front-base").click();
  await page.locator("#base-back").click();
  await page.locator("#front-prep-settings").click();
  await page.locator("#front-settings-back").click();
  await page.locator("#front-back").click();
  await page.locator("#coop").click();
  await page.locator('[data-operation="advance"]').click();
  await expect(page.locator(".room-browser")).toBeVisible();
  await page.locator("#home").click();
  await page
    .getByRole("button", { name: "SWARM FRONT はじめる", exact: true })
    .click();
  await expect(page.locator(".title-entry")).toHaveCount(0);
  await page.locator("#coop").click();
  await page.locator('[data-operation="survival"]').click();
  await expect(page.locator(".room-browser")).toBeVisible();
  await page.locator("#home").click();
  await page.locator("#solo").click();
  await page.locator(".dialog-close").click();
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  expect(unexpected).toEqual([]);
  await page.screenshot({
    path: "dist-validation/exit-confirmation/mode-crossing.png",
  });
});

test("カードの閲覧状態はBack取消で保持され、画面内戻るは確認なし", async ({
  page,
}) => {
  await page.goto("http://127.0.0.1:5379/exit-test-outside");
  await home(page);
  await page.locator("#solo").click();
  await page.locator('[data-operation="survival"]').click();
  await page.locator("#front-base").click();
  // Tab selection is local UI state and must also survive cancellation.
  await page.locator("#base-fusions").click();
  const before = await state(page);
  await confirmDeparture(page, () => page.goBack({ timeout: 5000 }), false);
  expect(await state(page)).toEqual(before);
  await expect(page.locator("#base-fusions")).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.locator("#base-back").click();
  await expect(page.locator("#front-launch")).toBeVisible();
});

test("未保存カード編集は更新取消で保持され、通常戻るでは既存の破棄確認を使う", async ({
  page,
}) => {
  await home(page);
  await page.locator("#solo").click();
  await page.locator('[data-operation="survival"]').click();
  await page.locator("#front-mode").selectOption("defense");
  await page.locator("#front-base").click();
  await page.locator("#base-name").fill("未保存の確認用デッキ");
  const before = await state(page);
  await confirmDeparture(page, () => page.reload({ timeout: 5000 }), false);
  expect(await state(page)).toEqual(before);
  await expect(page.locator("#base-name")).toHaveValue("未保存の確認用デッキ");
  await page.locator("#base-back").click();
  await expect(
    page.getByText("編集中の変更があります", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "編集を続ける", exact: true }).click();
  await expect(page.locator("#base-name")).toHaveValue("未保存の確認用デッキ");
  await page.screenshot({
    path: "dist-validation/exit-confirmation/unsaved-draft-preserved.png",
  });
});

test("ローカル実WebSocketの協力ロビーと編成は更新取消で保持する", async ({
  page,
}) => {
  const sockets: import("@playwright/test").WebSocket[] = [];
  page.on("websocket", (socket) => {
    if (socket.url().includes(":8918")) sockets.push(socket);
  });
  await home(page);
  await page.locator("#coop").click();
  await page.locator('[data-operation="advance"]').click();
  await page.locator(".coop-advanced summary").click();
  await page.locator("#endpoint").fill("http://127.0.0.1:8918");
  await page.locator("#creation-key").fill(localCreationKey());
  await page.locator("#launch").click();
  await expect(page.locator("#leave-lobby")).toBeVisible();
  await expect(page.locator(".squad-member.self")).toBeVisible();
  await expect(page.locator(".squad-member.self")).toContainText("HOST");
  const before = await page.locator(".squad-member.self").textContent();
  const history = await page.evaluate(() => history.length);
  await confirmDeparture(page, () => page.reload({ timeout: 5000 }), false);
  await expect(page.locator(".squad-member.self")).toHaveText(before!);
  expect(sockets.length).toBeGreaterThan(0);
  expect(sockets.every((socket) => !socket.isClosed())).toBe(true);
  expect(await page.evaluate(() => history.length)).toBe(history);
  await page.screenshot({
    path: "dist-validation/exit-confirmation/local-coop-preserved.png",
  });
});
