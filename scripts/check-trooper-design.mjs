import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
try {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && m.text().includes("THREE."))
      errors.push(m.text());
  });
  await page.goto("http://127.0.0.1:5314/assets/blender/preview-trooper/");
  await page.waitForFunction(() => window.trooperQA);
  const result = await page.evaluate(async () => {
    const T = await import("/node_modules/three/build/three.module.js"),
      { GLTFLoader } =
        await import("/node_modules/three/examples/jsm/loaders/GLTFLoader.js"),
      { StandardTrooper } = await import("/src/client/standard-trooper.ts");
    const q = window.trooperQA,
      next = q.trooper,
      old = new StandardTrooper({
        ...next.assets,
        character: await new GLTFLoader().loadAsync(
          "/assets/characters/standard_trooper_sprint_v8.glb",
        ),
      });
    const p = (t, n) =>
        t.model.getObjectByName(n).getWorldPosition(new T.Vector3()),
      socketNames = [
        "Hand_L",
        "Hand_R",
        "RightHandWeaponSocket",
        "LeftHandSupportSocket",
        "BackWeaponSocket",
        "BackWeaponSocket_2",
      ];
    let maxSocketError = 0;
    const mixes = [];
    for (const profile of ["Rifle", "Shotgun", "Rocket"]) {
      const lower =
        profile === "Rocket" ? "Lower_Weapon_Idle_Rocket" : "Lower_Idle";
      for (const clip of [
        `Upper_Weapon_Idle_${profile}`,
        `Upper_Fire_${profile}`,
        `Upper_Reload_${profile}`,
        "Upper_Switch_1_to_2",
        "Upper_Switch_2_to_1",
      ]) {
        let maxError = 0;
        for (let f = 0; f <= 20; f++) {
          const at = (next.clips.get(clip).duration * f) / 20;
          next.sample(clip, at, lower, at % 3);
          old.sample(clip, at, lower, at % 3);
          for (const n of socketNames)
            maxError = Math.max(maxError, p(next, n).distanceTo(p(old, n)));
        }
        mixes.push({ profile, clip, maxError });
        maxSocketError = Math.max(maxSocketError, maxError);
      }
    }
    const stances = [];
    for (const profile of ["Rifle", "Shotgun", "Rocket"]) {
      let soleMin = Infinity,
        soleMax = -Infinity,
        maxWidthError = 0;
      const kind = profile.toLowerCase();
      next.equip(
        [
          { id: kind, kind },
          { id: "secondary", kind: "rifle" },
        ],
        0,
      );
      for (let f = 0; f <= 30; f++) {
        next.sample("Weapon_Idle_" + profile, f / 10);
        const left = p(next, "Foot_L"),
          right = p(next, "Foot_R");
        maxWidthError = Math.max(
          maxWidthError,
          Math.abs(right.x - left.x - (profile === "Rocket" ? 0.47 : 0.432)),
        );
        for (const foot of next.feet) {
          const rotation = foot.foot.getWorldQuaternion(new T.Quaternion()),
            target = p(next, foot.foot.name);
          const bottom = Math.min(
            ...foot.sole.map(
              (v) => v.clone().applyQuaternion(rotation).add(target).y,
            ),
          );
          soleMin = Math.min(soleMin, bottom);
          soleMax = Math.max(soleMax, bottom);
        }
      }
      const active = [];
      next.model.traverse((o) => {
        if (o.userData.loadoutVariant && o.visible)
          active.push(o.userData.loadoutVariant);
      });
      stances.push({
        profile,
        soleMin,
        soleMax,
        maxWidthError,
        rootVisible: next.model.visible,
        loadoutClass: next.model.userData.loadoutClass,
        active,
      });
    }
    // Authored switch, hit, reload and evade tracks remain intact on the real rig.
    let unchangedBoneError = 0;
    for (const name of [
      "Run",
      "Run_Backward",
      "Run_Rocket",
      "Hit_Heavy",
      "Dodge_Roll",
      "Switch_1_to_2",
      "Switch_2_to_1",
      "Reload_Rifle",
      "Reload_Shotgun",
      "Reload_Rocket",
    ])
      for (let f = 0; f <= 12; f++) {
        const time = (next.clips.get(name).duration * f) / 12;
        next.sample(name, time);
        old.sample(name, time);
        for (const b of next.bones)
          unchangedBoneError = Math.max(
            unchangedBoneError,
            p(next, b.name).distanceTo(p(old, b.name)),
          );
      }
    // Include transition state, repeated equipment changes and all four skin palettes.
    const { createWorld, addPlayer, start } =
        await import("/src/shared/game.ts"),
      { STARTERS } = await import("/src/shared/defs.ts");
    const w = createWorld("design-qa", 19),
      player = addPlayer(w, "qa");
    start(w);
    player.x = player.z = 0;
    let finite = true;
    const modes = new Set(),
      visibleClasses = new Set();
    let time = 0;
    for (const kind of ["rocket", "rifle", "shotgun", "rocket", "rifle"]) {
      player.weapons = [
        { ...STARTERS.find((v) => v.kind === kind), id: "a-" + kind },
        { ...STARTERS[0], id: "b" },
      ];
      player.slot = 0;
      player.hp = 100;
      player.evade = player.reload = player.swapCd = 0;
      for (let f = 0; f < 90; f++) {
        if (f < 20) player.z -= 0.04;
        if (f === 25) player.cool = 0.2;
        else player.cool = Math.max(0, player.cool - 1 / 60);
        player.evade = f >= 35 && f < 55 ? (55 - f) / 60 : 0;
        player.heavyHit = f >= 60 && f < 75 ? (75 - f) / 60 : 0;
        next.update(player, 0, (time += 1 / 60), "design", 1 / 60);
        modes.add(next.mode);
        visibleClasses.add(next.model.userData.loadoutClass);
        next.bones.forEach((b) => {
          finite &&= b.matrixWorld.elements.every(Number.isFinite);
        });
        finite &&= next.model.visible;
      }
    }
    for (const skin of ["standard", "desert", "arctic", "special", "standard"])
      next.setSkin(skin);
    next.equip(
      [
        { id: "qa1", kind: "rifle" },
        { id: "qa2", kind: "rifle" },
      ],
      0,
    );
    next.sample("Weapon_Idle_Rifle", 0);
    q.renderer.render(q.scene, q.camera);
    const meshes = [];
    next.model.traverse((o) => {
      if (o.isSkinnedMesh && o.visible)
        meshes.push({
          name: o.name,
          material: o.material.name,
          triangles: o.geometry.index.count / 3,
        });
    });
    const budget = {
      uniformDraws: meshes.length,
      uniformTriangles: meshes.reduce((n, m) => n + m.triangles, 0),
      sceneDraws: q.renderer.info.render.calls,
    };
    old.dispose();
    return {
      maxSocketError,
      mixes,
      stances,
      unchangedBoneError,
      finite,
      modes: [...modes],
      visibleClasses: [...visibleClasses],
      budget,
      meshes,
    };
  });
  writeFileSync(
    "dist-validation/trooper-design/runtime-checks.json",
    JSON.stringify({ result, errors }, null, 2),
  );
  console.log(
    JSON.stringify(
      {
        maxSocketError: result.maxSocketError,
        unchangedBoneError: result.unchangedBoneError,
        stances: result.stances,
        budget: result.budget,
        errors,
      },
      null,
      2,
    ),
  );
  assert.ok(
    result.maxSocketError < 0.00001,
    "mixed upper-body weapons preserve baseline world transforms",
  );
  assert.ok(result.unchangedBoneError < 0.00001);
  assert.ok(
    result.stances.every(
      (s) =>
        s.soleMin > -0.003 &&
        s.soleMax < 0.008 &&
        s.maxWidthError < 0.0001 &&
        s.rootVisible,
    ),
  );
  assert.ok(result.finite);
  assert.equal(result.visibleClasses.length, 3);
  assert.ok(result.budget.uniformDraws <= 12, "shared uniform draw budget");
  assert.deepEqual(errors, []);
  console.log(
    "PASS: mixed clips, planted stance, sockets, class switching, animation and draw budget",
  );
} finally {
  await browser.close();
}
