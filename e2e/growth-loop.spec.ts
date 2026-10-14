import { test, expect } from "@playwright/test";

test("common title, repeat navigation and reduced motion at phone sizes", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const width of [844, 667]) {
    await page.setViewportSize({ width, height: 390 });
    await page.goto("/front");
    await expect(page.locator("#solo")).toContainText("ソロ：進撃 または 生存");
    await expect(page.locator("#coop")).toContainText("協力：進撃 または 生存");
    for (let i = 0; i < 4; i++) {
      await page.locator("#solo").click();
      await expect(page.locator("[data-operation=survival]")).toBeVisible();
      await page.locator("[data-operation=survival]").click();
      await expect(page.locator(".front-prep")).toBeVisible();
      await page.locator("#front-back").click();
    }
    const bounds = await page.locator("#solo").boundingBox();
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
    await page.screenshot({
      path: `docs/evidence/swarm-growth-loop-20261012/title-${width}.png`,
    });
  }
  await page.locator("#home-settings").click();
  const reduced = page.getByRole("switch", { name: "動きを抑える" });
  await reduced.click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-menu-reduced-motion",
    "true",
  );
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute(
    "data-menu-reduced-motion",
    "true",
  );
  expect(errors).toEqual([]);
});

test("advance and cooperative survival route from the common title", async ({
  page,
}) => {
  await page.goto("/front");
  await page.locator("#solo").click();
  await page.locator("[data-operation=advance]").click();
  await expect(page.locator(".gear")).toBeVisible();
  expect(page.url()).toContain("solo=1");
  await page.goto("/front");
  await page.locator("#coop").click();
  await page.locator("[data-operation=survival]").click();
  await expect(page.locator("#room-id")).toBeVisible();
});

test("weapon workshop confirms atomic cost and ignores double processing", async ({
  page,
}) => {
  await page.goto("/front?solo=1");
  await expect(page.locator(".front-prep")).toBeVisible();
  await page.evaluate(() => {
    const key = "swarm-front-shared-progress-v3",
      s = JSON.parse(localStorage.getItem(key)!);
    s.powder = 100;
    localStorage.setItem(key, JSON.stringify(s));
  });
  await page.locator("#front-base").click();
  await page.getByRole("button", { name: "武器工房", exact: true }).click();
  await expect(page.locator(".weapon-workshop")).toBeVisible();
  await page.locator("#workshop-modify").click();
  await expect(page.locator("dialog")).toContainText("武装片 100 → 97");
  await page
    .locator("dialog [data-commit]")
    .evaluate((b: HTMLButtonElement) => {
      b.click();
      b.click();
    });
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("swarm-front-shared-progress-v3")!),
  );
  expect(saved.powder).toBe(97);
  expect(saved.inventory[0].mods.damage).toBe(1);
  await page.locator("#workshop-kind").selectOption("rocket");
  await page.locator("#workshop-convert").click();
  await page.locator("dialog [data-commit]").click();
  const transformed = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("swarm-front-shared-progress-v3")!),
  );
  expect(transformed.inventory[0].id).toBe(saved.inventory[0].id);
  expect(transformed.inventory[0].mods.damage).toBe(1);
  expect(transformed.soldiers[0].equipped).toEqual(saved.soldiers[0].equipped);
  await expect(page.locator(".weapon-workshop")).toHaveCSS("opacity", "1");
  await page.screenshot({
    path: "docs/evidence/swarm-growth-loop-20261012/workshop-844.png",
  });
  await page.reload();
  await page.locator("#front-base").click();
  await page.getByRole("button", { name: "武器工房", exact: true }).click();
  await expect(page.locator(".weapon-workshop")).toContainText("火力 1/10");
});

test("optional operation cues can be skipped and interrupted with a static fallback", async ({
  page,
}) => {
  await page.goto("/front");
  await page.evaluate(async () => {
    const cue = await import("/src/client/operation-cue.ts" as string);
    cue.showOperationCue("srv-ended");
  });
  await expect(page.locator(".operation-cue")).toContainText("戦闘終了");
  await page.locator(".operation-cue-skip").click();
  await expect(page.locator(".operation-cue")).toHaveCount(0);
  await page.evaluate(async () => {
    const cue = await import("/src/client/operation-cue.ts" as string);
    cue.showOperationCue("srv-sortie");
    cue.showOperationCue("srv-extract");
  });
  await expect(page.locator(".operation-cue")).toHaveCount(1);
  await expect(page.locator(".operation-cue")).toContainText("撤収完了");
  await page.evaluate(async () => {
    const cue = await import("/src/client/operation-cue.ts" as string);
    cue.cancelOperationCue();
  });
  await expect(page.locator(".operation-cue")).toHaveCount(0);
});

test("growth values preserve the existing one-row weapon layout in landscape", async ({
  page,
}) => {
  await page.goto("/front?solo=1");
  await expect(page.locator(".front-prep")).toBeVisible();
  await page.evaluate(async () => {
    const progression = await import("/src/shared/progression.ts" as string);
    const key = "swarm-front-shared-progress-v3",
      save = JSON.parse(localStorage.getItem(key)!);
    const kinds = ["rifle", "shotgun", "rocket", "sniper", "medic", "laser"];
    for (let i = 0; i < 24; i++)
      save.inventory.push({
        ...progression.makeWeapon(
          `layout-${i}`,
          kinds[i % kinds.length],
          i % 5,
          { power: 20, reload: -10, range: 20, rate: 20 },
          false,
          save.serial++,
        ),
        level: 60,
        mods: { damage: 10, speed: 10, mag: 10 },
      });
    localStorage.setItem(key, JSON.stringify(save));
  });
  await page.reload();
  await expect(page.locator(".front-prep")).toBeVisible();
  const layout = await page.locator(".gear-weapon-list").evaluate((list) => {
    const rows = [...list.querySelectorAll("[data-row]")];
    return {
      scroll: list.scrollWidth - list.clientWidth,
      rows: rows.length,
      overlap: rows.some((row) => {
        const cells = [...row.querySelectorAll(".pt-stat-inner>span")];
        return cells.some((cell, i) => {
          const range = document.createRange();
          range.selectNodeContents(cell);
          return (
            i < cells.length - 1 &&
            range.getBoundingClientRect().right >
              cells[i + 1].getBoundingClientRect().left + 1
          );
        });
      }),
    };
  });
  expect(layout.rows).toBe(27);
  expect(layout.scroll).toBeLessThanOrEqual(1);
  expect(layout.overlap).toBe(false);
  await page.screenshot({
    path: "docs/evidence/swarm-growth-loop-20261012/gear-growth-844.png",
  });
});
