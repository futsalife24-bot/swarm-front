import { test, expect } from "@playwright/test";
import { localCreationKey } from "../tests/credentials";
import { writeFileSync, mkdirSync } from "node:fs";
const dir = "dist-validation/structure-audit-fix";
test("four independent real Worker clients receive identical targets, telegraphs and projectiles", async ({
  browser,
  request,
}) => {
  const response = await request.post("http://127.0.0.1:8929/rooms", {
    headers: { "X-Room-Creation-Key": localCreationKey() },
  });
  expect(response.status()).toBe(200);
  const { code } = await response.json();
  const contexts = [];
  const pages = [];
  const errors: string[] = [];
  try {
    for (let i = 0; i < 4; i++) {
      const context = await browser.newContext({
        serviceWorkers: "block",
        viewport:
          i % 2 ? { width: 844, height: 390 } : { width: 1280, height: 720 },
      });
      contexts.push(context);
      const page = await context.newPage();
      pages.push(page);
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto("/e2e/structure-fixture.html");
      await page.evaluate(async (code) => {
        const { STARTERS } = await import("/src/shared/defs.ts");
        const history: any[] = [];
        (window as any).authorityHistory = history;
        const socket = new WebSocket(`ws://127.0.0.1:8929/rooms/${code}`);
        (window as any).authoritySocket = socket;
        await new Promise<void>((resolve, reject) => {
          socket.onopen = () => socket.send(JSON.stringify({ type: "hello" }));
          socket.onerror = () => reject(Error("WebSocket failed"));
          socket.onmessage = (event) => {
            const message = JSON.parse(event.data);
            history.push(message);
            if (
              message.type === "lobby" &&
              message.members.find((m: any) => m.id === (window as any).member)
                ?.ready
            )
              resolve();
            if (message.type === "welcome") {
              (window as any).member = message.id;
              socket.send(
                JSON.stringify({
                  type: "equip",
                  weapons: STARTERS.slice(0, 2),
                }),
              );
            }
          };
        });
      }, code);
    }
    expect(
      (
        await request.post(`http://127.0.0.1:8929/fixtures/${code}/structures`)
      ).ok(),
    ).toBe(true);
    await expect
      .poll(async () => {
        const states = await Promise.all(
          pages.map((p) =>
            p.evaluate(() =>
              (window as any).authorityHistory
                .filter((m: any) => m.type === "state")
                .map((m: any) => m.world),
            ),
          ),
        );
        return states[0].some(
          (w: any) =>
            w.projectiles.length > 0 &&
            states.every((h) => h.some((other: any) => other.time === w.time)),
        );
      })
      .toBe(true);
    const histories = await Promise.all(
      pages.map((p) =>
        p.evaluate(() =>
          (window as any).authorityHistory
            .filter((m: any) => m.type === "state")
            .map((m: any) => m.world),
        ),
      ),
    );
    const common = histories[0].find(
      (w: any) =>
        w.enemies?.some((e: any) => e.kind === "hornet" && e.wind > 0) &&
        histories.every((h) => h.some((other: any) => other.time === w.time)),
    );
    expect(common).toBeTruthy();
    for (const history of histories)
      expect(history.find((w: any) => w.time === common.time).enemies).toEqual(
        common.enemies,
      );
    const projectileState = histories[0].find(
      (w: any) =>
        w.projectiles.length > 0 &&
        histories.every((h) => h.some((other: any) => other.time === w.time)),
    );
    expect(projectileState).toBeTruthy();
    for (const h of histories)
      expect(
        h.find((w: any) => w.time === projectileState.time).projectiles,
      ).toEqual(projectileState.projectiles);
    expect(common.players).toHaveLength(4);
    const isolated = common.players.find((p: any) => p.z === 16).id;
    expect(common.enemies.find((e: any) => e.kind === "hornet").targetId).toBe(
      isolated,
    );
    expect(common.enemies.find((e: any) => e.kind === "spitter").targetId).toBe(
      isolated,
    );
    expect(common.enemies.find((e: any) => e.kind === "boss").tz).toBeLessThan(
      10,
    );
    for (let i = 0; i < 2; i++) {
      await pages[i].evaluate(async () => {
        const { Renderer } = await import("/src/client/render.ts");
        document.body.innerHTML = "";
        const canvas = document.createElement("canvas");
        document.body.append(canvas);
        const view = new Renderer(canvas);
        (window as any).view = view;
        const draw = () => {
          const states = (window as any).authorityHistory.filter(
            (m: any) => m.type === "state",
          );
          const w = states.at(-1)?.world;
          if (w) view.render(w, (window as any).member, 0.016, 0, 0.1);
          (window as any).frame = requestAnimationFrame(draw);
        };
        draw();
      });
      await pages[i].waitForTimeout(300);
      await pages[i].screenshot({ path: `${dir}/coop-${i}.png` });
    }
    expect(errors).toEqual([]);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      `${dir}/network.json`,
      JSON.stringify(
        {
          clients: 4,
          time: common.time,
          enemies: common.enemies,
          projectileTime: projectileState.time,
          projectiles: projectileState.projectiles,
          errors,
        },
        null,
        2,
      ),
    );
  } finally {
    for (const context of contexts) await context.close();
  }
});

test("models, phase transformation and solo telegraphs compile in real WebGL; report fits mobile", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && /WebGL|shader|THREE/.test(m.text()))
      errors.push(m.text());
  });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await page.getByRole("button", { name: "エネミーレポート" }).click();
  for (const kind of ["crawler", "spitter", "hornet", "boss"]) {
    await page.locator(`[data-enemy="${kind}"]`).click();
    await page.screenshot({ path: `${dir}/${kind}.png` });
  }
  await page.setViewportSize({ width: 844, height: 390 });
  await page.screenshot({ path: `${dir}/report-mobile.png` });
  expect(
    await page
      .locator("dialog")
      .evaluate((e) => e.scrollWidth <= e.clientWidth),
  ).toBe(true);
  await page.getByRole("button", { name: "タイトルへ戻る" }).click();
  await page.getByRole("button", { name: /ソロで出撃準備/ }).click();
  await page.locator("#launch").click();
  await expect(page.locator("#hud")).toBeVisible();
  await page.mouse.down();
  await page.waitForTimeout(300);
  await page.mouse.up();
  await page.goto("/e2e/structure-fixture.html");
  await page.evaluate(async () => {
    const { Renderer } = await import("/src/client/render.ts");
    const { createWorld, addPlayer, start, spawn } =
      await import("/src/shared/game.ts");
    const canvas = document.createElement("canvas");
    document.body.replaceChildren(canvas);
    const view = new Renderer(canvas);
    const w = createWorld("visual", 123);
    addPlayer(w, "p");
    start(w);
    w.enemies = [];
    for (const [i, kind] of [
      "crawler",
      "spitter",
      "hornet",
      "boss",
    ].entries()) {
      spawn(w, kind, (i - 1.5) * 5, -8, "crown");
      const e = w.enemies.at(-1);
      Object.assign(e, {
        targetId: "p",
        wind: kind === "crawler" ? 0.2 : 0.6,
        tx: e.x,
        tz: e.z + 2,
        phase: 3,
      });
    }
    view.render(w, "p", 0.016, 0, 0.1);
    (window as any).visualFixture = { w, view };
    if (
      view.houndWarnings.count !== 1 ||
      view.rings.count !== 1 ||
      view.aimWarnings.count !== 6
    )
      throw Error("Missing authoritative telegraphs");
    view.camera.position.set(0, 25, 15);
    view.camera.lookAt(0, 1, -8);
    view.renderer.render(view.scene, view.camera);
  });
  await page.screenshot({ path: `${dir}/telegraphs-phase3.png` });
  await page.evaluate(() => {
    const { view } = (window as any).visualFixture;
    view.combat.event({ id: 999, type: "acid", x: 0, y: 0.1, z: -4 });
    view.combat.trails([{ x: 1, y: 2, z: -4, rocket: false }], 0.05);
    view.combat.update(0.04, view.camera);
    view.renderer.render(view.scene, view.camera);
  });
  await page.screenshot({ path: `${dir}/energy-impact.png` });
  await page.goto("/");
  await page.locator("#changelog").click();
  await expect(page.locator("body")).not.toContainText(
    /巨大ミミズ|アリの巣|蜂|蟻|蜘蛛|甲虫|噛みつき|酸/,
  );
  await page.screenshot({ path: `${dir}/changelog.png` });
  expect(errors).toEqual([]);
  writeFileSync(
    `${dir}/visual.json`,
    JSON.stringify(
      {
        webglErrors: errors,
        soloStarted: true,
        mobileReportFits: true,
        telegraphFixture: true,
      },
      null,
      2,
    ),
  );
});
