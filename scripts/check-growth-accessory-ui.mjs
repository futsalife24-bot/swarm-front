import { chromium } from "@playwright/test";
import fs from "node:fs";
import assert from "node:assert/strict";
const out = "dist-validation/growth-accessory";
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
const results = [];
try {
  for (const [width, height] of [
    [640, 360],
    [844, 390],
    [1280, 582],
  ]) {
    const p = await browser.newPage({
      viewport: { width, height },
      serviceWorkers: "block",
    });
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto("http://127.0.0.1:5347/");
    await p.locator("#solo").waitFor();
    await p.evaluate(async () => {
      const { freshProgress } = await import("/src/client/progression-save.ts");
      const s = freshProgress("normal");
      Object.assign(s, {
        coins: 4255,
        powder: 129,
        materials: 2,
        points: 120,
        unlocked: ["hp", "aim", "move"],
        tutorials: ["growth", "accessories"],
      });
      s.accessories = Array.from({ length: 18 }, (_, i) => ({
        id: `ui-${i}`,
        kind: ["pickup", "healing", "recovery"][i % 3],
        rarity: (i % 6) + 1,
        locked: i === 1,
        testData: false,
      }));
      s.soldiers[0].accessory = "ui-2";
      localStorage.setItem(
        "swarm-front-progression-v2-normal",
        JSON.stringify(s),
      );
    });
    await p.reload();
    await p.locator("#solo").click();
    if (await p.locator("#player-name").isVisible()) {
      await p.locator("#player-name").fill("UI検証");
      await p.locator("#player-name-form button[type=submit]").click();
    }
    await p.locator("#pt-base").click();
    async function wallet() {
      for (const kind of ["coins", "powder", "materials", "points"]) {
        const b = p.locator(`[data-resource-help="${kind}"]`);
        await b.click();
        await p.locator("dialog[open] .menu-dialog-body").waitFor();
        assert.ok(
          (await p.locator("dialog[open] .menu-dialog-body").innerText())
            .length > 15,
        );
        await p.locator("dialog[open] .dialog-close").click();
        assert.equal(
          await b.evaluate((e) => document.activeElement === e),
          true,
        );
      }
    }
    async function shot(name) {
      await p.screenshot({ path: `${out}/${width}-${name}.png` });
      const bounds = await p.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth,
        footer:
          document.querySelector(".pt-growth-footer")?.getBoundingClientRect()
            .bottom ?? 0,
        rows: [...document.querySelectorAll(".accessory-row")].filter(
          (e) =>
            e.getBoundingClientRect().bottom <=
            document.querySelector(".pt-accessories").getBoundingClientRect()
              .bottom,
        ).length,
      }));
      assert.equal(bounds.overflow, false);
      assert.ok(bounds.footer <= height);
      if (name === "accessories") assert.ok(bounds.rows >= 4);
      if (name.startsWith("growth"))
        assert.equal(
          await p
            .locator(".pt-growth")
            .evaluate((e) => e.scrollHeight <= e.clientHeight + 1),
          true,
        );
      results.push({ width, height, name, ...bounds });
    }
    await wallet();
    await p.locator("#pt-base-weapons").click();
    await wallet();
    await p.locator("#pt-base").click();
    await p.locator("#pt-base-accessories").click();
    await wallet();
    await shot("accessories");
    await p.locator('[data-accessory-info="ui-0"]').click();
    await p.locator("dialog[open] .accessory-effect").waitFor();
    await p.locator("dialog[open] .dialog-close").click();
    assert.equal(
      await p.locator('[data-accessory-delete="ui-2"]').isDisabled(),
      true,
    );
    await p.locator('[data-accessory-equip="ui-0"]').click();
    assert.equal(
      await p.locator('[data-accessory-equip="ui-0"]').innerText(),
      "装備中",
    );
    await p.locator("#pt-base").click();
    await p.locator("#pt-base-growth").click();
    await wallet();
    await shot("growth");
    await p.locator(".radar-hp").click();
    await p.locator('[data-growth-panel="hp"]:visible').waitFor();
    await p.locator('[data-growth-skill="hp"][data-growth-level="2"]').click();
    assert.equal(
      await p.locator('[data-growth-value="hp"]').innerText(),
      "192 HP",
    );
    const draft = await p.locator(".radar-draft").getAttribute("points");
    assert.notEqual(
      draft,
      await p.locator(".radar-saved").getAttribute("points"),
    );
    await p.locator(".radar-aim").click();
    await p.locator('[data-growth-skill="aim"][data-growth-level="5"]').click();
    assert.equal(await p.locator("#pt-allocate").isDisabled(), true);
    await p.locator('[data-growth-skill="aim"][data-growth-level="1"]').click();
    await shot("growth-focus");
    await p.locator(".growth-detail:visible .growth-back").click();
    assert.equal(await p.locator(".growth-overview").isVisible(), true);
    await p.locator("#pt-allocate").click();
    assert.equal(await p.locator(".radar-hp strong").innerText(), "Lv2");
    await p.locator(".radar-hp").click();
    await p.locator('[data-growth-skill="hp"][data-growth-level="0"]').click();
    await p.locator("#pt-growth-cancel").click();
    assert.equal(await p.locator(".radar-hp strong").innerText(), "Lv2");
    await p.locator(".radar-swap").click();
    await p.locator('[data-unlock="swap"]').click();
    assert.equal(
      await p
        .locator('.resource-wallet [data-resource="materials"] strong')
        .innerText(),
      "1",
    );
    await p.locator(".radar-hp").click();
    await p.locator('[data-growth-skill="hp"][data-growth-level="0"]').click();
    await p.locator("#pt-allocate").click();
    await p.locator("#pt-confirm").click();
    assert.equal(
      await p
        .locator('.resource-wallet [data-resource="coins"] strong')
        .innerText(),
      "3,755",
    );
    assert.deepEqual(errors, []);
    await p.close();
  }
  fs.writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
  console.log(
    "3 viewports: shared help/focus return, accessory details/equip/protection, radar focus/draft/budget/save/cancel/unlock/refund passed",
  );
} finally {
  await browser.close();
}
