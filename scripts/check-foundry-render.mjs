import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";

const url = process.env.FOUNDRY_RENDER_URL || "http://127.0.0.1:5199";
const output = process.env.FOUNDRY_RENDER_OUTPUT || "dist-validation/foundry-production-render";
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
    serviceWorkers: "block",
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto(url);
  const gait = await page.evaluate(async () => {
    const source = await (await fetch("/src/client/foundry-worm.ts")).text();
    const T = await import(source.match(/from "([^"]*\/three\.js[^"]*)"/)[1]);
    const { FoundryWormView, FOUNDRY_WORM_ASSET } =
      await import("/src/client/foundry-worm.ts");
    const { foundryLaserOrigin, foundryLaserDirection } =
      await import("/src/shared/foundry-defs.ts");
    const scene = new T.Scene();
    scene.background = new T.Color(0x142029);
    const canvas = document.createElement("canvas");
    canvas.style.cssText = "position:fixed;inset:0;z-index:99999";
    document.body.append(canvas);
    const renderer = new T.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(1280, 800);
    const camera = new T.PerspectiveCamera(40, 1.6, 0.1, 200);
    scene.add(new T.HemisphereLight(0xf0f7ff, 0x253c42, 2));
    const light = new T.DirectionalLight(0xffffff, 3.5);
    light.position.set(5, 15, 9);
    scene.add(light);
    const plane = new T.Mesh(
      new T.PlaneGeometry(180, 180),
      new T.MeshStandardMaterial({ color: 0x20303b, roughness: 0.85 }),
    );
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = -0.002;
    scene.add(plane);
    const view = await FoundryWormView.load(FOUNDRY_WORM_ASSET);
    scene.add(view.root);
    const feet = [],
      lengths = new Map();
    view.root.traverse((node) => {
      if (!node.name.endsWith("_FOOT")) return;
      feet.push(node);
      const prefix = node.name.slice(0, -5),
        upper = view.root.getObjectByName(prefix + "_UPPER"),
        lower = view.root.getObjectByName(prefix + "_LOWER");
      lengths.set(node, {
        upper,
        lower,
        a: upper.position.distanceTo(lower.position),
        b: lower.position.distanceTo(node.position),
      });
    });
    let previous = new Map(),
      travel = 0,
      maxSlip = 0,
      maxJointError = 0,
      maxReachError = 0,
      minSole = Infinity,
      contactSamples = 0,
      maxOriginError = 0,
      maxAimError = 0,
      stoppedContacts = 0;
    const metrics = [];
    const liftFrames = feet.map(() => []);
    const liftHeights = feet.map(() => 0);
    const fixture = (distance, dead = []) => {
      const nodes = Array.from({ length: 8 }, (_, i) => {
        const angle = (distance - i * 3.2) / 30;
        return {
          x: 30 * Math.sin(angle),
          y: 0,
          z: 30 * Math.cos(angle) - 30,
          heading: Math.PI / 2 + angle,
          partHp: dead.includes(i) ? 0 : 100,
          pulseAim: { x: -5, y: 1.2, z: 18 },
          acidAt: 100,
        };
      });
      return {
        id: 1,
        kind: "boss",
        ...nodes[0],
        segments: nodes.slice(1),
        hp: 800,
        maxHp: 800,
        cool: 0,
        wind: 0,
        hurt: 0,
        tx: 0,
        tz: 0,
      };
    };
    for (let frame = 0; frame <= 300; frame++) {
      const speed =
        frame < 120 ? 4.2 : frame < 210 ? 6.3 : frame < 240 ? 0 : 4.2;
      if (frame) travel += speed / 60;
      const enemy = fixture(travel),
        before = JSON.stringify(enemy);
      view.update(enemy, frame / 60);
      if (JSON.stringify(enemy) !== before)
        throw Error("Gait mutated its snapshot");
      const current = new Map();
      for (const [index, foot] of feet.entries()) {
        const position = foot.getWorldPosition(new T.Vector3());
        const contact = foot.userData.foundryContact;
        const old = previous.get(foot);
        if (old?.contact && !contact) liftFrames[index].push(frame);
        liftHeights[index] = Math.max(liftHeights[index], position.y);
        if (contact && old?.contact) {
          maxSlip = Math.max(maxSlip, position.distanceTo(old.position));
          contactSamples++;
        }
        maxReachError = Math.max(
          maxReachError,
          foot.userData.foundryReachError || 0,
        );
        const leg = lengths.get(foot),
          hip = leg.upper.getWorldPosition(new T.Vector3()),
          knee = leg.lower.getWorldPosition(new T.Vector3());
        maxJointError = Math.max(
          maxJointError,
          Math.abs(hip.distanceTo(knee) - leg.a),
          Math.abs(knee.distanceTo(position) - leg.b),
        );
        if (frame % 6 === 0)
          minSole = Math.min(minSole, new T.Box3().setFromObject(foot).min.y);
        current.set(foot, { position, contact });
      }
      if (frame === 239)
        stoppedContacts = [...current.values()].filter((x) => x.contact).length;
      previous = current;
      if (frame % 60 === 0) {
        for (const [part, node] of [enemy, ...enemy.segments].entries()) {
          const name = part
            ? `FZ_BODY_${String(part).padStart(2, "0")}_LASER`
            : "FZ_HEAD_CENTRAL_LASER";
          const laser = view.root.getObjectByName(name),
            muzzle = laser.children.find((n) => n.name.endsWith("_MUZZLE"));
          const actual = muzzle.getWorldPosition(new T.Vector3()),
            origin = foundryLaserOrigin(node, part),
            direction = foundryLaserDirection(origin, node.pulseAim);
          maxOriginError = Math.max(
            maxOriginError,
            actual.distanceTo(new T.Vector3(origin.x, origin.y, origin.z)),
          );
          const facing = new T.Vector3(0, 0, -1).applyQuaternion(
            laser.getWorldQuaternion(new T.Quaternion()),
          );
          maxAimError = Math.max(
            maxAimError,
            facing.distanceTo(
              new T.Vector3(direction.x, direction.y, direction.z),
            ),
          );
        }
        const center = new T.Box3()
          .setFromObject(view.root)
          .getCenter(new T.Vector3());
        camera.position.copy(center).add(new T.Vector3(-14, 13, 23));
        camera.lookAt(center);
        renderer.render(scene, camera);
        metrics.push({
          frame,
          speed,
          calls: renderer.info.render.calls,
          triangles: renderer.info.render.triangles,
        });
      }
    }
    view.update(fixture(travel, [4]), 5.02);
    renderer.render(scene, camera);
    window.__foundryGaitProof = {
      view,
      scene,
      renderer,
      camera,
      canvas,
      fixture,
      travel,
      plane,
    };
    return {
      feet: feet.length,
      maxSlip,
      maxJointError,
      maxReachError,
      minSole,
      contactSamples,
      stoppedContacts,
      maxOriginError,
      maxAimError,
      metrics,
      splitVisible: view.units.map((u) => u.visible),
      multiDraw: renderer.extensions.has("WEBGL_multi_draw"),
      irregular: {
        liftFrames,
        distinctSchedules: new Set(liftFrames.map((frames) => frames.join(','))).size,
        varyingIntervals: liftFrames.filter((frames) => {
          const steady = frames.filter((frame) => frame < 120);
          return new Set(steady.slice(1).map((frame, i) => frame - steady[i])).size > 1;
        }).length,
        liftHeightRange: Math.max(...liftHeights) - Math.min(...liftHeights),
      },
    };
  });
  console.log("gait", JSON.stringify(gait));
  await page.screenshot({ path: `${output}/gait-split.png` });
  assert.equal(gait.feet, 34);
  assert.equal(gait.irregular.distinctSchedules, 34, 'Every leg needs its own timing');
  assert.equal(gait.irregular.varyingIntervals, 34, 'Timing must vary between steps');
  assert.ok(gait.irregular.liftHeightRange > 0.025, 'Lift heights must not be uniform');
  assert.ok(gait.contactSamples > 500);
  assert.ok(gait.maxSlip < 0.001, `Planted foot slipped ${gait.maxSlip}m`);
  assert.ok(gait.maxJointError < 0.00001);
  assert.ok(gait.minSole > -0.001, `Foot below ground ${gait.minSole}m`);
  assert.equal(gait.stoppedContacts, 34);
  assert.ok(gait.maxOriginError < 0.00001 && gait.maxAimError < 0.00001);
  assert.equal(gait.splitVisible.filter(Boolean).length, 7);
  const integration = await page.evaluate(async () => {
    const proof = window.__foundryGaitProof;
    proof.view.dispose();
    proof.plane.geometry.dispose();
    proof.plane.material.dispose();
    proof.renderer.dispose();
    proof.canvas.remove();
    const { Renderer } = await import("/src/client/render.ts");
    const { createWorld, addPlayer, spawn } =
      await import("/src/shared/game.ts");
    const canvas = document.createElement("canvas");
    canvas.style.cssText = "position:fixed;inset:0;z-index:99999";
    document.body.append(canvas);
    const view = new Renderer(canvas),
      world = createWorld("foundry-render", 51, 2);
    addPlayer(world, "p");
    world.phase = "battle";
    world.enemies = [];
    spawn(world, "boss", -8, -12, "crown");
    spawn(world, "boss", 7, -12, "worm");
    const worm = world.enemies.find((e) => e.segments);
    const nodes = [worm, ...worm.segments];
    for (const [i, node] of nodes.entries())
      Object.assign(node, {
        x: 7,
        y: 0,
        z: -12 - i * 3.2,
        heading: 0,
        partHp: 100,
        pulseAim: { x: -8, y: 1.2, z: 8 },
        acidAt: 0.8,
      });
    view.render(world, "p", 1 / 60, 0, 0);
    await Promise.all([
      view.foundryWorms.get(worm.id).loading,
      view.structures.get("boss").loading,
    ]);
    const before = JSON.stringify(world);
    view.render(world, "p", 1 / 60, 0, 0);
    const stateUnchanged = JSON.stringify(world) === before;
    if (!stateUnchanged) throw Error("Renderer mutated World");
    const ready = view.foundryWorms.get(worm.id);
    if (!ready.view) throw Error(ready.error || "Worm GLB did not load");
    const coexistence = {
      normalBosses: view.structures.get("boss").batch.parts[0].count,
      fallbackBodies: view.bossBody.count,
      wormUnits: ready.view.units.filter((u) => u.visible).length,
      warnings: view.foundryWarnings.count,
    };
    world.projectiles = [
      {
        id: 99,
        x: 7,
        y: 2,
        z: -8,
        dx: 0,
        dy: 0,
        dz: 60,
        life: 1,
        owner: "enemy",
        damage: 10,
        rocket: false,
        style: "laser",
      },
    ];
    view.render(world, "p", 1 / 60, 0, 0);
    const laser = {
      core: view.foundryLasers.count,
      glow: view.foundryLaserGlow.count,
      oldProjectiles: view.projectiles.count,
    };
    worm.partHp = 0;
    worm.segments[3].partHp = 0;
    view.render(world, "p", 1 / 60, 0, 0);
    const cut = ready.view.units.map((u) => u.visible);
    view.camera.position.set(32, 23, 24);
    view.camera.lookAt(0, 1, -20);
    view.renderer.render(view.scene, view.camera);
    const root = ready.view.root;
    window.__foundryRendererProof = { view, world, canvas, root };
    return {
      coexistence,
      laser,
      cut,
      stateUnchanged,
      calls: view.renderer.info.render.calls,
    };
  });
  console.log("integration", JSON.stringify(integration));
  await page.screenshot({ path: `${output}/renderer-split.png` });
  await page.evaluate(() => {
    const { view, world } = window.__foundryRendererProof;
    const worm = world.enemies.find((e) => e.segments);
    worm.partHp = 100;
    worm.segments.forEach((n) => (n.partHp = 100));
    view.render(world, "p", 1 / 60, 0, 0);
    view.camera.position.set(29, 18, 18);
    view.camera.lookAt(0, 1, -20);
    view.renderer.render(view.scene, view.camera);
  });
  await page.screenshot({ path: `${output}/renderer-coexistence.png` });
  assert.deepEqual(integration.coexistence, {
    normalBosses: 1,
    fallbackBodies: 0,
    wormUnits: 8,
    warnings: 8,
  });
  assert.deepEqual(integration.laser, { core: 1, glow: 1, oldProjectiles: 0 });
  assert.equal(integration.cut[0], false);
  assert.equal(integration.cut[4], false);
  assert.equal(integration.cut.filter(Boolean).length, 6);
  const movement = await page.evaluate(async () => {
    const { view } = window.__foundryRendererProof;
    const { createWorld, addPlayer, spawn, start, hurtEnemy } =
      await import("/src/shared/game.ts");
    const { moveWorm, placeWormOnGround, wormNodes, wormChains } =
      await import("/src/shared/worm.ts");
    const world = createWorld("foundry-real-turn", 11, 2),
      player = addPlayer(world, "p");
    start(world);
    world.nextSpawn = 1e9;
    world.enemies = [];
    spawn(world, "boss", 0, 0, "worm");
    const enemy = world.enemies[0];
    placeWormOnGround(world, enemy);
    player.x = player.z = 70;
    view.render(world, "p", 1 / 60, 0, 0);
    await view.foundryWorms.get(enemy.id).loading;
    const model = view.foundryWorms.get(enemy.id).view;
    // Exercise every real Renderer projection/IK update, but submit GPU draws
    // only for evidence frames. Queuing 723 synchronous SwiftShader draws
    // obscures the fixture with a compositor timeout rather than testing gait.
    const draw = view.renderer.render.bind(view.renderer);
    view.renderer.render = () => {};
    let prior = new Map(),
      rotations = [],
      maxRawTurn = 0,
      maxVisualTurn = 0,
      maxSlip = 0,
      maxFootStep = 0,
      maxReachError = 0,
      samples = 0;
    let minimumAdjacent = { distance: Infinity },
      minimumNonAdjacent = { distance: Infinity },
      worstEnemy;
    const capturePose = () => {
      const pose = [];
      model.root.traverse((node) =>
        pose.push({
          node,
          position: node.position.clone(),
          quaternion: node.quaternion.clone(),
          scale: node.scale.clone(),
          visible: node.visible,
        }),
      );
      return pose;
    };
    let previousPose = capturePose(),
      worstFootPoses,
      maximumFootRecord;
    for (let tick = 0; tick < 241; tick++) {
      if (tick === 160) hurtEnemy(world, enemy, 1e6, player.id, 0);
      if (tick === 161) hurtEnemy(world, enemy, 1e6, player.id, 4);
      world.enemies = [enemy];
      const before = wormNodes(enemy).map((n) => n.heading ?? 0);
      world.time += 0.05;
      moveWorm(world, enemy, 0.05);
      world.projectiles = [];
      const currentNodes = wormNodes(enemy);
      for (const chain of wormChains(enemy))
        for (let a = 0; a < chain.length; a++)
          for (let b = a + 1; b < chain.length; b++) {
            const first = currentNodes[chain[a]],
              second = currentNodes[chain[b]];
            const distance = Math.hypot(first.x - second.x, first.z - second.z);
            const record = {
              distance,
              tick,
              parts: [chain[a], chain[b]],
              chain,
              positions: [first, second].map((n) => ({
                x: n.x,
                z: n.z,
                heading: n.heading,
              })),
            };
            if (b === a + 1 && distance < minimumAdjacent.distance) {
              minimumAdjacent = record;
              worstEnemy = structuredClone(enemy);
            }
            if (b > a + 1 && distance < minimumNonAdjacent.distance)
              minimumNonAdjacent = record;
          }
      for (const [i, node] of wormNodes(enemy).entries())
        if (node.partHp !== 0) {
          const difference = (node.heading ?? 0) - before[i];
          maxRawTurn = Math.max(
            maxRawTurn,
            Math.abs(Math.atan2(Math.sin(difference), Math.cos(difference))),
          );
        }
      for (let frame = 0; frame < 3; frame++) {
        view.render(world, "p", 1 / 60, 0, 0);
        const next = new Map();
        let changedMaximum = false;
        for (const [index, unit] of model.units.entries()) {
          if (!unit.visible) continue;
          if (rotations[index])
            maxVisualTurn = Math.max(
              maxVisualTurn,
              unit.quaternion.angleTo(rotations[index]),
            );
          rotations[index] = unit.quaternion.clone();
          unit.traverse((foot) => {
            if (!foot.name.endsWith("_FOOT")) return;
            const position = foot.getWorldPosition(foot.position.clone()),
              contact = foot.userData.foundryContact,
              old = prior.get(foot);
            const delta = old ? position.distanceTo(old.position) : 0;
            if (delta > maxFootStep) {
              maxFootStep = delta;
              changedMaximum = true;
              const leg = model.gait.units[index].legs.find(
                (leg) => leg.foot === foot,
              );
              maximumFootRecord = {
                tick,
                frame,
                name: foot.name,
                delta,
                contactBefore: old.contact,
                contactAfter: contact,
                before: old.position.toArray(),
                after: position.toArray(),
                progress: leg.step?.progress,
                swingDistance: leg.step?.from.distanceTo(leg.step.to),
                from: leg.step?.from.toArray(),
                to: leg.step?.to.toArray(),
              };
            }
            if (contact && old?.contact) {
              maxSlip = Math.max(maxSlip, position.distanceTo(old.position));
              samples++;
            }
            maxReachError = Math.max(
              maxReachError,
              foot.userData.foundryReachError || 0,
            );
            next.set(foot, { position, contact });
          });
        }
        const currentPose = capturePose();
        if (changedMaximum) worstFootPoses = [previousPose, currentPose];
        previousPose = currentPose;
        prior = next;
      }
    }
    const result = {
      maxRawTurn,
      maxVisualTurn,
      maxSlip,
      maxFootStep,
      maxReachError,
      samples,
      minimumAdjacent,
      minimumNonAdjacent,
      maximumFootRecord,
      unitsAfterCuts: model.units.map((u) => u.visible),
    };
    window.__foundryWorstTurn = worstEnemy;
    view.renderer.render = draw;
    model.update(worstEnemy, -1);
    const center = model.units
      .filter((u) => u.visible)
      .reduce(
        (p, unit) => p.add(unit.position),
        model.units[0].position.clone().set(0, 0, 0),
      )
      .multiplyScalar(1 / model.units.filter((u) => u.visible).length);
    view.camera.position.copy(center).add({ x: 0.1, y: 29, z: 5 });
    view.camera.lookAt(center);
    view.renderer.render(view.scene, view.camera);
    window.__foundrySharpImage =
      view.renderer.domElement.toDataURL("image/png");
    window.__foundryFootImage = (index) => {
      for (const pose of worstFootPoses[index]) {
        pose.node.position.copy(pose.position);
        pose.node.quaternion.copy(pose.quaternion);
        pose.node.scale.copy(pose.scale);
        pose.node.visible = pose.visible;
      }
      model.syncBatches();
      const focus = model.root.position
        .clone()
        .fromArray(maximumFootRecord.before);
      focus
        .add(model.root.position.clone().fromArray(maximumFootRecord.after))
        .multiplyScalar(0.5);
      const foot = model.root.getObjectByName(maximumFootRecord.name);
      const unit = foot.parent.parent;
      const priorUnit = worstFootPoses[0].find((pose) => pose.node === unit);
      const offset = model.root.position
        .clone()
        .set(maximumFootRecord.name.includes("_LEG_L") ? -7 : 7, 4, 0.5)
        .applyQuaternion(priorUnit.quaternion);
      view.camera.position.copy(focus).add(offset);
      view.camera.lookAt(focus);
      view.renderer.render(view.scene, view.camera);
      return view.renderer.domElement.toDataURL("image/png");
    };
    return result;
  });
  console.log("shared-movement", JSON.stringify(movement));
  writeFileSync(`${output}/movement.json`, JSON.stringify(movement, null, 2));
  writeFileSync(
    `${output}/renderer-sharp-turn.png`,
    Buffer.from(
      (await page.evaluate(() => window.__foundrySharpImage)).split(",")[1],
      "base64",
    ),
  );
  for (const index of [0, 1])
    writeFileSync(
      `${output}/maximum-foot-${index}.png`,
      Buffer.from(
        (
          await page.evaluate(
            (index) => window.__foundryFootImage(index),
            index,
          )
        ).split(",")[1],
        "base64",
      ),
    );
  assert.ok(movement.samples > 500 && movement.maxSlip < 0.001);
  assert.ok(movement.maxVisualTurn <= 4 / 60 + 0.00001);
  assert.ok(
    movement.maxFootStep < 0.8,
    `Foot jumped ${movement.maxFootStep}m in one rendered frame`,
  );
  assert.equal(movement.unitsAfterCuts.filter(Boolean).length, 6);
  const cleanup = await page.evaluate(async () => {
    const { view, world, root } = window.__foundryRendererProof;
    view.render(null, "p", 1 / 60, 0, 0);
    const detached =
      !root.parent &&
      view.foundryWorms.size === 0 &&
      view.foundryWarnings.count === 0 &&
      view.foundryLasers.count === 0;
    world.run = "foundry-late";
    view.render(world, "p", 1 / 60, 0, 0);
    const pending = [...view.foundryWorms.values()][0].loading;
    view.render(null, "p", 1 / 60, 0, 0);
    await pending;
    return {
      detached,
      lateLoadDiscarded:
        view.foundryWorms.size === 0 &&
        !view.scene.children.some((n) =>
          n.getObjectByName("FOUNDRY_ZERO_ROOT"),
        ),
    };
  });
  assert.ok(cleanup.detached && cleanup.lateLoadDiscarded);
  await page.route("**/foundry_zero_mechanical_legs_v2.glb", (route) =>
    route.abort(),
  );
  const fallback = await page.evaluate(async () => {
    const { view, world } = window.__foundryRendererProof;
    world.run = "foundry-failure";
    const worm = world.enemies.find((e) => e.segments);
    worm.partHp = 100;
    worm.segments.forEach((n) => (n.partHp = 100));
    view.render(world, "p", 1 / 60, 0, 0);
    const state = view.foundryWorms.get(worm.id);
    await state.loading;
    view.render(world, "p", 1 / 60, 0, 0);
    const result = {
      error: !!state.error,
      noView: !state.view,
      bodies: view.bossBody.count,
      normalBosses: view.structures.get("boss").batch.parts[0].count,
    };
    view.render(null, "p", 1 / 60, 0, 0);
    return result;
  });
  assert.deepEqual(fallback, {
    error: true,
    noView: true,
    bodies: 7,
    normalBosses: 1,
  });
  const reportPage = await browser.newPage({
    viewport: { width: 844, height: 390 },
    serviceWorkers: "block",
  });
  reportPage.on("pageerror", (error) => errors.push(String(error)));
  await reportPage.goto(url);
  await reportPage.locator("#open-bestiary").click();
  await reportPage.locator('[data-enemy="boss"]').click();
  const normalText = await reportPage.locator(".enemy-description").innerText();
  assert.match(normalText, /PRISM/);
  assert.doesNotMatch(normalText, /残存節/);
  const response = reportPage.waitForResponse(
    (response) =>
      response.url().includes("foundry_zero_mechanical_legs_v2.glb") &&
      response.status() === 200,
  );
  await reportPage.locator('[data-worm="true"]').click();
  await (await response).finished();
  await reportPage.waitForTimeout(400);
  const wormText = await reportPage.locator(".enemy-description").innerText();
  assert.match(wormText, /レーザー/);
  assert.match(wormText, /残存節と同じ数/);
  assert.doesNotMatch(wormText, /PRISM|秒|m\/s|威力|攻略/);
  await reportPage.screenshot({ path: `${output}/report-mobile.png` });
  for (let i = 0; i < 4; i++) {
    await reportPage.locator('[data-worm="false"]').click();
    await reportPage.locator('[data-worm="true"]').click();
  }
  const retainedFocus = await reportPage
    .locator('[data-worm="true"]')
    .evaluate((node) => node === document.activeElement);
  await reportPage.locator("#report-close").click();
  await reportPage.locator("#open-bestiary").click();
  await reportPage.keyboard.press("Escape");
  assert.equal(await reportPage.getByRole("dialog").count(), 0);
  assert.ok(retainedFocus);
  const report = {
    formSpecificText: true,
    mobileViewport: [844, 390],
    repeatedSwitch: true,
    retainedFocus,
    closeReopen: true,
  };
  await reportPage.close();
  assert.deepEqual(errors, []);
  writeFileSync(
    `${output}/checks.json`,
    JSON.stringify(
      {
        gait,
        integration,
        movement,
        cleanup,
        fallback,
        report,
        errors,
        environment:
          "Chrome SwiftShader; rendering fixture, not mobile device performance",
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ pass: true, output, cleanup, fallback }));
} finally {
  await browser.close();
}
