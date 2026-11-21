import { chromium, expect } from "@playwright/test";
import fs from "node:fs";
const origin = "http://127.0.0.1:5197",
  worker = "http://127.0.0.1:8798";
const out = "docs/evidence/gacha-balance-20261117/ui";
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=d3d11", "--mute-audio"],
});
const report = [];
try {
  for (const [width, height] of [
    [844, 390],
    [640, 360],
  ]) {
    const context = await browser.newContext({
        viewport: { width, height },
        serviceWorkers: "block",
        reducedMotion: "reduce",
      }),
      page = await context.newPage();
    page.setDefaultTimeout(60000);
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(() => {
      const key = "swarm-front-tutorial-v1";
      const current = JSON.parse(
        localStorage.getItem(key) ?? '{"version":1,"seen":[]}',
      );
      const seen = new Set(current.seen ?? []);
      seen.add("ftue:c7");
      seen.add("ftue:unlock:all");
      localStorage.setItem(
        key,
        JSON.stringify({ ...current, version: 1, seen: [...seen] }),
      );
    });
    await page.route("**/api/**", async (route) => {
      const req = route.request(),
        headers = {
          ...req.headers(),
          origin: worker,
          "X-Test-Address": `10.184.${width === 844 ? 1 : 2}.1`,
        };
      delete headers.host;
      delete headers["content-length"];
      const response = await fetch(worker + new URL(req.url()).pathname, {
        method: req.method(),
        headers,
        ...(req.postData() ? { body: req.postData() } : {}),
      });
      await route.fulfill({
        status: response.status,
        contentType: "application/json",
        body: await response.text(),
      });
    });
    await page.route(
      /\/src\/client\/playtest-app.ts(?:\?.*)?$/,
      async (route) => {
        const response = await route.fetch();
        await route.fulfill({
          response,
          body:
            (await response.text()) +
            `
window.gachaUiFixture=async()=>{
 mode='normal'; const m=await import('/src/client/progression-save.ts'); save=m.loadProgress('normal') ?? m.freshProgress('normal');
 save.tutorials=['gear','armory','base','battle'];
 save=m.grantResult(save,{run:'gacha-ui-${width}',stage:12,difficulty:'normal',win:true,time:200,kills:176,missions:[true,true,true],weapons:[],collected:0,powderCollected:3},()=>.5);
 save=m.prepareChoice(save,()=>.5); save=m.chooseReward(save,false); persistProgress(save); result();
};
window.gachaSupplyFixture=()=>base();
window.gachaWeeklyFixture=async()=>{
 const m=await import('/src/client/cloud-save.ts');
 save.receipts.push('weekly-fixture-a','weekly-fixture-b');save.weeklyPending.push('weekly-fixture-a','weekly-fixture-b');persistProgress(save);
 await m.createCloudSave(); weeklyMissionsUI();
};`,
        });
      },
    );
    await page.goto(origin + "/?solo=1", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(
      () => typeof window.gachaUiFixture === "function",
    );
    await page.locator("#pt-start").waitFor();
    await page.evaluate(() => window.gachaUiFixture());
    await expect(page.locator(".pt-ticket-estimate")).toContainText(
      "最大+31枚",
    ); // first3 + stars2 + front24 + clear/day2
    await expect(page.locator(".pt-reward-notes")).toContainText(
      "クラウド保存を作ると受け取れます",
    );
    await expect(page.locator(".pt-reward-notes")).toContainText("ST13から");
    await page.waitForFunction(
      () => !document.querySelector(".split-shutter,.menu-route-shutter"),
    );
    await page.screenshot({ path: `${out}/result-${width}.png` });
    await page.evaluate(() => window.gachaWeeklyFixture());
    await expect(page.locator(".weekly-row").first()).toContainText(
      "補給券2枚",
    );
    await expect(page.locator(".weekly-row").nth(1)).toContainText("補給券5枚");
    await expect(page.locator(".weekly-row").nth(2)).toContainText("補給券3枚");
    await page.screenshot({ path: `${out}/weekly-${width}.png` });
    await page.locator(".dialog-close").click();
    await page.locator("#pt-result-home").click();
    await page.evaluate(() => window.gachaSupplyFixture());
    await page.locator("#pt-base-supply").click();
    await expect(page.locator("[data-supply-credit]")).toHaveText(
      "過去の達成分 +29枚",
    );
    await expect(page.locator("[data-supply-count]")).toHaveText("43枚"); // initial10 +29 +3wins+daily1
    await page.screenshot({ path: `${out}/past-credit-${width}.png` });
    await page.locator("[data-supply-refresh]").click();
    await expect(page.locator("[data-supply-count]")).toHaveText("43枚");
    expect(errors).toEqual([]);
    report.push({
      width,
      height,
      result: true,
      weekly: true,
      pastCredit: true,
      noDuplicate: true,
      errors,
    });
    await context.close();
  }
  fs.writeFileSync(
    out + "/results.json",
    JSON.stringify(
      {
        passed: true,
        report,
        method:
          "Synthetic local battle save via production save functions; real local Worker cloud/supply HTTP. Dev UI routed to that Worker; no response mocks.",
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ passed: true, report }));
} finally {
  await browser.close();
}
