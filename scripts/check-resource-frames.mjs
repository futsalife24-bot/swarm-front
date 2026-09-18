import { chromium } from "@playwright/test";
import fs from "node:fs";
import assert from "node:assert/strict";
const out = "dist-validation/resource-frames";
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
const results = [];
try {
  for (const [width, height] of [
    [640, 360],
    [667, 375],
    [844, 390],
    [915, 412],
    [1280, 582],
  ]) {
    const p = await browser.newPage({
      viewport: { width, height },
      serviceWorkers: "block",
    });
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    let fixture = JSON.parse(
      fs.readFileSync("dist-validation/gear-pinned/fixture.json", "utf8"),
    );
    Object.assign(fixture, {
      coins: 999999999,
      powder: 999999999,
      materials: 99,
      points: 120,
      tutorials: ["growth", "accessories"],
    });
    fixture.accessories = Array.from({ length: 24 }, (_, i) => ({
      id: `compact-${i}`,
      kind: ["pickup", "healing", "recovery"][i % 3],
      rarity: (i % 6) + 1,
      locked: i % 4 === 0,
      testData: false,
    }));
    fixture.soldiers[0].accessory = "compact-2";
    await p.addInitScript(
      (s) =>
        localStorage.setItem(
          "swarm-front-progression-v2-normal",
          JSON.stringify(s),
        ),
      fixture,
    );
    await p.goto("http://127.0.0.1:5347/");
    await p.locator("#solo").click();
    await p.locator("#player-name").fill("資源UI検証");
    await p.locator("#player-name-form button[type=submit]").click();
    async function shot(name) {
      await p.screenshot({ path: `${out}/${width}-${name}.png` });
      const state = await p.evaluate(() => {
        const rect = (e) => e.getBoundingClientRect();
        const difficulty = document.querySelector(".pt-difficulty");
        const wallet = [
          ...document.querySelectorAll(".resource-wallet .resource-frame"),
        ];
        const toolbar = [
          ...document.querySelectorAll(
            ".pt-screen:has(.pt-accessories) .pt-brief > :not([hidden])",
          ),
        ];
        const list = document.querySelector(".pt-accessories");
        const rows = [...document.querySelectorAll(".pt-accessories > div")];
        return {
          overflow: document.documentElement.scrollWidth > innerWidth,
          frames: [...document.querySelectorAll(".resource-frame")].map(
            (e) => ({
              text: e.textContent,
              label: e.getAttribute("aria-label"),
              overflow: e.scrollWidth > e.clientWidth + 1,
              width: rect(e).width,
            }),
          ),
          walletRows: new Set(wallet.map((e) => rect(e).top)).size,
          toolbarRows: new Set(
            toolbar.map((e) => Math.round(rect(e).top + rect(e).height / 2)),
          ).size,
          difficultyClear:
            !difficulty ||
            rect(difficulty.querySelector(".game-select-trigger")).right <=
              rect(difficulty.querySelector("small")).left,
          difficultyWidth: difficulty
            ? rect(difficulty.querySelector(".game-select-trigger")).width
            : null,
          listOverflow: list ? list.scrollWidth - list.clientWidth : 0,
          visibleRows: list
            ? rows.filter((e) => rect(e).bottom <= rect(list).bottom).length
            : 0,
          rowOverlap: rows.some((row) =>
            [...row.children].some(
              (e, i, a) => i > 0 && rect(a[i - 1]).right > rect(e).left + 1,
            ),
          ),
        };
      });
      results.push({ width, height, name, ...state });
      fs.writeFileSync(out + "/results.json", JSON.stringify(results, null, 2));
      assert.ok(!state.overflow);
      assert.ok(
        state.frames.every((e) => !e.overflow && e.label),
        JSON.stringify(state),
      );
      assert.ok(state.difficultyClear);
      assert.ok(state.difficultyWidth === null || state.difficultyWidth >= 60);
      assert.ok(state.walletRows <= 1);
      assert.ok(state.toolbarRows <= 1);
      assert.ok(state.listOverflow <= 1);
      assert.ok(!state.rowOverlap);
      if (name === "accessories") assert.ok(state.visibleRows >= 4);
    }
    await shot("gear");
    await p.locator('[data-game-select-for="pt-difficulty"]').click();
    await p.locator('.game-select-options [data-option-index="1"]').click();
    await shot("gear-hard");
    assert.equal(await p.locator('#pt-difficulty').inputValue(), 'medium');
    await p.locator('[data-game-select-for="pt-difficulty"]').click();
    await p.locator('.game-select-options [data-option-index="0"]').click();
    await p.locator("#pt-base").click();
    await shot("base");
    assert.equal(
      await p.locator(".resource-wallet .resource-frame").count(),
      4,
    );
    await p.locator("#pt-base-accessories").click();
    await shot("accessories");
    await p.locator("#pt-craft").click();
    assert.equal(
      await p
        .locator(".resource-wallet [data-resource=powder] .resource-amount")
        .textContent(),
      "999,999,989",
    );
    await shot("crafted");
    await p.locator("#pt-base").click();
    await p.locator("#pt-base-growth").click();
    await shot("growth");
    await p.locator("[data-unlock]").first().click();
    assert.equal(
      await p
        .locator(".resource-wallet [data-resource=materials] .resource-amount")
        .textContent(),
      "98",
    );
    await shot("unlocked");
    await p.locator("#pt-base").click();
    await p.locator("#pt-base-weapons").click();
    await shot("armory");
    await p.evaluate(async () => {
      const m = await import("/src/client/progression-save.ts");
      let s = m.loadProgress("normal");
      s.points = 0;
      s = m.grantResult(
        s,
        {
          run: "resource-ui-win",
          stage: 1,
          difficulty: "normal",
          win: true,
          time: 60,
          kills: 12,
          missions: [true, true, true],
          weapons: [],
          collected: 0,
        },
        () => 0.5,
      );
      s = m.prepareChoice(s, () => 0.5);
      m.persistProgress(s);
    });
    await p.reload();
    await p.locator("#pt-normal-reward").waitFor();
    await shot("reward-choice");
    await p.locator("#pt-normal-reward").click();
    await shot("result");
    assert.equal(
      await p.locator("[data-resource=materials][data-purpose=gain]").count(),
      1,
    );
    assert.equal(
      await p.locator("[data-resource=points][data-purpose=gain]").count(),
      1,
    );
    assert.deepEqual(errors, []);
    await p.close();
  }
  fs.writeFileSync(out + "/results.json", JSON.stringify(results, null, 2));
  console.log(
    "Resource UI: 5 viewports, 50 screenshots, wallet deductions, toolbar rows, normal/hard difficulty and accessory bounds passed",
  );
} finally {
  await browser.close();
}
