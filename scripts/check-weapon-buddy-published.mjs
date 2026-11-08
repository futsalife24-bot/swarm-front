import { chromium, expect } from "@playwright/test";
import fs from "node:fs";
const origin = "https://swarm-front.melosalife-24.workers.dev";
const out = "dist-validation/weapon-buddy-published";
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=d3d11"],
});
const results = [],
  errors = [];
let page;
try {
  for (const kind of ["tatara","yosuga","tobari","oriha"]) {
    const width=844,height=390;
    const context = await browser.newContext({
      viewport: { width, height },
      hasTouch: true,
      serviceWorkers: "block",
      reducedMotion: "reduce",
    });
    await context.addInitScript(() =>
      localStorage.setItem("swarm-front-player-name-v1", "公開確認"),
    );
    page = await context.newPage();
    page.setDefaultTimeout(90000);
    const models=[];
    page.on("response",r=>{if(r.url().includes("textured-20261107.glb"))models.push({url:r.url(),status:r.status()});});
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addLocatorHandler(page.locator("#pt-intro-skip"), async () =>
      page.locator("#pt-intro-skip").click(),
    );
    const settle = () =>
      page.waitForFunction(
        () => !document.querySelector(".split-shutter,.menu-route-shutter"),
      );
    const tap = async (s) => {
      await settle();
      await page.locator(s).click();
    };
    await page.goto(origin, { timeout: 120000 });
    await tap(".title-entry-start");
    await tap("#solo");
    await tap('[data-operation="advance"]');
    if (await page.locator("#pt-confirm").count()) await tap("#pt-confirm");
    await tap("#pt-base");
    await tap("#pt-base-buddy");
    await tap(`[data-bd="starter-pick"][data-id="${kind}"]`);
    await tap('[data-bd="starter-confirm"]');
    if(kind==="tatara") {
      await tap("#pt-base"); await tap("#pt-base-weapons"); await page.locator("[data-genre]").first().click();
      await page.locator('[data-detail]').first().click();
      await expect(page.locator('.weapon-detail-dialog[open]')).toBeVisible();
      await expect(page.locator('#pt-weapon-preview canvas')).toBeVisible();
      await page.locator('#pt-detail-lock').click();
      await expect(page.locator('[data-lock]').first()).toHaveAttribute('aria-pressed','true');
      await page.locator('[data-detail]').first().click();
      await expect(page.locator('#pt-detail-lock')).toHaveAttribute('aria-pressed','true');
      await expect(page.locator("#pt-weapon-preview canvas")).toBeVisible();
      await page.waitForTimeout(1500);
      await page.screenshot({path:`${out}/weapon-locked.png`});
      await page.locator('.weapon-detail-dialog[open] .dialog-close').click();
      await expect(page.locator('.weapon-detail-dialog[open]')).toHaveCount(0);
    }
    await tap("#pt-gear");
    await tap("#pt-start");
    await page
      .getByRole("button", { name: "タップで戦場へ" })
      .click({ timeout: 120000 });
    if (await page.locator("#pt-tutorial-skip").count())
      await tap("#pt-tutorial-skip");
    if (await page.locator("#pt-intro-skip").count())
      await tap("#pt-intro-skip");
    await page.locator(".operation-cue").waitFor({ state: "detached" });
    await page.waitForTimeout(2000);

    await tap("#pause");
    await expect(page.locator("dialog[open] .ap-buddy-name")).toBeVisible();
    await tap("#pt-resume");
    await page.waitForTimeout(1000);
    await page.screenshot({path:`${out}/${kind}-battle.png`});
    results.push({kind,width,height,normalUIStarter:true,modelRequests:models,errors:[...errors]});
    console.log(JSON.stringify(results.at(-1)));
    await context.close();
    page = null;
  }
  expect(errors).toEqual([]);
} catch (e) {
  errors.push(String(e));
  if (page)
    await page.screenshot({ path: out + "/failure.png" }).catch(() => {});
  throw e;
} finally {
  fs.writeFileSync(
    out + "/results.json",
    JSON.stringify(
      {
        at: new Date().toISOString(),
        origin,
        conditions:
          "公開配信JS、HP/時間/敵無変更。隔離新規保存、実UIでタタラ選択。協力は部屋作成せず入口確認。",
        results,
        errors,
      },
      null,
      2,
    ),
  );
  await browser.close();
}
