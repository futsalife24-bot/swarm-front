import { test, expect } from "@playwright/test";

// A tiny synthetic PNG checks lifecycle/input only, never the producer artwork.
const pixel = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==",
  "base64",
);
test.beforeEach(async ({ page }) => {
  await page.route("**/cue-fixture/**", (route) =>
    route.fulfill({ contentType: "image/png", body: pixel }),
  );
  await page.goto("/front");
  await page.clock.install();
  await page.evaluate(async () => {
    const { createOperationCueRenderer } = await import(
      "/src/client/operation-cue.ts" as string
    );
    const ids = [
      "adv-sortie",
      "adv-extract",
      "adv-failed",
      "adv-complete",
      "srv-sortie",
      "srv-extract",
      "srv-ended",
    ];
    const state = window as any;
    state.cueReduced = false;
    state.cueNotices = [];
    window.addEventListener("swarm:operation-cue", (event: any) =>
      state.cueNotices.push(event.detail),
    );
    state.cueRenderer = createOperationCueRenderer({
      sources: Object.fromEntries(
        ids.map((id) => [
          id,
          Object.fromEntries(
            ["standard", "mobile"].map((v) => [
              v,
              {
                apng: `/cue-fixture/${v}/${id}.apng`,
                png: `/cue-fixture/${v}/${id}.png`,
              },
            ]),
          ),
        ]),
      ),
      mobile: () => innerWidth < 960,
      lowPower: () => false,
      reduced: () => state.cueReduced,
      off: () => false,
    });
  });
});

test("new events cancel old timers and repeated result keys announce once", async ({
  page,
}) => {
  await page.evaluate(() =>
    (window as any).cueRenderer.show("srv-sortie", { key: "run:sortie" }),
  );
  await page.clock.runFor(1500);
  await page.evaluate(() =>
    (window as any).cueRenderer.show("adv-complete", { key: "run:result" }),
  );
  expect(
    await page.evaluate(() =>
      (window as any).cueRenderer.show("adv-complete", { key: "run:result" }),
    ),
  ).toBe(false);
  await page.clock.runFor(700);
  await expect(page.locator(".operation-cue")).toHaveAttribute(
    "data-event",
    "adv-complete",
  );
  expect(await page.evaluate(() => (window as any).cueNotices.length)).toBe(2);
  await page.clock.runFor(2340);
  await expect(page.locator(".operation-cue")).toHaveCount(0);
});

test("mobile image is decorative and skip stays in menu flow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 667, height: 390 });
  await page.evaluate(() =>
    (window as any).cueRenderer.show("srv-ended", { key: "phone" }),
  );
  await page.clock.runFor(1);
  const image = page.locator(".operation-cue img");
  await expect(image).toHaveAttribute(
    "src",
    "/cue-fixture/mobile/srv-ended.apng",
  );
  await expect(image).toHaveAttribute("alt", "");
  await expect(image).toHaveAttribute("aria-hidden", "true");
  await expect(image).toHaveCSS("pointer-events", "none");
  const bounds = await page.locator(".operation-cue").boundingBox();
  expect(bounds!.width).toBeLessThanOrEqual(667);
  expect(bounds!.height).toBeLessThanOrEqual(390 * 0.3 + 1);
  expect(bounds!.width / bounds!.height).toBeCloseTo(20 / 7, 1);
  expect(
    await page
      .locator(".operation-cue-skip")
      .evaluate((b) => b.parentElement!.className),
  ).toBe("home-utilities");
  await page.locator(".operation-cue-skip").click();
  await expect(page.locator(".operation-cue")).toHaveCount(0);
});

// 横画面のスマホで幅いっぱいにすると、帯の高さが画面の6〜8割を占めていた。
for (const [width, height] of [
  [667, 375],
  [844, 390],
  [915, 412],
  [1280, 720],
  [1920, 1080],
] as const)
  test(`banner stays within 30% of the ${width}x${height} viewport height`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    for (const id of ["adv-sortie", "srv-sortie", "adv-complete"]) {
      await page.evaluate(
        (id) => (window as any).cueRenderer.show(id, { key: `size:${id}` }),
        id,
      );
      await page.clock.runFor(1);
      await expect(page.locator(".operation-cue")).toHaveClass(/is-loaded/);
      const bounds = (await page.locator(".operation-cue").boundingBox())!;
      expect(bounds.height).toBeLessThanOrEqual(height * 0.3 + 1);
      expect(bounds.height).toBeGreaterThanOrEqual(
        Math.min(height * 0.3, 336) - 2,
      );
      expect(bounds.width).toBeLessThanOrEqual(Math.min(width, 960));
      expect(bounds.width / bounds.height).toBeCloseTo(20 / 7, 1);
      expect(bounds.y).toBeLessThanOrEqual(8.5);
      expect(bounds.x + bounds.width / 2).toBeCloseTo(width / 2, 0);
    }
  });

test("reduced motion never requests APNG and mid-display switching releases it", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("cue-fixture")) requests.push(r.url());
  });
  await page.evaluate(() => {
    (window as any).cueReduced = true;
    (window as any).cueRenderer.show("srv-ended", { key: "static" });
  });
  await expect(page.locator(".operation-cue img")).toHaveAttribute(
    "src",
    "/cue-fixture/mobile/srv-ended.png",
  );
  expect(requests.some((url) => url.endsWith(".apng"))).toBe(false);
  await page.evaluate(() => {
    (window as any).cueReduced = false;
    (window as any).cueRenderer.show("srv-sortie", { key: "animated" });
  });
  await expect(page.locator(".operation-cue img")).toHaveAttribute(
    "src",
    "/cue-fixture/mobile/srv-sortie.apng",
  );
  await page.evaluate(() => {
    const w = window as any;
    w.oldCueImage = document.querySelector(".operation-cue img");
    w.cueReduced = true;
    document.dispatchEvent(new Event("swarm-motion-preference"));
  });
  await expect(page.locator(".operation-cue img")).toHaveAttribute(
    "src",
    "/cue-fixture/mobile/srv-sortie.png",
  );
  expect(
    await page.evaluate(() => [
      (window as any).oldCueImage.hasAttribute("src"),
      (window as any).oldCueImage.isConnected,
      (window as any).cueNotices.length,
    ]),
  ).toEqual([false, false, 2]);
  await page.clock.runFor(2120);
  await expect(page.locator(".operation-cue")).toHaveCount(0);
});

test("APNG failure falls back once and late old load cannot revive canceled visuals", async ({
  page,
}) => {
  await page.route("**/cue-fixture/**/*.apng", (route) => route.abort());
  await page.evaluate(() =>
    (window as any).cueRenderer.show("adv-failed", { key: "failed-image" }),
  );
  await expect(page.locator(".operation-cue img")).toHaveAttribute(
    "src",
    "/cue-fixture/mobile/adv-failed.png",
  );
  await page.evaluate(() => {
    const w = window as any;
    w.staleLoad = (
      document.querySelector(".operation-cue img") as HTMLImageElement
    ).onload;
    w.cueRenderer.cancel();
    w.staleLoad?.(new Event("load"));
  });
  await expect(page.locator(".operation-cue")).toHaveCount(0);
  await page.evaluate(() =>
    (window as any).cueRenderer.show("srv-ended", { key: "new-after-error" }),
  );
  await page.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent("pagehide")),
  );
  await expect(page.locator(".operation-cue")).toHaveCount(0);
});

test("battle adds no skip hitbox and an event timer expires without a loaded image", async ({
  page,
}) => {
  await page.route("**/cue-fixture/**", (route) => route.abort());
  await page.evaluate(() => {
    document.body.dataset.screen = "battle";
    (window as any).cueRenderer.show("adv-sortie", { key: "battle" });
  });
  await page.clock.runFor(1);
  await expect(page.locator(".operation-cue-skip")).toBeHidden();
  await expect(page.locator(".operation-cue")).toHaveCSS(
    "pointer-events",
    "none",
  );
  await page.clock.runFor(1979);
  await expect(page.locator(".operation-cue")).toHaveCount(0);
});
