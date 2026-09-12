import { test, expect } from "@playwright/test";
import { localCreationKey } from "../tests/credentials";
test("new enemies and articulated boss arrive on two real clients", async ({
  browser,
  request,
}) => {
  const ca = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  const cb = await browser.newContext({
    viewport: { width: 844, height: 390 },
    hasTouch: true,
  });
  const errors: string[] = [];
  try {
    const a = await ca.newPage(),
      b = await cb.newPage();
    for (const page of [a, b])
      page.on("pageerror", (e) => errors.push(e.message));
    await a.goto("/");
    await a.getByRole("button", { name: "協力プレイ" }).click();
    await a.locator(".coop-advanced summary").click();
    await a.locator("#endpoint").fill("http://127.0.0.1:8907");
    await a.locator("#creation-key").evaluate((el: HTMLInputElement, key) => {
      el.value = key;
    }, localCreationKey());
    const creation = a.waitForResponse(
      (r) => r.url().includes("8907") && r.request().method() === "POST",
    );
    await a.getByRole("button", { name: "ルームを作る" }).click();
    expect((await creation).status()).toBe(200);
    await expect(a.locator("#lobby-stage")).toBeVisible();
    await ca.grantPermissions(["clipboard-read", "clipboard-write"]);
    await a
      .getByRole("button", { name: "招待リンクをコピー", exact: true })
      .click();
    const invite = await a.evaluate(() => navigator.clipboard.readText()),
      code = invite.split("#")[1];
    await b.goto(invite);
    await b.locator(".coop-advanced summary").click();
    await b.locator("#endpoint").fill("http://127.0.0.1:8907");
    await b.getByRole("button", { name: "招待ルームに参加" }).click();
    await expect(a.locator(".is-ready")).toHaveCount(2);
    expect(
      (
        await request.post(`http://127.0.0.1:8907/fixtures/${code}/enemies`)
      ).ok(),
    ).toBe(true);
    for (const [index, page] of [a, b].entries()) {
      await expect(page.locator("#hud")).toContainText("ボス");
      await expect
        .poll(() =>
          page.evaluate(() => {
            const w = (window as any).__swarm.world;
            return w?.enemies.map((e: any) => e.kind).sort();
          }),
        )
        .toEqual(["ant", "boss", "hornet", "spider"]);
      const state = await page.evaluate(() => (window as any).__swarm.world);
      expect(state.stage).toBe(5);
      expect(
        state.enemies.find((e: any) => e.kind === "boss").segments,
      ).toHaveLength(7);
      await page.screenshot({
        path: `dist-validation/enemies/coop-${index}.png`,
      });
    }
    expect(
      (
        await request.post(`http://127.0.0.1:8907/fixtures/${code}/worm-split`)
      ).ok(),
    ).toBe(true);
    for (const [index, page] of [a, b].entries()) {
      await expect
        .poll(() =>
          page.evaluate(
            () => (window as any).__swarm.world?.enemies[0]?.fractured,
          ),
        )
        .toBe(true);
      const before = await page.evaluate(
        () => (window as any).__swarm.world.enemies[0],
      );
      expect(before.segments[3].partHp).toBe(0);
      expect(before.segments[4].partHp).toBeGreaterThan(0);
      await expect
        .poll(async () => {
          const now = await page.evaluate(
            () => (window as any).__swarm.world.enemies[0],
          );
          return Math.min(
            Math.hypot(now.x - before.x, now.z - before.z),
            Math.hypot(
              now.segments[4].x - before.segments[4].x,
              now.segments[4].z - before.segments[4].z,
            ),
          );
        })
        .toBeGreaterThan(3);
      await page.screenshot({
        path: `dist-validation/worm/coop-split-${index}.png`,
      });
    }
    expect(errors).toEqual([]);
  } finally {
    await ca.close();
    await cb.close();
  }
});

test("visual fixture shows each silhouette and wall poses", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(async () => {
    const { Renderer } = await import("/src/client/render.ts");
    const { createWorld, addPlayer, start, spawn } =
      await import("/src/shared/game.ts");
    const canvas = document.createElement("canvas");
    canvas.style.cssText = "position:fixed;inset:0;z-index:99999";
    document.body.append(canvas);
    const view = new Renderer(canvas),
      w = createWorld("visual", 5, 5);
    addPlayer(w, "p");
    start(w);
    w.enemies = [];
    spawn(w, "ant", -5, 4);
    spawn(w, "spider", 5, 4);
    spawn(w, "hornet", 0, -2);
    spawn(w, "boss", 0, -15);
    view.render(w, "p", 0.016, 0, 0);
    view.camera.position.set(23, 23, 29);
    view.camera.lookAt(0, 1, -5);
    view.renderer.render(view.scene, view.camera);
    (window as any).__enemyView = { view, w };
    const mesh = view.enemies.get("ant");
    const before = view.camera.matrix.clone();
    mesh.getMatrixAt(0, before);
    w.time += 0.2;
    view.render(w, "p", 0.1, 0, 0);
    const after = view.camera.matrix.clone();
    mesh.getMatrixAt(0, after);
    if (before.elements[13] !== after.elements[13])
      throw new Error("Ground bob remains");
    const ant = w.enemies.find((e: any) => e.kind === "ant");
    ant.x += 0.3;
    view.render(w, "p", 0.05, 0, 0);
    if (mesh.geometry.getAttribute("stride").getX(0) !== 1)
      throw new Error("Ant gait inactive");
    if (
      !Array.from(mesh.geometry.getAttribute("legPhase").array).some(
        (v) => v !== 0,
      )
    )
      throw new Error("Missing animated legs");
  });
  await page.screenshot({ path: "dist-validation/enemies/silhouettes.png" });
  await page.evaluate(async () => {
    const { specialMotion } = await import("/src/shared/enemy-motion.ts");
    const { view, w } = (window as any).__enemyView;
    const spider = w.enemies.find((e: any) => e.kind === "spider");
    spider.x = 9.8;
    spider.z = -10;
    const hornet = w.enemies.find((e: any) => e.kind === "hornet");
    hornet.x = 9.9;
    hornet.z = -5;
    specialMotion(w, spider, w.players[0], 0.05);
    specialMotion(w, hornet, w.players[0], 0.05);
    if (!spider.perch || !hornet.perch)
      throw new Error("Wall fixture did not perch");
    view.render(w, "p", 1, 0, 0);
    view.camera.position.set(-5, 12, 10);
    view.camera.lookAt(10, 3, -8);
    view.renderer.render(view.scene, view.camera);
  });
  await page.screenshot({ path: "dist-validation/enemies/poses.png" });
});

test("worm flight and separated chains render without broken segments", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.evaluate(async () => {
    const { Renderer } = await import("/src/client/render.ts");
    const { createWorld, addPlayer, spawn } =
      await import("/src/shared/game.ts");
    const { moveWorm } = await import("/src/shared/worm.ts");
    const canvas = document.createElement("canvas");
    canvas.style.cssText = "position:fixed;inset:0;z-index:99999";
    document.body.append(canvas);
    const view = new Renderer(canvas),
      w = createWorld("worm-visual", 51, 6);
    addPlayer(w, "p");
    w.phase = "battle";
    spawn(w, "boss", 0, -15, "worm");
    for (let n = 0; n < 250; n++) {
      w.time += 0.05;
      moveWorm(w, w.enemies[0], 0.05);
      w.projectiles = [];
    }
    view.render(w, "p", 1, 0, 0);
    view.camera.position.set(65, 65, 70);
    view.camera.lookAt(0, 0, 0);
    view.renderer.render(view.scene, view.camera);
    (window as any).__wormVisual = { view, w };
    if (view.bossBody.count !== 7) throw new Error("Missing body segments");
  });
  await page.screenshot({ path: "dist-validation/worm/flight.png" });
  await page.evaluate(async () => {
    const { hurtEnemy } = await import("/src/shared/game.ts");
    const { moveWorm } = await import("/src/shared/worm.ts");
    const { view, w } = (window as any).__wormVisual;
    hurtEnemy(w, w.enemies[0], 1e6, "p", 4);
    for (let n = 0; n < 110; n++) {
      w.time += 0.05;
      moveWorm(w, w.enemies[0], 0.05);
      w.projectiles = [];
    }
    view.render(w, "p", 1, 0, 0);
    view.camera.position.set(65, 65, 70);
    view.camera.lookAt(0, 0, 0);
    view.renderer.render(view.scene, view.camera);
    if (view.bossBody.count !== 5 || view.enemies.get("boss").count !== 2)
      throw new Error("Incorrect fragment geometry");
  });
  await page.screenshot({ path: "dist-validation/worm/split.png" });
  expect(errors).toEqual([]);
});
