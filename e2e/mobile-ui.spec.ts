import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
const dir = "dist-validation/evidence";
mkdirSync(dir, { recursive: true });
test.use({
  viewport: { width: 844, height: 320 },
  isMobile: true,
  hasTouch: true,
});
async function gear(page: any) {
  await page.goto("/");
  await page.getByRole("button", { name: "ソロで出撃準備" }).click();
}
async function geometry(page: any) {
  return page.evaluate(() => {
    const box = (el: Element) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    };
    return {
      w: innerWidth,
      h: innerHeight,
      controls: [...document.querySelectorAll("#move,#controls button")].map(
        box,
      ),
      hud: [...document.querySelectorAll(".hud-rail>div")].map(box),
    };
  });
}
function intersects(a: any, b: any) {
  return (
    a.x < b.x + b.w - 1 &&
    a.x + a.w > b.x + 1 &&
    a.y < b.y + b.h - 1 &&
    a.y + a.h > b.y + 1
  );
}
test("short landscape title and weapon list fit without HUD/control collisions after resizing", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const size of [
    { width: 844, height: 320 },
    { width: 640, height: 280 },
  ]) {
    await page.setViewportSize(size);
    await page.goto("/");
    for (const id of ["solo", "coop"]) {
      const b = (await page.locator("#" + id).boundingBox())!;
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.y + b.height).toBeLessThanOrEqual(size.height);
    }
  }
  await page.setViewportSize({ width: 844, height: 320 });
  await page.goto("/");
  await page.screenshot({ path: dir + "/title.png" });
  await page.getByRole("button", { name: "ソロで出撃準備" }).click();
  await expect(page.locator(".weapon-list .weapon-row")).toHaveCount(3);
  // The armoury is a grid now, so cards share a row. What has to hold is that
  // DOM order still reads left to right then top to bottom, and that no two
  // cards sit on top of each other.
  const rows = await page.locator(".weapon-row").evaluateAll((es) =>
    es.map((e) => {
      const b = e.getBoundingClientRect();
      return {
        x: Math.round(b.x),
        y: Math.round(b.y),
        w: b.width,
        h: b.height,
      };
    }),
  );
  for (const [i, r] of rows.entries()) {
    expect(r.w).toBeGreaterThan(0);
    expect(r.h).toBeGreaterThan(0);
    if (!i) continue;
    const prev = rows[i - 1];
    expect(r.y > prev.y || (r.y === prev.y && r.x > prev.x)).toBe(true);
  }
  await page.locator("#weapon-filter").selectOption("rocket");
  await expect(page.locator(".weapon-list .weapon-row")).toHaveCount(1);
  await expect(page.locator(".weapon-list")).toContainText("RL-2");
  await page.locator("#weapon-filter").selectOption("all");
  await page.screenshot({ path: dir + "/weapons.png" });
  await page.getByRole("button", { name: "ソロ出撃" }).click();
  for (const size of [
    { width: 844, height: 320 },
    { width: 640, height: 280 },
    { width: 915, height: 412 },
  ]) {
    await page.setViewportSize(size);
    await page.waitForTimeout(200);
    const g = await geometry(page);
    for (const a of [...g.controls, ...g.hud]) {
      expect(a.x).toBeGreaterThanOrEqual(0);
      expect(a.y).toBeGreaterThanOrEqual(0);
      expect(a.x + a.w).toBeLessThanOrEqual(g.w + 1);
      expect(a.y + a.h).toBeLessThanOrEqual(g.h + 1);
    }
    for (const a of g.controls)
      for (const b of g.hud) expect(intersects(a, b)).toBe(false);
    for (let i = 0; i < g.hud.length; i++)
      for (let j = i + 1; j < g.hud.length; j++)
        expect(intersects(g.hud[i], g.hud[j])).toBe(false);
  }
  await page.setViewportSize({ width: 844, height: 320 });
  await page.waitForTimeout(200);
  await page.screenshot({ path: dir + "/mobile-combat.png" });
  expect(errors).toEqual([]);
});
test("dragged layout saves across reload, cancels edits and survives rotation", async ({
  page,
}) => {
  await gear(page);
  await page.getByRole("button", { name: "操作ボタンの配置" }).click();
  const button = page.locator('[data-layout-button="fire"]'),
    before = (await button.boundingBox())!;
  // Use real mouse drag with pointer capture on the editor; edit mode does not fire a weapon.
  await page.mouse.move(
    before.x + before.width / 2,
    before.y + before.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    before.x + before.width / 2 - 20,
    before.y + before.height / 2 - 12,
    { steps: 5 },
  );
  await page.mouse.up();
  await page.locator("#layout-size").fill("0.9");
  await page.locator("#layout-opacity").fill("0.65");
  await expect(page.locator("#layout-save")).toBeEnabled();
  await page.screenshot({ path: dir + "/layout.png" });
  await page.locator("#layout-save").click();
  const saved = await page.evaluate(() =>
    localStorage.getItem("swarm-front-controls-v1"),
  );
  expect(saved).not.toBeNull();
  expect(JSON.parse(saved!).buttons.fire.x).toBeLessThan(0.9);
  await page.getByRole("button", { name: "操作ボタンの配置" }).click();
  await page.locator("#layout-reset").click();
  await page.locator("#layout-cancel").click();
  expect(
    await page.evaluate(() => localStorage.getItem("swarm-front-controls-v1")),
  ).toBe(saved);
  await page.reload();
  await page.getByRole("button", { name: "ソロで出撃準備" }).click();
  await page.getByRole("button", { name: "ソロ出撃" }).click();
  const initial = await geometry(page);
  await page.setViewportSize({ width: 320, height: 844 });
  await expect(page.locator("#portrait")).toBeVisible();
  await page.setViewportSize({ width: 844, height: 320 });
  await expect(page.locator("#portrait")).toBeHidden();
  await page.waitForTimeout(150);
  expect((await geometry(page)).controls).toEqual(initial.controls);
  expect(
    await page.evaluate(() => localStorage.getItem("swarm-front-controls-v1")),
  ).toBe(saved);
});
test("dodge and reload buttons show authoritative remaining rings and return to ready", async ({
  page,
}) => {
  await gear(page);
  await page.getByRole("button", { name: "ソロ出撃" }).click();
  await page.locator("#dodge").tap();
  await expect(page.locator("#dodge")).toHaveClass(/cooling/);
  const ratio = Number(
    await page.locator("#dodge").getAttribute("data-remaining"),
  );
  expect(ratio).toBeGreaterThan(0);
  expect(ratio).toBeLessThanOrEqual(1);
  await expect(page.locator("#dodge")).not.toHaveClass(/cooling/, {
    timeout: 5000,
  });
  const fire = (await page.locator("#fire").boundingBox())!;
  await page.mouse.move(fire.x + fire.width / 2, fire.y + fire.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(300);
  await page.mouse.up();
  await page.locator("#reload").tap();
  await expect(page.locator("#reload")).toHaveClass(/cooling/);
  await expect(page.locator("#reload")).toHaveAttribute("aria-label", /残り/);
  await page.screenshot({ path: dir + "/reload.png" });
  await expect(page.locator("#reload")).not.toHaveClass(/cooling/, {
    timeout: 5000,
  });
});

test("layout save failure stays reviewable and does not overwrite inventory", async ({
  page,
}) => {
  await gear(page);
  const inventory = await page.evaluate(() =>
    localStorage.getItem("swarm-front-save-v1"),
  );
  await page.getByRole("button", { name: "操作ボタンの配置" }).click();
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new Error("quota");
    };
  });
  await page.locator("#layout-save").click();
  await expect(page.locator("#layout-message")).toContainText("保存に失敗");
  await expect(page.locator(".layout-editor")).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("swarm-front-save-v1")),
  ).toBe(inventory);
  await page.locator("#layout-cancel").click();
  await expect(page.getByRole("heading", { name: "出撃準備" })).toBeVisible();
});
