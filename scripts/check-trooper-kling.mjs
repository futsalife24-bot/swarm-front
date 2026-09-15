import { chromium } from "@playwright/test";
import fs from "node:fs";
import assert from "node:assert/strict";
const dir = "dist-validation/trooper-kling";
fs.mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=d3d11"],
});
try {
  const page = await browser.newPage({
      viewport: { width: 1200, height: 760 },
    }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(
    "http://127.0.0.1:5314/assets/blender/preview-trooper-kling/",
  );
  await page.waitForFunction(() => window.ready);
  const results = await page.evaluate(async () => {
    const T = await import("/node_modules/three/build/three.module.js");
    const { StandardTrooper } = await import("/src/client/standard-trooper.ts");
    const { createWorld, addPlayer } = await import("/src/shared/game.ts");
    const assets = designReview.panels[1].model.assets;
    const position = (t, n) =>
      t.model.getObjectByName(n).getWorldPosition(new T.Vector3());
    const report = { loops: [], runs: [] };
    const sampler = new StandardTrooper(assets);
    for (const name of ["Walk", "Run", "Walk_Rocket", "Run_Rocket"]) {
      sampler.sample(name, 0);
      const first = sampler.bones.map((b) => ({
        p: b.position.clone(),
        q: b.quaternion.clone(),
      }));
      sampler.sample(name, sampler.clips.get(name).duration);
      report.loops.push({
        name,
        position: Math.max(
          ...sampler.bones.map((b, i) => b.position.distanceTo(first[i].p)),
        ),
        rotation: Math.max(
          ...sampler.bones.map((b, i) => b.quaternion.angleTo(first[i].q)),
        ),
      });
    }
    sampler.dispose();
    for (const kind of ["rifle", "shotgun", "rocket"])
      for (const legacy of [true, false]) {
        const t = new StandardTrooper(
            legacy ? designReview.panels[0].model.assets : assets,
          ),
          parent = new T.Group();
        parent.add(t.model);
        const w = createWorld("kling", 7),
          p = addPlayer(w, "p");
        p.weapons[0].kind = kind;
        p.weapons[1].kind = kind === "rifle" ? "rocket" : "rifle";
        const r = {
          kind,
          legacy,
          maxGripError: 0,
          maxFootLockError: 0,
          maxFrameFootStep: 0,
          maxLengthChange: 0,
          finite: true,
          modes: [],
          minBottom: Infinity,
        };
        t.equip(p.weapons, 0);
        t.sample(
          "Weapon_Idle_" +
            { rifle: "Rifle", shotgun: "Shotgun", rocket: "Rocket" }[kind],
          0,
        );
        const expected = t.hand.matrixWorld
          .clone()
          .invert()
          .multiply(t.model.getObjectByName("Hand_L").matrixWorld);
        const expectedP = new T.Vector3().setFromMatrixPosition(expected);
        const lengths = t.feet.map((l) => [
          l.hip
            .getWorldPosition(new T.Vector3())
            .distanceTo(l.knee.getWorldPosition(new T.Vector3())),
          l.knee
            .getWorldPosition(new T.Vector3())
            .distanceTo(l.foot.getWorldPosition(new T.Vector3())),
        ]);
        let time = 0,
          lastFeet;
        const dt = 1 / 120;
        // Every required transition, followed by switch/fire/reload compatibility.
        const segments = [
          ["idle", 0, 0, 1],
          ["walk", 1.5, 0, 2],
          ["run", 7, 0, 2],
          ["walk", 1.5, 0, 1],
          ["walk-aim", 1.5, 1, 1],
          ["aim-walk", 1.5, 0, 1],
          ["idle", 0, 0, 1],
          ["aim", 0, 1, 1],
          ["idle", 0, 0, 1],
          ["run", 7, 0, 1],
          ["idle", 0, 0, 1],
        ];
        for (const [label, speed, aim, seconds] of segments) {
          for (let f = 0; f < seconds / dt; f++) {
            parent.position.z -= speed * dt;
            parent.updateMatrixWorld(true);
            time += dt;
            t.update(p, 0, time, "test", dt, parent.position, !!aim);
            const feet = t.feet.map((l) =>
              l.foot.getWorldPosition(new T.Vector3()),
            );
            if (lastFeet)
              r.maxFrameFootStep = Math.max(
                r.maxFrameFootStep,
                ...feet.map((v, i) => v.distanceTo(lastFeet[i])),
              );
            lastFeet = feet;
            if (t.lowerBlend === 1 && t.blend === 1) {
              const grip = new T.Vector3().setFromMatrixPosition(
                t.hand.matrixWorld
                  .clone()
                  .invert()
                  .multiply(t.model.getObjectByName("Hand_L").matrixWorld),
              );
              r.maxGripError = Math.max(
                r.maxGripError,
                grip.distanceTo(expectedP),
              );
            }
            t.feet.forEach((leg, i) => {
              const a = leg.hip.getWorldPosition(new T.Vector3()),
                b = leg.knee.getWorldPosition(new T.Vector3()),
                c = leg.foot.getWorldPosition(new T.Vector3()),
                q = leg.foot.getWorldQuaternion(new T.Quaternion());
              r.maxLengthChange = Math.max(
                r.maxLengthChange,
                Math.abs(a.distanceTo(b) - lengths[i][0]),
                Math.abs(b.distanceTo(c) - lengths[i][1]),
              );
              let bottom = Infinity,
                contact;
              for (const s of leg.sole) {
                const v = s.clone().applyQuaternion(q).add(c);
                if (v.y < bottom) {
                  bottom = v.y;
                  contact = v;
                }
              }
              r.minBottom = Math.min(r.minBottom, bottom);
              const lock = t.contactLocks[i];
              if (lock && lock.key !== "swing")
                r.maxFootLockError = Math.max(
                  r.maxFootLockError,
                  Math.hypot(
                    contact.x - lock.point.x,
                    contact.z - lock.point.z,
                  ),
                );
            });
            r.finite &&= t.bones.every((b) =>
              [...b.position.toArray(), ...b.quaternion.toArray()].every(
                Number.isFinite,
              ),
            );
          }
          r.modes.push({ label, mode: t.mode, lower: t.lowerMode });
        }
        r.attachments = [];
        for (const slot of [1, 0, 1, 0]) {
          p.slot = slot;
          for (let f = 0; f < 65; f++) {
            p.swapCd = Math.max(0, 0.5 - f * dt);
            time += dt;
            t.update(p, 0, time, "test", dt, parent.position);
          }
          r.attachments.push(t.weapons.map((w) => w.parent.name));
        }
        report.runs.push(r);
        t.dispose();
      }
    return report;
  });
  fs.writeFileSync(
    dir + "/runtime.json",
    JSON.stringify({ results, errors }, null, 2),
  );
  console.log(JSON.stringify({ results, errors }, null, 2));
  assert.deepEqual(errors, []);
  for (const r of results.loops) {
    assert.ok(r.position < 1e-5);
    assert.ok(r.rotation < 0.001);
  }
  for (const r of results.runs.filter((r) => !r.legacy)) {
    assert.ok(r.finite);
    assert.ok(r.maxLengthChange < 1e-4);
    assert.ok(r.maxFootLockError < 0.015, "foot lock " + r.kind);
    assert.ok(r.minBottom > -0.015, "floor " + r.kind);
    assert.ok(r.maxGripError < 0.025, "grip " + r.kind);
  }
  for (const kind of ["rifle", "shotgun", "rocket"])
    for (const view of ["back", "oblique", "far"])
      for (const pose of ["idle", "walk", "run", "aim"]) {
        await page.evaluate((v) => designReview.set(v), {
          kind,
          view,
          pose,
          time: pose === "aim" ? 0.55 : 0.12,
        });
        if (view === "far")
          await page.setViewportSize({ width: 844, height: 390 });
        else await page.setViewportSize({ width: 1200, height: 760 });
        await page.screenshot({ path: `${dir}/${kind}-${view}-${pose}.jpg` });
      }
} finally {
  await browser.close();
}
