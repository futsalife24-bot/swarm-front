import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
const manifest = JSON.parse(
  readFileSync(
    new URL(
      "../public/assets/event-banners/consumer-manifest.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as { assets: { eventId: string; inMs: number }[] };

// Vite may timestamp dependency URLs after HMR. Use the instance imported by
// the actual entry point so navigation cancellation exercises the same renderer.
async function openFront(page: Page, url = "/front") {
  let cueUrl = "";
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/src/client/operation-cue.ts")
      cueUrl = request.url();
  });
  await page.goto(url);
  expect(cueUrl).not.toBe("");
  return cueUrl;
}

for (const variant of ["standard", "mobile"] as const) {
  for (const asset of manifest.assets) {
    const id = asset.eventId;
    test(`received ${variant} ${id}: real APNG loads, holds, expires`, async ({
      page,
    }) => {
      await page.setViewportSize({
        width: variant === "standard" ? 1280 : 844,
        height: variant === "standard" ? 720 : 390,
      });
      const cueUrl = await openFront(page);
      const images: string[] = [];
      page.on("request", (request) => {
        if (/\/event-banners\/.*\.(apng|png)$/.test(request.url()))
          images.push(request.url());
      });
      await page.evaluate(
        async ({ id, variant, cueUrl }) => {
          const { createOperationCueRenderer } = await import(cueUrl);
          const state = window as any;
          state.realCue = createOperationCueRenderer({
            mobile: () => variant === "mobile",
            lowPower: () => false,
            reduced: () => false,
            off: () => false,
          });
          state.realCue.show(id, { key: `real:${variant}:${id}` });
        },
        { id, variant, cueUrl },
      );
      await expect(page.locator(".operation-cue")).toHaveClass(/is-loaded/);
      const image = page.locator(".operation-cue img");
      await expect(image).toHaveAttribute(
        "src",
        `/assets/event-banners/${variant}/${id}.apng`,
      );
      expect(
        await image.evaluate((img: HTMLImageElement) => [
          img.naturalWidth,
          img.naturalHeight,
        ]),
      ).toEqual(variant === "standard" ? [960, 336] : [640, 224]);
      await expect(image).toHaveCSS("pointer-events", "none");
      await page.waitForTimeout(asset.inMs + 100);
      await page.locator(".operation-cue").screenshot({
        path: `docs/evidence/swarm-growth-loop-20261012/event-banners/${variant}-${id}.png`,
      });
      expect(images).toHaveLength(1);
      await expect(page.locator(".operation-cue")).toHaveCount(0, {
        timeout: 3500,
      });
    });
  }
}

test("OS reduce loads the received PNG only and mobile menu remains operable", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const cueUrl = await openFront(page);
  await page.clock.install({ time: new Date("2026-10-12T12:00:00Z") });
  await page.clock.pauseAt(new Date("2026-10-12T12:00:05Z"));
  const images: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/event-banners/")) images.push(request.url());
  });
  await page.evaluate(async (cueUrl) => {
    const cue = await import(cueUrl);
    cue.showOperationCue("srv-ended", { key: "os-reduce-real" });
  }, cueUrl);
  await expect(page.locator(".operation-cue")).toHaveClass(/is-loaded/);
  await expect(page.locator(".operation-cue img")).toHaveAttribute(
    "src",
    "/assets/event-banners/mobile/srv-ended.png",
  );
  await page.locator("#solo").click();
  await page.locator("[data-operation=survival]").click();
  await expect(page.locator(".front-prep")).toBeVisible();
  await expect(page.locator(".operation-cue")).toHaveCount(0);
  // Existing return/navigation cancels the visual without waiting on its image.
  await page.locator("#front-back").click();
  await expect(page.locator(".operation-cue")).toHaveCount(0);
  expect(images.every((url) => url.endsWith(".png"))).toBe(true);
});

test("user motion off swaps the real APNG, keeps result data and cancels on hide", async ({
  page,
}) => {
  const cueUrl = await openFront(page);
  await page.evaluate(async (cueUrl) => {
    const cue = await import(cueUrl);
    const state = window as any;
    state.progressBeforeCue = localStorage.getItem(
      "swarm-front-shared-progress-v3",
    );
    cue.showOperationCue("srv-extract", { key: "mid-switch-real" });
  }, cueUrl);
  await expect(page.locator(".operation-cue")).toHaveClass(/is-loaded/);
  const before = await page.locator(".operation-cue img").getAttribute("src");
  expect(before).toMatch(/\.apng$/);
  await page.evaluate(async () => {
    const preferences = await import("/src/client/menu-effects.ts" as string);
    preferences.setMenuReducedMotion(true);
  });
  await expect(page.locator(".operation-cue img")).toHaveAttribute(
    "src",
    "/assets/event-banners/mobile/srv-extract.png",
  );
  await expect(page.locator(".operation-cue")).toHaveClass(/is-loaded/);
  expect(
    await page.evaluate(
      () =>
        localStorage.getItem("swarm-front-shared-progress-v3") ===
        (window as any).progressBeforeCue,
    ),
  ).toBe(true);
  await page.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent("pagehide")),
  );
  await expect(page.locator(".operation-cue")).toHaveCount(0);
});

test("actual solo sortie shows its received image and the existing Escape pause interrupts immediately", async ({
  page,
}) => {
  await openFront(page, "/front?solo=1");
  await expect(page.locator(".front-prep")).toBeVisible();
  await page.locator("#front-launch").click();
  await expect(page.locator(".operation-cue")).toHaveAttribute(
    "data-event",
    "srv-sortie",
    { timeout: 45000 },
  );
  await expect(page.locator(".operation-cue")).toHaveClass(/is-loaded/);
  await expect(page.locator(".operation-cue-skip")).toBeHidden();
  // Opening growth choice intentionally hides the pointer pause button. Its
  // existing Escape handler still cancels the visual, without an extra hitbox.
  await page.keyboard.press("Escape");
  await expect(page.locator(".operation-cue")).toHaveCount(0);
  await expect(page.locator(".front-pause")).toBeVisible();
  await page.screenshot({
    path: "docs/evidence/swarm-growth-loop-20261012/event-banners/actual-solo-canceled-844.png",
  });
});
