// 表示部品の検査用fixture。実戦・実端末確認とは区別して記録する。
import { chromium, expect } from "@playwright/test";
import fs from "node:fs";
const origin = process.env.ORIGIN ?? "http://127.0.0.1:5197";
const out = process.argv[2] ?? "dist-validation/survival-card-components";
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=d3d11"],
});
const results = [];
try {
  for (const [width, height] of [
    [844, 390],
    [640, 360],
    [667, 320],
  ]) {
    for (const reducedMotion of ["no-preference", "reduce"]) {
      const page = await browser.newPage({
        viewport: { width, height },
        reducedMotion,
        serviceWorkers: "block",
      });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.route("**/__card-test", (route) =>
        route.fulfill({
          contentType: "text/html",
          body: '<!doctype html><html lang="ja"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body class="rebuild-p1a front-game" data-screen="battle"><div id="ui"></div></body></html>',
        }),
      );
      await page.goto(`${origin}/__card-test`);
      await page.evaluate(async () => {
        for (const css of [
          "/src/style.css",
          "/src/mobile-ui.css",
          "/src/menu-ui.css",
          "/src/menu-theme.css",
          "/src/client/rebuild.css",
          "/src/client/playtest.css",
          "/src/client/front.css",
          "/src/client/survival-card.css",
          "/src/client/front-reward-ui.css",
        ])
          await import(css);
        const card = await import("/src/client/front-upgrade-ui.ts");
        const reward = await import("/src/client/front-reward-ui.ts");
        const { createFrontRun, getFrontRunView } =
          await import("/src/shared/front-run.ts");
        const { FRONT_UPGRADE_IDS, FRONT_UPGRADE_CATALOG } =
          await import("/src/shared/front-upgrades.ts");
        const view = getFrontRunView(
          createFrontRun({
            runId: "card-preview",
            seed: 1,
            fusion: true,
            players: [{ id: "p" }],
          }),
          "p",
        );
        window.cardFixture = {
          ids: FRONT_UPGRADE_IDS,
          show(ids, levelUp = false) {
            for (const id of FRONT_UPGRADE_IDS)
              view.levels[id] = levelUp
                ? FRONT_UPGRADE_CATALOG[id].maxLevel - 1
                : 0;
            document.getElementById("ui").innerHTML =
              `<section class="pause-card rebuild-panel rebuild-selection"><header><button id="front-choice-owned">現在の強化 6/6枠</button><h1 class="front-choice-title">強化を選べ</h1><div class="rebuild-selection-actions"><button id="rebuild-reroll">再抽選 残り2</button></div></header><div class="rebuild-cards">${ids.map((id) => card.frontUpgradeCardMarkup(view, id, "/")).join("")}</div></section>`;
          },
          treasure(id) {
            view.treasure = {
              id: 1,
              endsAt: 2.4,
              reward: { kind: "upgrade", cardId: id, from: 2, to: 3 },
            };
            document.getElementById("ui").innerHTML =
              reward.frontTreasureMarkup(view, "/", true);
          },
          level() {
            document.getElementById("ui").innerHTML =
              reward.frontLevelUpMarkup();
          },
          owned() {
            for (const id of FRONT_UPGRADE_IDS) view.levels[id] = 0;
            for (const id of [
              "fire-rounds",
              "frost-rounds",
              "chain-lightning",
              "fusion-reactor",
            ])
              view.levels[id] = 2;
            view.picks = 4;
            document.getElementById("ui").innerHTML =
              `<div style="display:flex;gap:12px;align-items:flex-start">${card.frontUpgradeStrip(view, "/")}${card.frontUpgradeDetails(view, "/")}</div>`;
          },
        };
      });
      await page.evaluate(() => document.fonts.ready);
      const ids = await page.evaluate(() => window.cardFixture.ids);
      let count = 0;
      for (const levelUp of [false, true]) {
        for (let i = 0; i < ids.length; i += 3) {
          const group = ids.slice(i, i + 3);
          while (group.length < 3) group.push("armor");
          await page.evaluate(
            ({ group, levelUp }) => window.cardFixture.show(group, levelUp),
            { group, levelUp },
          );
          // 最終レイアウトで欠けを検査。動きの有無は下で別に検査する。
          await page.evaluate(() =>
            document
              .getAnimations()
              .filter((a) => Number.isFinite(a.effect.getTiming().iterations))
              .forEach((a) => a.finish()),
          );
          const clipped = await page
            .locator('.sc-card[data-size="L"]')
            .evaluateAll((cards) =>
              cards.flatMap((card) => {
                const face = card
                  .querySelector(".sc-face")
                  .getBoundingClientRect();
                return [
                  ...card.querySelectorAll(
                    ".sc-name,.sc-desc,.sc-materials,.sc-level,.sc-top",
                  ),
                ].flatMap((el) => {
                  const r = el.getBoundingClientRect();
                  return r.bottom > face.bottom + 1 ||
                    r.right > face.right + 1 ||
                    r.left < face.left - 1 ||
                    r.top < face.top - 1
                    ? [
                        {
                          card: card.dataset.card,
                          part: el.className,
                          text: el.textContent,
                          face: { bottom: face.bottom, right: face.right },
                          bounds: { bottom: r.bottom, right: r.right },
                        },
                      ]
                    : [];
                });
              }),
            );
          expect(
            clipped,
            JSON.stringify({ width, height, levelUp, group, clipped }),
          ).toEqual([]);
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          ).toBe(true);
          count += group.length;
        }
      }
      await page.evaluate(() =>
        window.cardFixture.show(
          ["fire-rounds", "frost-rounds", "chain-lightning"],
          false,
        ),
      );
      await page
        .locator('.sc-card[data-size="L"] img')
        .evaluateAll((imgs) => Promise.all(imgs.map((img) => img.decode())));
      await page.screenshot({
        path: `${out}/${width}x${height}-${reducedMotion}-elements.png`,
        animations: "disabled",
      });
      await page.evaluate(() =>
        window.cardFixture.show(["armor", "fuse", "fusion-reactor"], true),
      );
      const animations = await page
        .locator(".sc-card")
        .evaluateAll((cards) =>
          cards
            .flatMap((c) => c.getAnimations({ subtree: true }))
            .map((a) => a.effect.getTiming().iterations),
        );
      const normalAnimations = await page
        .locator('.sc-card[data-kind="normal"]')
        .evaluateAll((cards) =>
          cards
            .flatMap((c) => c.getAnimations({ subtree: true }))
            .map((a) => a.effect.getTiming().iterations),
        );
      expect(normalAnimations.every((n) => Number.isFinite(n))).toBe(true);
      if (reducedMotion === "no-preference")
        expect(animations.filter((n) => n === Infinity).length).toBe(2);
      if (reducedMotion === "reduce") expect(animations).toEqual([]);
      await page.evaluate(() =>
        document
          .getAnimations()
          .filter((a) => Number.isFinite(a.effect.getTiming().iterations))
          .forEach((a) => a.finish()),
      );
      await page.locator('[data-card="armor"]').focus();
      expect(
        await page
          .locator('[data-card="armor"]')
          .evaluate((el) => getComputedStyle(el).outlineStyle),
      ).not.toBe("none");
      await page.screenshot({
        path: `${out}/${width}x${height}-${reducedMotion}-choices.png`,
      });
      await page.evaluate(() => window.cardFixture.owned());
      await page
        .locator(".sc-card img")
        .evaluateAll((imgs) => Promise.all(imgs.map((img) => img.decode())));
      const smallArt = await page.locator(".sc-card img").evaluateAll((imgs) =>
        imgs.map((img) => ({
          width: img.naturalWidth,
          file: img.getAttribute("src"),
        })),
      );
      expect(smallArt).toHaveLength(8);
      expect(
        smallArt.every(
          (img) => img.width === 128 && img.file.endsWith("-thumb.webp"),
        ),
      ).toBe(true);
      await page.screenshot({
        path: `${out}/${width}x${height}-${reducedMotion}-owned.png`,
        animations: "disabled",
      });
      await page.evaluate(() => {
        document.documentElement.dataset.menuReducedMotion = "true";
        window.cardFixture.show(["armor", "fuse", "fusion-reactor"]);
      });
      expect(
        await page
          .locator(".sc-card")
          .evaluateAll(
            (cards) =>
              cards.flatMap((c) => c.getAnimations({ subtree: true })).length,
          ),
      ).toBe(0);
      await page.evaluate(() => {
        delete document.documentElement.dataset.menuReducedMotion;
        window.cardFixture.treasure("fusion-reactor");
      });
      await page.evaluate(() =>
        document
          .getAnimations()
          .filter((a) => Number.isFinite(a.effect.getTiming().iterations))
          .forEach((a) => a.finish()),
      );
      await expect(page.locator(".front-treasure [data-card]")).toHaveCount(0);
      const treasureBounds = await page
        .locator(".front-treasure .sc-desc")
        .boundingBox();
      expect(treasureBounds.y + treasureBounds.height).toBeLessThanOrEqual(
        height,
      );
      await page.screenshot({
        path: `${out}/${width}x${height}-${reducedMotion}-treasure.png`,
      });
      await page.evaluate(() => window.cardFixture.level());
      await expect(page.locator("[data-card]")).toHaveCount(0);
      if (reducedMotion === "reduce")
        expect(
          await page
            .locator(".front-level-up")
            .evaluate((el) => el.getAnimations().length),
        ).toBe(0);
      else
        await page.evaluate(() =>
          document.getAnimations().forEach((a) => {
            a.pause();
            a.currentTime = 400;
          }),
        );
      await page.screenshot({
        path: `${out}/${width}x${height}-${reducedMotion}-level-up.png`,
      });
      expect(errors).toEqual([]);
      results.push({
        width,
        height,
        reducedMotion,
        cardDisplays: count,
        noClipping: true,
        gameReducedMotion: true,
        errors,
      });
      console.log(
        `${width}x${height} ${reducedMotion}: ${count}カード表示 合格`,
      );
      await page.close();
    }
  }
} finally {
  fs.writeFileSync(
    `${out}/results.json`,
    JSON.stringify(results, null, 2) + "\n",
  );
  await browser.close();
}
