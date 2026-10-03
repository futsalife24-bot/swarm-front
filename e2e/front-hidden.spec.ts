import {
  test as base,
  expect,
  chromium,
  type Browser,
  type Page,
} from "@playwright/test";
import {
  mkdirSync,
  writeFileSync,
  mkdtempSync,
  existsSync,
  readFileSync,
} from "node:fs";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { localCreationKey } from "../tests/credentials";

// The public noDefaults option preserves native tab visibility on an isolated profile.
const test = base.extend<{ nativeBrowser: Browser }>({
  nativeBrowser: async ({}, use) => {
    const profile = mkdtempSync(join(tmpdir(), "swarm-front-hidden-"));
    const child = spawn(
      process.env.CHROMIUM_PATH ??
        "C:/Program Files/Google/Chrome/Application/chrome.exe",
      [
        "--remote-debugging-port=0",
        "--remote-debugging-address=127.0.0.1",
        `--user-data-dir=${profile}`,
        "--no-first-run",
        "--no-default-browser-check",
        "--window-size=1000,650",
        "about:blank",
      ],
      { windowsHide: true, stdio: "ignore" },
    );
    const activePort = join(profile, "DevToolsActivePort");
    await expect
      .poll(() => existsSync(activePort), { timeout: 15000 })
      .toBe(true);
    const port = readFileSync(activePort, "utf8").split("\n")[0];
    const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`, {
      noDefaults: true,
    });
    try {
      await use(browser);
    } finally {
      const session = await browser.newBrowserCDPSession();
      await session.send("Browser.close").catch(() => {});
      await browser.close();
      child.kill();
    }
  },
});

test("同一実ブラウザの背面タブでも協力準備が完了する", async ({
  nativeBrowser: browser,
}) => {
  const context = browser.contexts()[0];
  const page = context.pages()[0];
  context.setDefaultTimeout(10000);
  await page.bringToFront();
  const evidence = "docs/evidence/rebuild-p1a/front-f1-20261003";
  mkdirSync(evidence, { recursive: true });
  const response = await fetch("http://127.0.0.1:8789/rooms", {
    method: "POST",
    headers: { "X-Room-Creation-Key": localCreationKey() },
    body: JSON.stringify({
      name: "背面準備検証",
      listed: false,
      ruleset: "front-v1",
      mode: "defense",
    }),
  });
  expect(response.status).toBe(200);
  const entry = await response.json();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let heldRequests = 0;
  await page.route("**/standard_trooper_v10.glb", async (route) => {
    heldRequests++;
    await held;
    await route.continue();
  });
  const join = async (p: Page) => {
    await p.goto(`http://127.0.0.1:5186/front.html?frontRoom=${entry.roomId}`);
    await expect(p.locator("#room-id")).toBeVisible({ timeout: 10000 });
    // Native DPI-scaled window input is outside this loading regression. Use the
    // real form's normal join handler; ordinary front E2E covers pointer input.
    await p.locator("#endpoint").evaluate((el) => {
      (el as HTMLInputElement).value = "http://127.0.0.1:8789";
    });
    await p.locator("#room-id").evaluate((el, roomId) => {
      (el as HTMLInputElement).value = roomId;
    }, entry.roomId);
    await p
      .locator("#room-join")
      .evaluate((el) => (el as HTMLButtonElement).click());
    await expect(
      p.getByRole("heading", { name: "防衛戦 · 協力部隊", exact: true }),
    ).toBeVisible();
  };
  await join(page);
  await expect.poll(() => heldRequests, { timeout: 15000 }).toBeGreaterThan(0);
  await expect(
    page.getByRole("button", { name: "出撃", exact: true }),
  ).toBeDisabled();
  await page.evaluate(() => {
    const probe = { frames: 0 };
    (window as any).__frontHiddenProbe = probe;
    const tick = () => {
      probe.frames++;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  // A second BrowserContext can open a separate visible window. Use real tabs in
  // one context and clear only the test peer's reconnect identity before joining.
  const peer = await context.newPage();
  await peer.addInitScript(() => {
    sessionStorage.removeItem("swarm-front-rebuild-session");
    localStorage.removeItem("swarm-front-rebuild-session");
  });
  peer.on("pageerror", (error) => errors.push(error.message));
  try {
    await peer.bringToFront();
    await join(peer);
    await expect.poll(() => page.evaluate(() => document.hidden)).toBe(true);
    const before = await page.evaluate(
      () => (window as any).__frontHiddenProbe.frames,
    );
    await peer.waitForTimeout(1500);
    const after = await page.evaluate(
      () => (window as any).__frontHiddenProbe.frames,
    );
    expect(after).toBe(before);
    release();
    await expect(
      page.getByRole("button", { name: "出撃", exact: true }),
    ).toBeEnabled({ timeout: 65000 });
    const hiddenAtReady = await page.evaluate(() => document.hidden);
    expect(hiddenAtReady).toBe(true);
    const roster = await page.locator(".front-members p").allTextContents();
    expect(roster).toHaveLength(2);
    expect(roster.every((row) => row.includes("準備完了"))).toBe(true);
    expect(errors).toEqual([]);
    writeFileSync(
      `${evidence}/hidden-ready.json`,
      JSON.stringify(
        {
          browser: browser.version(),
          headed: true,
          sameBrowser: true,
          hiddenAtReady,
          rafBefore: before,
          rafAfter: after,
          heldRequests,
          readyMembers: roster.length,
          pageErrors: errors,
          result: "背面でrAF停止中にも実モデル・マップ・2隊員の準備が完了",
        },
        null,
        2,
      ) + "\n",
    );
  } finally {
    release();
    await peer.close();
  }
});
