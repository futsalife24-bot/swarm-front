import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs";
const out = "dist-validation/title-layout";
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
const errors = [],
  results = [];
try {
  const page = await browser.newPage({ serviceWorkers: "block" });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:5198");
  await page.locator("#home-tutorial").waitFor();
  for (const [width, height] of [
    [1280, 582],
    [1440, 900],
    [844, 390],
    [667, 375],
    [640, 360],
    [568, 320],
    [667, 400],
    [667, 401],
  ]) {
    await page.setViewportSize({ width, height });
    const frame = await page.locator(".home-command").evaluate((el) => {
      const r = el.getBoundingClientRect(),
        heading = el.querySelector(".command-heading"),
        h = heading.getBoundingClientRect();
      return {
        top: r.top,
        bottom: r.bottom,
        inside: r.top >= 0 && r.bottom <= innerHeight,
        headingHidden: getComputedStyle(heading).display === "none",
        headingInside: h.top >= 0 && h.bottom <= innerHeight,
      };
    });
    assert.ok(
      frame.inside && (frame.headingHidden || frame.headingInside),
      JSON.stringify({ width, height, frame }),
    );
    const geometry = await page.evaluate(() =>
      [...document.querySelectorAll(".home-command button")].map((b) => {
        const r = b.getBoundingClientRect(),
          hit = document.elementFromPoint(
            r.x + r.width / 2,
            r.y + r.height / 2,
          );
        const text = [...b.childNodes].find(
          (n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim(),
        );
        const range = document.createRange();
        if (text) range.selectNodeContents(text);
        return {
          id: b.id,
          inside:
            r.x >= 0 &&
            r.y >= 0 &&
            r.right <= innerWidth &&
            r.bottom <= innerHeight,
          reachable: hit === b || b.contains(hit),
          overflow: b.scrollWidth > b.clientWidth + 1,
          lines: text ? range.getClientRects().length : 0,
          height: r.height,
        };
      }),
    );
    assert.ok(
      geometry.every((b) => b.inside && b.reachable && !b.overflow),
      JSON.stringify({ width, height, geometry }),
    );
    assert.ok(
      geometry
        .filter((b) =>
          [
            "home-tutorial",
            "home-settings",
            "pt-daily-defense",
            "pt-weekly-missions",
          ].includes(b.id),
        )
        .every((b) => b.lines === 1 && b.height >= 38),
      JSON.stringify(geometry),
    );
    await page.screenshot({
      path: `${out}/title-${width}${width === 667 && height !== 375 ? "-" + height : ""}.png`,
    });
    results.push({ width, height, frame, geometry });
  }
  await page.setViewportSize({ width: 844, height: 390 });
  // Optional PWA entry and the longest campaign label use the shared renderer.
  const optional = await browser.newPage({
    viewport: { width: 568, height: 320 },
    serviceWorkers: "block",
  });
  await optional.goto("http://127.0.0.1:5198");
  await optional.locator("#home-tutorial").waitFor();
  await optional.evaluate(async () => {
    const { homeMarkup } = await import("/src/client/home-screen.ts"),
      { STAGES } = await import("/src/shared/stages.ts");
    const stage = [...STAGES].sort((a, b) => b.name.length - a.name.length)[0];
    const challenges = document.querySelector(".home-challenges").innerHTML;
    document.querySelector("#ui").innerHTML = homeMarkup({
      stage,
      inventoryCount: 0,
      install: true,
    });
    document.querySelector(".home-challenges").innerHTML = challenges;
  });
  const install = await optional.locator("#install").evaluate((b) => {
    const r = b.getBoundingClientRect();
    return {
      inside: r.bottom <= innerHeight && r.right <= innerWidth,
      overflow: b.scrollWidth > b.clientWidth + 1,
    };
  });
  assert.ok(install.inside && !install.overflow, JSON.stringify(install));
  await optional.screenshot({ path: `${out}/title-install.png` });
  await optional.close();
  // Existing reward badge stays inside its new challenge row.
  await page.evaluate(async () => {
    const p = await import("/src/client/progression-save.ts"),
      c = await import("/src/shared/calendar.ts");
    const s = p.initializeProgress("normal");
    s.weekly = {
      week: c.japanWeek(Date.now()),
      campaign: Array.from({ length: 10 }, (_, i) => "layout-" + i),
      defense: ["a", "b", "c"],
      claimed: [],
    };
    p.persistProgress(s);
  });
  await page.reload();
  await page
    .locator("#pt-weekly-missions .weekly-notification:not([hidden])")
    .waitFor();
  assert.equal(await page.locator(".weekly-notification").textContent(), "3");
  await page.screenshot({ path: `${out}/title-badge.png` });
  for (const id of ["home-tutorial", "home-settings", "pt-weekly-missions"]) {
    await page.locator("#" + id).click();
    await page.locator("dialog[open]").waitFor();
    await page.keyboard.press("Escape");
    await page.locator("dialog[open]").waitFor({ state: "detached" });
    assert.equal(await page.evaluate(() => document.activeElement.id), id);
  }
  await page.locator("#pt-daily-defense").click();
  await page.locator("dialog[open]").waitFor();
  await page.keyboard.press("Escape");
  await page.locator("#solo").click();
  if (await page.locator("#pt-confirm").isVisible())
    await page.locator("#pt-confirm").click();
  if (
    await page
      .getByRole("button", { name: "この名前で登録", exact: true })
      .isVisible()
  ) {
    await page.locator("dialog input").fill("UI検証");
    await page
      .getByRole("button", { name: "この名前で登録", exact: true })
      .click();
  }
  await page.screenshot({ path: `${out}/solo.png` });
  await page.locator(".gear").waitFor();
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    `${out}/checks.json`,
    JSON.stringify(
      { pass: true, results, badge: 3, dialogs: true, solo: true, errors },
      null,
      2,
    ),
  );
  console.log("TITLE LAYOUT PASS");
} finally {
  await browser.close();
}
