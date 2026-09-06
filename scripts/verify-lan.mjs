import { chromium, request, expect } from "@playwright/test";
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
const { address } = JSON.parse(readFileSync("dist-lan/config.json", "utf8"));
const origin = `https://${address}:5443`;
const key = /^ROOM_CREATION_KEY="([a-f0-9]{64})"$/m.exec(
  readFileSync(".dev.vars", "utf8"),
)?.[1];
if (!key) throw Error("Local room creation credential missing");
function scan(dir) {
  for (const f of readdirSync(dir, { withFileTypes: true })) {
    const p = dir + "/" + f.name;
    if (f.isDirectory()) scan(p);
    else if (readFileSync(p).includes(Buffer.from(key)))
      throw Error("Private credential in build");
  }
}
scan("dist-lan/site");
mkdirSync("dist-lan/evidence", { recursive: true });
// Ignore only this test context's expected self-signed certificate warning.
// No user/browser-wide trust or web security settings are modified.
const api = await request.newContext({ ignoreHTTPSErrors: true });
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const contexts = [];
const report = {
  url: origin + "/?qa=1",
  head: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  androidHardware: false,
  externalNetwork: false,
};
try {
  expect((await api.get(origin + "/api/health")).ok()).toBe(true);
  for (const p of [
    "/.dev.vars",
    "/server-key.pem",
    "/src/main.ts",
    "/.git/config",
    "/api/fixtures/test",
    "/@fs/.dev.vars",
  ])
    expect((await api.get(origin + p)).status()).toBe(404);
  expect((await api.post("http://127.0.0.1:8787/rooms")).status()).toBe(401);
  report.privateRoutesBlocked = true;
  report.directWorkerUnauthorizedCreationBlocked = true;
  report.secretNotInBuild = true;
  const options = {
    viewport: { width: 844, height: 320 },
    isMobile: true,
    hasTouch: true,
    ignoreHTTPSErrors: true,
  };
  const context = await browser.newContext(options);
  contexts.push(context);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin + "/?qa=1");
  expect(
    await page.evaluate(
      () => isSecureContext && typeof crypto.randomUUID === "function",
    ),
  ).toBe(true);
  await page.waitForTimeout(750);
  report.pwaOnSelfSignedLan = await page.evaluate(async () =>
    Boolean((await navigator.serviceWorker.getRegistration())?.active),
  );
  await page.locator("#solo").click();
  await page.locator("#launch").click();
  await expect(page.locator("#hud")).toBeVisible();
  await expect(page.locator(".weapon-hud")).toContainText(/\d+FPS/);
  await page.screenshot({ path: "dist-lan/evidence/solo-fps.png" });
  report.soloSecureContext = true;
  report.fpsOptIn = true;
  await page.goto(origin + "/");
  await page.locator("#solo").click();
  await page.locator("#launch").click();
  await expect(page.locator("#hud")).toBeVisible();
  await expect(page.locator(".weapon-hud")).not.toContainText("FPS");
  const second = await browser.newContext(options);
  contexts.push(second);
  const pages = [page, await second.newPage()];
  const worlds = [new Map(), new Map()];
  for (const [i, p] of pages.entries())
    p.on("websocket", (socket) =>
      socket.on("framereceived", ({ payload }) => {
        const m = JSON.parse(String(payload));
        if (m.type === "state") {
          // Individual loot is intentionally private and differs by participant.
          const { pending, rewards, drops, ...combat } = m.world;
          worlds[i].set(m.world.time, JSON.stringify(combat));
          if (worlds[i].size > 40)
            worlds[i].delete(worlds[i].keys().next().value);
        }
      }),
    );
  await page.goto(origin + "/?qa=1");
  await page.locator("#coop").click();
  await expect(page.locator(".coop-entry")).toContainText("友人と遊ぶ");
  await expect(page.locator(".coop-advanced .join")).not.toBeVisible();
  await page.getByRole("button", { name: "ルームを作る" }).click();
  await expect(page.getByText("準備完了", { exact: true })).toBeVisible();
  report.lanRoomCreationWithoutUserKey = true;
  const invite = await page.locator("#invite").inputValue();
  const code = invite.split("#")[1];
  expect(code).toMatch(/^[a-f0-9]{32}$/);
  const guest = pages[1];
  guest.on("pageerror", (e) => errors.push(e.message));
  await guest.goto(invite);
  await expect(guest.getByRole("heading", { name: "出撃準備" })).toBeVisible();
  await expect(guest.locator(".coop-entry")).toContainText(
    "招待を受け取りました",
  );
  expect(await guest.locator("#endpoint").inputValue()).toBe(origin + "/api");
  await guest.getByRole("button", { name: "招待ルームに参加" }).click();
  await expect(page.getByText("準備完了", { exact: true })).toHaveCount(2);
  await page.locator("#begin").click();
  for (const p of pages) await expect(p.locator("#hud")).toBeVisible();
  await expect
    .poll(() => [...worlds[0]].some(([t, state]) => worlds[1].get(t) === state))
    .toBe(true);
  for (const p of pages) expect(p.url()).not.toContain(key);
  const expectedPwaCertificateErrors = errors.filter((message) =>
    /^Failed to register a ServiceWorker for scope \('.+'\) with script \('.+\/sw\.js'\): An SSL certificate error occurred when fetching the script\.$/.test(
      message,
    ),
  );
  expect(errors).toEqual(expectedPwaCertificateErrors);
  await page.screenshot({ path: "dist-lan/evidence/coop.png" });
  report.twoBrowserRealWss = true;
  report.authoritativeCombatStatesMatch = true;
  writeFileSync("dist-lan/verification.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally {
  for (const context of contexts) await context.close();
  await browser.close();
  await api.dispose();
}
