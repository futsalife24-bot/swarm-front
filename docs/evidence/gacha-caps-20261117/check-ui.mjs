import { chromium, expect } from "@playwright/test";
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  timeout: 30000,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
console.log("起動成功");
await page.route("**/caps-harness", (route) =>
  route.fulfill({
    contentType: "text/html",
    body: "<html><body></body></html>",
  }),
);
await page.goto("http://127.0.0.1:5198/caps-harness", {
  waitUntil: "domcontentloaded",
  timeout: 30000,
});
console.log("ページ取得成功");
for (const width of [844, 640]) {
  await page.setViewportSize({ width, height: 390 });
  for (const [rarity, level, cap] of [
    [0, 9, 10],
    [1, 19, 20],
    [2, 29, 30],
    [3, 39, 40],
    [4, 49, 50],
    [0, 15, 10],
    [3, 30, 40],
  ]) {
    console.log(width, rarity, level);
    await page.goto("http://127.0.0.1:5198/caps-harness", {
      waitUntil: "domcontentloaded",
    });
    await page.evaluate(
      async ({ rarity, level }) => {
        await Promise.all(
          [
            "/src/style.css",
            "/src/menu-ui.css",
            "/src/menu-theme.css",
            "/src/client/menu-effects.css",
          ].map((path) => import(path)),
        );
        const { freshProgress, persistProgress } =
          await import("/src/client/progression-save.ts");
        const { makeWeapon } = await import("/src/shared/progression.ts");
        const { openWeaponWorkshop } =
          await import("/src/client/weapon-workshop-ui.ts");
        const save = freshProgress("normal");
        const w = save.inventory[0];
        save.inventory[0] = {
          ...makeWeapon(
            w.id,
            w.kind,
            rarity,
            { power: 0, reload: 0, range: 0, rate: 0 },
            false,
            0,
          ),
          level,
        };
        save.powder = 10000;
        const values = new Map();
        const storage = {
          getItem: (k) => values.get(k) ?? null,
          setItem: (k, v) => values.set(k, v),
        };
        persistProgress(save, storage);
        document.body.innerHTML =
          '<div id="ui"><main id="caps-root"></main></div>';
        openWeaponWorkshop(
          document.querySelector("#caps-root"),
          storage,
          () => {},
        );
        window.capsStorage = storage;
      },
      { rarity, level },
    );
    await expect(page.locator(".workshop-level")).toContainText(
      `上限 Lv${cap}`,
    );
    if (level >= cap) {
      await expect(page.locator("#workshop-level")).toBeDisabled();
      await expect(page.locator(".workshop-level")).toContainText("上限到達");
    } else {
      await expect(page.locator("#workshop-level")).toBeEnabled();
      await expect(page.locator(".workshop-level")).toContainText(
        `武装片 ${2 + level * 2} / 所持 10000`,
      );
      await page.locator("#workshop-level").click();
      await page.locator("[data-commit]").click();
      await expect(page.locator(".workshop-level")).toContainText(
        `Lv${level + 1}`,
      );
      if (level + 1 === cap)
        await expect(page.locator("#workshop-level")).toBeDisabled();
    }
    if (rarity === 3 && level === 39)
      await page.screenshot({ path: `dist-validation/caps-${width}.png` });
  }
}
expect(errors).toEqual([]);
await browser.close();
console.log(
  "14条件成功: 全レア度上限直前→到達・既存N Lv15・SSR Lv30、2横画面、画面例外0",
);
