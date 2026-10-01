import { test, expect, type Page } from "@playwright/test";

// Public browser surfaces only: inputs, visible DOM, browser lifecycle and
// Playwright storageState. Never reach into __swarm or mutate a live run.
const ORIGIN = "http://127.0.0.1:5186";
const ENTRY = "/rebuild-p1a.html";
const errors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const found: string[] = [];
  errors.set(page, found);
  page.on("pageerror", (error) => found.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") found.push(message.text());
  });
});
test.afterEach(async ({ page }) => {
  expect(errors.get(page), "No uncaught exceptions or console errors").toEqual(
    [],
  );
});

async function ready(page: Page) {
  await page.goto(ENTRY);
  await expect(
    page.getByRole("heading", { name: "最初の強化を選択" }),
  ).toBeVisible({ timeout: 65000 });
  await expect(page.locator(".rebuild-card")).toHaveCount(3);
  await expect(page.getByTestId("rebuild-time")).toHaveText("0:00");
}

async function start(page: Page) {
  await ready(page);
  await page.getByTestId("rebuild-card-blast-core").click();
  await expect(page.locator(".rebuild-resume-cue")).toBeVisible();
  await expect(page.locator("#controls")).toBeVisible({ timeout: 10000 });
  await expect(page.getByTestId("rebuild-hud")).toContainText("取得 1/7");
}

function clockSeconds(text: string | null) {
  const [minutes, seconds] = (text || "0:00").split(":").map(Number);
  return minutes * 60 + seconds;
}

for (const viewport of [
  { width: 844, height: 390 },
  { width: 640, height: 360 },
]) {
  test(`initial cards fit one horizontal row at ${viewport.width}x${viewport.height}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await ready(page);
    await expect(
      page.getByRole("button", { name: "再抽選 残り2" }),
    ).toBeDisabled();
    await expect(page.locator("#controls")).toBeHidden();
    const rectangles = await page
      .locator(".rebuild-card")
      .evaluateAll((cards) =>
        cards.map((card) => {
          const box = card.getBoundingClientRect();
          return {
            x: box.x,
            y: box.y,
            right: box.right,
            bottom: box.bottom,
            width: box.width,
            height: box.height,
            scrollWidth: card.scrollWidth,
            clientWidth: card.clientWidth,
          };
        }),
      );
    expect(new Set(rectangles.map((box) => Math.round(box.y))).size).toBe(1);
    for (let index = 0; index < rectangles.length; index++) {
      const box = rectangles[index];
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(viewport.width);
      expect(box.bottom).toBeLessThanOrEqual(viewport.height);
      expect(box.width).toBeGreaterThan(150);
      expect(box.height).toBeGreaterThan(100);
      expect(box.scrollWidth).toBeLessThanOrEqual(box.clientWidth);
      if (index) expect(box.x).toBeGreaterThan(rectangles[index - 1].right);
    }
    await page.waitForTimeout(1200);
    await expect(page.getByTestId("rebuild-time")).toHaveText("0:00");
    const screenshot = testInfo.outputPath(
      `rebuild-selection-${viewport.width}x${viewport.height}.png`,
    );
    await page.screenshot({ path: screenshot });
    await testInfo.attach(`selection-${viewport.width}x${viewport.height}`, {
      path: screenshot,
      contentType: "image/png",
    });
  });
}

test("loading stays noninteractive and repeated selection retains the one-second safe resume", async ({
  page,
}) => {
  // Delay actual assets, without replacing their bytes or application state.
  await page.route(/\.(?:glb|gltf)(?:\?.*)?$/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 350));
    await route.continue();
  });
  await page.goto(ENTRY, { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "戦場を準備中" }),
  ).toBeVisible();
  await expect(page.locator("#controls")).toBeHidden();
  await expect(page.getByTestId("rebuild-pause")).toBeHidden();
  await expect(page.locator(".rebuild-card")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "最初の強化を選択" }),
  ).toBeVisible({ timeout: 65000 });
  const card = await page.getByTestId("rebuild-card-blast-core").boundingBox();
  expect(card).not.toBeNull();
  const selectedAt = Date.now();
  await page.mouse.click(
    card!.x + card!.width / 2,
    card!.y + card!.height / 2,
    { clickCount: 3, delay: 25 },
  );
  await expect(page.locator(".rebuild-resume-cue")).toBeVisible();
  await expect(page.locator("#controls")).toBeHidden();
  await expect(page.getByTestId("rebuild-time")).toHaveText("0:00");
  await page.waitForTimeout(450);
  await expect(page.locator(".rebuild-resume-cue")).toBeVisible();
  await expect(page.locator("#controls")).toBeHidden();
  await expect(page.locator("#controls")).toBeVisible({ timeout: 10000 });
  expect(Date.now() - selectedAt).toBeGreaterThanOrEqual(900);
  await expect(page.getByTestId("rebuild-hud")).toContainText("取得 1/7");
  await expect(page.getByTestId("rebuild-ammo")).toHaveText("AR 1 · 32 / 32");
  await expect
    .poll(
      async () =>
        clockSeconds(await page.getByTestId("rebuild-time").textContent()),
      { timeout: 10000 },
    )
    .toBeGreaterThanOrEqual(1);
});

test("pause freezes visible state and discards held fire, scope and queued keys", async ({
  page,
}) => {
  await start(page);
  await page.keyboard.press("KeyZ");
  await expect(page.locator("#scope-overlay")).toBeVisible();
  const fire = await page.locator("#fire").boundingBox();
  expect(fire).not.toBeNull();
  await page.keyboard.down("KeyW");
  await page.mouse.move(fire!.x + fire!.width / 2, fire!.y + fire!.height / 2);
  await page.mouse.down();
  await expect(page.getByTestId("rebuild-ammo")).not.toHaveText(
    "AR 1 · 32 / 32",
  );
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("heading", { name: "一時停止", exact: true }),
  ).toBeVisible();
  await expect(page.locator("#scope-overlay")).toBeHidden();
  await expect(page.locator("#controls")).toBeHidden();
  await page.getByText("試遊の計測値", { exact: true }).click();
  const stoppedPosition = await page
    .getByTestId("rebuild-position")
    .innerText();
  const heldHud = await page.getByTestId("rebuild-hud").innerText();
  await page.keyboard.press("KeyQ");
  await page.keyboard.press("KeyR");
  await page.waitForTimeout(1200);
  await expect(page.getByTestId("rebuild-hud")).toHaveText(heldHud);
  // Resume with the keyboard while fire and W remain physically held.
  await page.getByRole("button", { name: "再開", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".rebuild-resume-cue")).toBeVisible();
  await page.waitForTimeout(400);
  await expect(page.getByTestId("rebuild-hud")).toHaveText(heldHud);
  await expect(page.locator("#controls")).toBeVisible({ timeout: 10000 });
  // Repeating an already-held key produces a real repeat keydown through Playwright.
  await page.keyboard.down("KeyW");
  const heldAmmo = await page.getByTestId("rebuild-ammo").innerText();
  await page.waitForTimeout(700);
  await expect(page.getByTestId("rebuild-ammo")).toHaveText(heldAmmo);
  await expect(page.getByTestId("rebuild-ammo")).toContainText("AR 1");
  await expect(page.getByTestId("rebuild-ammo")).not.toContainText("装填中");
  await expect(page.locator("#scope-overlay")).toBeHidden();
  await expect(page.locator("#move > span")).toHaveAttribute("style", "");
  await page.mouse.up();
  await page.keyboard.up("KeyW");
  await page.getByTestId("rebuild-pause").click();
  await page.getByText("試遊の計測値", { exact: true }).click();
  await expect(page.getByTestId("rebuild-position")).toHaveText(
    stoppedPosition,
  );
  const pausedAgain = await page.getByTestId("rebuild-hud").innerText();
  await page.getByRole("button", { name: "再開", exact: true }).dblclick();
  await expect(page.locator(".rebuild-resume-cue")).toBeVisible();
  await expect(page.getByTestId("rebuild-hud")).toHaveText(pausedAgain);
  await expect(page.locator("#controls")).toBeVisible({ timeout: 10000 });
});

test("pause recenters a dragged movement stick before explicit resume", async ({
  page,
}) => {
  await start(page);
  const stick = await page.locator("#move").boundingBox();
  expect(stick).not.toBeNull();
  const center = {
    x: stick!.x + stick!.width / 2,
    y: stick!.y + stick!.height / 2,
  };
  await page.mouse.move(center.x, center.y);
  await page.mouse.down();
  await page.mouse.move(center.x + 35, center.y - 20, { steps: 3 });
  await expect(page.locator("#move > span")).toHaveAttribute(
    "style",
    /translate\(35px,-20px\)/,
  );
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("heading", { name: "一時停止", exact: true }),
  ).toBeVisible();
  await expect(page.locator("#move > span")).toHaveAttribute("style", "");
  await page.getByRole("button", { name: "再開", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#controls")).toBeVisible({ timeout: 10000 });
  // A continued old drag must not restore a discarded touch/input gesture.
  await page.mouse.move(center.x + 45, center.y - 25);
  await expect(page.locator("#move > span")).toHaveAttribute("style", "");
  await page.mouse.up();
});

test("a real background tab pauses combat until explicit resume", async ({
  page,
  context,
}, testInfo) => {
  await start(page);
  const otherTab = await context.newPage();
  await otherTab.goto("about:blank");
  await otherTab.bringToFront();
  await page.waitForTimeout(350);
  const hidden = await page.evaluate(() => document.hidden);
  // Chromium headless can keep all targets visible. Do not fake visibilitychange
  // or claim a real OS/tab lifecycle assertion when the runner cannot expose it.
  if (!hidden) {
    testInfo.annotations.push({
      type: "limitation",
      description:
        "Headless Chromium kept document.hidden=false after another tab was foregrounded; real tab visibility lifecycle requires a headed/browser-device check.",
    });
    await otherTab.close();
    test.skip(true, "This Chromium runner does not background tabs");
  }
  await expect(
    page.getByRole("heading", { name: "一時停止", exact: true }),
  ).toBeVisible();
  const stopped = await page.getByTestId("rebuild-hud").innerText();
  await page.waitForTimeout(1200);
  await expect(page.getByTestId("rebuild-hud")).toHaveText(stopped);
  await page.bringToFront();
  await expect(
    page.getByRole("heading", { name: "一時停止", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "再開", exact: true }).click();
  await expect(page.locator(".rebuild-resume-cue")).toBeVisible();
  await expect(page.locator("#controls")).toBeVisible({ timeout: 10000 });
  await otherTab.close();
});

test.describe("legacy save isolation", () => {
  const legacyStorage = [
    {
      name: "swarm-front-save-v1",
      value: JSON.stringify({
        syntheticFixture: "p1a-e2e-legacy",
        name: "P1a fixture",
        coins: 321,
        weapons: [{ id: "fixture-rifle", rarity: 4, level: 7 }],
      }),
    },
    {
      name: "swarm-front-progression-v2-normal",
      value: JSON.stringify({ syntheticFixture: "p1a-e2e-v2", coins: 654 }),
    },
    {
      name: "swarm-front-shared-progress-v3",
      value: JSON.stringify({
        syntheticFixture: "p1a-e2e-v3",
        coins: 987,
        defenseLedger: { "2099-01-01": { attempts: 2, rewarded: true } },
      }),
    },
  ];
  test.use({
    storageState: {
      cookies: [],
      origins: [{ origin: ORIGIN, localStorage: legacyStorage }],
    },
  });
  test("retry and reload start fresh without writing or migrating existing saves", async ({
    page,
    context,
  }) => {
    const saved = await context.storageState();
    await start(page);
    await expect
      .poll(
        async () =>
          clockSeconds(await page.getByTestId("rebuild-time").textContent()),
        { timeout: 10000 },
      )
      .toBeGreaterThanOrEqual(1);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "最初から試す" }).dblclick();
    await expect(
      page.getByRole("heading", { name: "最初の強化を選択" }),
    ).toBeVisible();
    await expect(page.locator(".rebuild-pick-count")).toContainText(
      "取得 0 / 7",
    );
    await expect(page.getByTestId("rebuild-time")).toHaveText("0:00");
    await expect(page.getByTestId("rebuild-ammo")).toHaveText("AR 1 · 32 / 32");
    await expect(page.getByTestId("rebuild-xp")).toContainText("XP 0");
    await expect(
      page.getByRole("button", { name: "再抽選 残り2" }),
    ).toBeDisabled();
    await page.waitForTimeout(350);
    await page.getByTestId("rebuild-card-fuse").click();
    await expect(page.locator("#controls")).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("rebuild-hud")).toContainText("取得 1/7");
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "最初の強化を選択" }),
    ).toBeVisible({ timeout: 65000 });
    await expect(page.locator(".rebuild-pick-count")).toContainText(
      "取得 0 / 7",
    );
    await expect(page.getByTestId("rebuild-time")).toHaveText("0:00");
    await expect(page.getByTestId("rebuild-xp")).toContainText("XP 0");
    await expect(page.locator(".rebuild-card")).toHaveCount(3);
    const after = await context.storageState();
    const orderedOrigins = (state: typeof saved) =>
      state.origins
        .map((entry) => ({
          ...entry,
          localStorage: [...entry.localStorage].sort((a, b) =>
            a.name.localeCompare(b.name),
          ),
        }))
        .sort((a, b) => a.origin.localeCompare(b.origin));
    expect(orderedOrigins(after)).toEqual(orderedOrigins(saved));
    expect(after.cookies).toEqual(saved.cookies);
  });
});
