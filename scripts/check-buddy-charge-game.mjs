import { chromium, expect } from "@playwright/test";
import fs from "node:fs";
const origin = process.env.ORIGIN ?? "http://127.0.0.1:5196";
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin))
  throw Error("Local fixture only");
const out = "dist-validation/buddy-charge-game";
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  channel: process.env.TEST_BROWSER_CHANNEL ?? "chrome",
  args: ["--use-angle=d3d11"],
});
const results = [],
  errors = [];
let currentPage, currentKind;
try {
  for (const kind of ["tatara", "yosuga", "tobari", "oriha"]) {
    const page = await browser.newPage({
      viewport: { width: 844, height: 390 },
      serviceWorkers: "block",
    });
    currentPage = page;
    currentKind = kind;
    console.log("開始: " + kind);
    page.setDefaultTimeout(60000);
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/buddy-seed", (r) =>
      r.fulfill({ contentType: "text/html", body: "<html></html>" }),
    );
    await page.goto(origin + "/buddy-seed");
    await page.evaluate(async (kind) => {
      const { freshProgress, newSaveKey } =
        await import("/src/client/progression-save.ts");
      const { freshBuddyProgress, chooseStarterBuddy } =
        await import("/src/shared/buddy-progression.ts");
      const { ENEMY_REPORT_NAMES } =
        await import("/src/shared/enemy-identity.ts");
      const s = freshProgress("normal");
      s.buddies = chooseStarterBuddy(freshBuddyProgress(), kind);
      s.encounters = Object.fromEntries(
        Object.keys(ENEMY_REPORT_NAMES).map((id) => [id, "solo"]),
      );
      localStorage.setItem(newSaveKey("normal"), JSON.stringify(s));
      localStorage.setItem("swarm-front-player-name-v1", "バディ戦闘検証");
    }, kind);
    for (const [file, extra] of [
      [
        "render.ts",
        "const r=Renderer.prototype.render;Renderer.prototype.render=function(...a){if(a[0]){window.testWorld=a[0];window.testView=this;if(a[0].players[0])a[0].players[0].safe=999;}return r.apply(this,a)};",
      ],
      [
        "input.ts",
        "const r=Controls.prototype.read;Controls.prototype.read=function(...a){window.testControls=this;return r.apply(this,a)};",
      ],
    ]) {
      await page.route(
        new RegExp("/src/client/" + file.replace(".", "\\.") + "(?:\\?.*)?$"),
        async (route) => {
          const response = await route.fetch();
          await route.fulfill({
            response,
            body: (await response.text()) + "\n" + extra,
          });
        },
      );
    }
    await page.goto(origin + "/", { timeout: 120000 });
    const tap = async (sel) => {
      await page.waitForFunction(
        () => !document.querySelector(".split-shutter,.menu-route-shutter"),
      );
      await page.locator(sel).click();
    };
    await tap(".title-entry-start");
    await tap("#solo");
    await tap('[data-operation="advance"]');
    if (await page.locator("#pt-confirm").count()) await tap("#pt-confirm");
    await tap("#pt-start");
    await page
      .getByRole("button", { name: "タップで戦場へ" })
      .click({ timeout: 120000 });
    if (await page.locator("#pt-tutorial-skip").count())
      await tap("#pt-tutorial-skip");
    await expect(page.locator("#controls")).toBeVisible({ timeout: 120000 });
    console.log("戦闘開始: " + kind);
    await page.waitForFunction(
      () =>
        window.testWorld?.phase === "battle" &&
        window.testView?.buddies?.entries.get("solo")?.model,
    );
    await page.locator(".operation-cue").waitFor({ state: "detached" });
    const before = await page.evaluate(() => {
      const w = window.testWorld,
        p = w.players[0];
      p.hp = 40;
      p.safe = 999;
      return { hp: p.hp, time: w.time, kind: w.buddies.entries.solo.buddyId };
    });
    await page.keyboard.down("KeyG");
    await page.waitForTimeout(80);
    await page.keyboard.up("KeyG");
    await page.waitForFunction(
      () => window.testWorld.buddies.entries.solo.skillStartedAt >= 0,
    );
    const windup = await page.evaluate(() => ({
      ...window.testWorld.buddies.entries.solo,
    }));
    expect(windup.skillCharge).toBe(0);
    expect(windup.lastSkillAt).toBe(-1);
    await page.waitForFunction(
      () => window.testWorld.buddies.entries.solo.lastSkillAt >= 0,
    );
    const active = await page.evaluate(() => {
      const w = window.testWorld;
      return {
        buddy: structuredClone(w.buddies),
        motion: window.testView.buddies.entries.get("solo").motion,
      };
    });
    expect(active.buddy.entries.solo.buddyId).toBe(kind);
    for (const [width, height] of [
      [844, 390],
      [640, 360],
    ]) {
      await page.setViewportSize({ width, height });
      await page.screenshot({ path: `${out}/${kind}-${width}.png` });
    }
    if (kind === "yosuga") {
      await page.waitForFunction(
        () =>
          window.testWorld.time >
          window.testWorld.buddies.entries.solo.lastSkillAt + 5,
      );
      const hp = await page.evaluate(() => window.testWorld.players[0].hp);
      expect(hp).toBeGreaterThan(40);
    }
    const charged = await page.evaluate(() => {
      const w = window.testWorld,
        b = w.buddies.entries.solo;
      b.skillReadyAt = w.time;
      w.players[0].hp = 40;
      return b.lastSkillAt;
    });
    await page.waitForTimeout(100);
    const skill = page.locator(".bd-skill-btn");
    const box = await skill.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(2100);
    expect(
      await page.evaluate(
        () => window.testWorld.buddies.entries.solo.lastSkillAt,
      ),
    ).toBe(charged);
    await page.mouse.up();
    await page.waitForFunction(
      (t) => window.testWorld.buddies.entries.solo.lastSkillAt > t,
      charged,
    );
    const longCast = await page.evaluate(() => ({
      ...window.testWorld.buddies.entries.solo,
    }));
    expect(longCast.skillCharge).toBe(1);
    expect(
      longCast.lastSkillAt - longCast.skillStartedAt,
    ).toBeGreaterThanOrEqual(kind === "tatara" ? 0.64 : 0.34);
    const retryTime = await page.evaluate(() => {
      window.testControls.activateBuddySkill();
      return window.testWorld.time;
    });
    await page.waitForFunction(
      (t) => window.testWorld.time > t + 0.1,
      retryTime,
    );
    const last = await page.evaluate(
      () => window.testWorld.buddies.entries.solo.lastSkillAt,
    );
    expect(last).toBe(longCast.lastSkillAt);
    await tap("#pause");
    await tap("#pt-retire");
    await tap("#pt-confirm");
    await page.waitForFunction(
      () => window.testView.buddies.entries.size === 0,
    );
    results.push({
      kind,
      before,
      windup,
      active,
      longCast,
      retireCleared: true,
    });
    console.log("成功: " + kind);
    await page.close();
    currentPage = null;
  }
  expect(errors).toEqual([]);
  console.log(JSON.stringify({ conditions: results.length, errors }));
} catch (error) {
  errors.push({
    kind: currentKind,
    error: String(error),
    state: await currentPage
      ?.evaluate(() => ({
        phase: window.testWorld?.phase,
        buddies: window.testWorld?.buddies,
        visuals: window.testView?.buddies
          ? [...window.testView.buddies.entries].map(([id, e]) => ({
              id,
              model: !!e.model,
              error: e.error,
            }))
          : null,
        body: document.body.className,
      }))
      .catch(() => null),
  });
  if (currentPage)
    await currentPage
      .screenshot({ path: out + "/failure.png" })
      .catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(
    out + "/results.json",
    JSON.stringify({ results, errors }, null, 2),
  );
  await browser.close();
}
