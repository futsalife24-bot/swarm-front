// Appended into the production app's lexical scope by the local recording
// server only. It calls the real encounter(), dialog, camera and persistence
// boundary with a temporary TEST DATA profile; it never unlocks developer mode.
if (
  location.hostname === "127.0.0.1" &&
  location.port === "5200" &&
  new URLSearchParams(location.search).get("harrow-contact-test") === "1"
) {
  const fixturePanel = document.createElement("aside");
  fixturePanel.id = "harrow-live-fixture";
  fixturePanel.style.cssText =
    "position:fixed;top:12px;right:12px;z-index:9999;background:#08131df5;color:white;padding:12px;max-width:440px;font:14px sans-serif";
  fixturePanel.innerHTML =
    '<button id="harrow-live-start">地面向きカメラでHARROW初回会敵</button><button id="harrow-live-report" hidden>HARROWの会敵ムービーを確認</button><pre id="harrow-live-status" style="white-space:pre-wrap">ローカルTEST DATAのみ。通常保存・認証を変更しません。</pre>';
  document.body.append(fixturePanel);
  const fixtureStatus = fixturePanel.querySelector("#harrow-live-status");
  const fixtureStart = fixturePanel.querySelector("#harrow-live-start");
  const fixtureReport = fixturePanel.querySelector("#harrow-live-report");
  fixtureStart.onclick = async () => {
    fixtureStart.disabled = true;
    try {
      const progress = await import("/src/client/progression-save.ts");
      const { spawn } = await import("/src/shared/game.ts");
      const { supportHeight } = await import("/src/shared/terrain.ts");
      const { VIEW_MAPS } = await import("/src/client/map-assets.ts");
      const normalKey = progress.newSaveKey("normal"),
        testKey = progress.newSaveKey("test");
      const normalBefore = localStorage.getItem(normalKey),
        testBefore = localStorage.getItem(testKey);
      const restore = () => {
        if (testBefore === null) localStorage.removeItem(testKey);
        else localStorage.setItem(testKey, testBefore);
      };
      window.addEventListener("pagehide", restore, { once: true });
      for (const dialog of document.querySelectorAll("dialog[open]"))
        dialog.close();
      mode = "test";
      save = progress.freshProgress("test");
      world = createWorld("harrow-live-contact", 1, 20);
      initSolo(world, 20, "normal", true, progress.blankLevels());
      world.phase = "battle";
      world.nextSpawn = 1e9;
      world.spawned = 9999;
      const actor = addPlayer(world, "solo");
      Object.assign(actor, { x: 0, z: 24, hp: 160 });
      actor.y = supportHeight(actor.x, actor.z, mapFor(world).blocks);
      const enemy = spawn(world, "harrow", 0, 0);
      Object.assign(enemy, { heading: 0, cool: 999 });
      paused = true;
      battleUI();
      controls.input.yaw = 0;
      controls.input.pitch = -0.35;
      const loadingStart = performance.now();
      const mapIndex = VIEW_MAPS.indexOf(mapFor(world));
      while (
        !view.structures.get("harrow")?.batch ||
        view.mapAssets.status[mapIndex]?.state !== "ready" ||
        view.mapAssets.distantStatus[mapIndex]?.state !== "ready"
      ) {
        view.render(world, "solo", 0, 0, -0.35, undefined, false, false);
        if (performance.now() - loadingStart > 90000)
          throw Error("HARROW load timeout");
        fixtureStatus.textContent = "HARROWと実戦描画を準備中…";
        await new Promise(requestAnimationFrame);
      }
      for (let frame = 0; frame < 40; frame++)
        view.render(world, "solo", 0.1, 0, -0.35, undefined, true, false);
      const projected = new T.Vector3(enemy.x, eye(enemy), enemy.z).project(
        view.camera,
      );
      const frozen = JSON.stringify(world);
      encounter();
      const intro = document.querySelector('.pt-cutscene[data-enemy="harrow"]');
      if (!intro || !encounterActive)
        throw Error("The production encounter did not start");
      fixturePanel.hidden = true;
      intro.addEventListener(
        "close",
        () => {
          restore();
          window.removeEventListener("pagehide", restore);
          fixturePanel.hidden = false;
          fixtureStart.disabled = false;
          fixtureReport.hidden = false;
          fixtureStatus.textContent = JSON.stringify(
            {
              introduced: true,
              wasOffscreen: Math.abs(projected.y) > 1,
              projected: projected.toArray(),
              worldFrozen: JSON.stringify(world) === frozen,
              normalSaveUnchanged:
                localStorage.getItem(normalKey) === normalBefore,
              testSaveRestored: localStorage.getItem(testKey) === testBefore,
              encounterRecorded: save.encounters.harrow === "solo",
              height: enemy.y,
              size: enemy.size,
              combatPaused: paused,
            },
            null,
            2,
          );
        },
        { once: true },
      );
    } catch (error) {
      fixturePanel.hidden = false;
      fixtureStart.disabled = false;
      fixtureStatus.textContent = String(error);
    }
  };
  fixtureReport.onclick = () => report();
}
