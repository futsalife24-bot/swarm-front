// 旧保存の接地補正を本番Rendererで撮影する。人の実機プレイとは区別する。
import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
const out = "dist-validation/catena-omega/p1-fixed";
const snapshot = JSON.parse(
  readFileSync(
    "docs/evidence/catena-omega-20261021/st10-followup/candidate-814-0-snapshot.json",
    "utf8",
  ),
);
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("http://127.0.0.1:5197/scripts/catena-omega-preview.html", {
    timeout: 120000,
  });
  await page.waitForFunction(() => window.__omega, null, { timeout: 120000 });
  const rows = [];
  for (const corrected of [false, true]) {
    rows.push(
      await page.evaluate(
        async ({ snapshot, corrected }) => {
          const { Renderer } = await import("/src/client/render.ts");
          const { step, neutral } = await import("/src/shared/game.ts");
          const { groundHeight } = await import("/src/shared/terrain.ts");
          const { CAVE_BLOCKS, caveClearance, caveCeiling } =
            await import("/src/shared/cave.ts");
          const T = await import("/node_modules/.vite/deps/three.js");
          const w = structuredClone(snapshot);
          if (corrected) for (let i = 0; i < 20; i++) step(w, { p: neutral() });
          // 保存当時のHUD通知だけを除く。敵の姿勢・地形・HPはそのまま描画する。
          w.events = [];
          const e = w.enemies.find((e) => e.id === 97);
          const canvas = document.createElement("canvas");
          canvas.style.cssText = "position:fixed;inset:0";
          const r = new Renderer(canvas);
          document.body.replaceChildren(canvas);
          r.render(w, "p", 0, 0, 0, undefined, true);
          await r.structures.get("crawler").loading;
          const until = performance.now() + 120000;
          while (r.mapAssets.status[5].state === "loading") {
            if (performance.now() > until) throw Error("洞窟モデル読込期限");
            await new Promise((resolve) => setTimeout(resolve, 40));
          }
          r.render(w, "p", 0, 0, 0, undefined, true);
          r.renderer.setSize(960, 540);
          const g = groundHeight(e.x, e.z, CAVE_BLOCKS);
          const camera = new T.PerspectiveCamera(46, 960 / 540, 0.05, 80);
          // 洞窟壁の中から撮らないよう、視線全体の空間が最も広い方角を選ぶ。
          const options = Array.from({ length: 32 }, (_, i) => {
            const a = (i * Math.PI) / 16,
              dx = Math.cos(a) * 4,
              dz = Math.sin(a) * 4;
            return {
              dx,
              dz,
              space: Math.min(
                ...[0.2, 0.4, 0.6, 0.8, 1].map((t) =>
                  caveClearance(e.x + dx * t, e.z + dz * t),
                ),
              ),
            };
          }).sort((a, b) => b.space - a.space);
          const { dx, dz } = options[0];
          camera.position.set(
            e.x + dx,
            Math.min(g + 2.5, caveCeiling(e.x + dx, e.z + dz) - 0.5),
            e.z + dz,
          );
          camera.lookAt(e.x, g + 0.55, e.z);
          r.scene.fog = null;
          const lamp = new T.PointLight(0xffffff, 8, 15);
          lamp.position.copy(camera.position);
          r.scene.add(lamp);
          // 重なった隊員の描画だけを隠し、PLEATと地表を視認する。
          for (const model of r.players.values()) model.visible = false;
          r.renderer.render(r.scene, camera);
          const caption = document.createElement("div");
          caption.style.cssText =
            "position:fixed;top:8px;left:12px;color:white;background:#000c;padding:8px;font:16px sans-serif";
          caption.textContent = `${corrected ? "修正後・旧保存から20tick" : "修正前の旧保存姿勢"} / 本番Renderer・洞窟・実PLEAT / 隊員非表示・検証視点・実機未確認`;
          document.body.append(caption);
          return {
            corrected,
            ground: g,
            anchor: e.pleat.anchor,
            body: e.pleat.body,
            modelError: r.structures.get("crawler").error,
            mapStatus: r.mapAssets.status[5],
            calls: r.renderer.info.render.calls,
          };
        },
        { snapshot, corrected },
      ),
    );
    await page.screenshot({
      path: `${out}/cave-${corrected ? "fixed" : "old-save"}.png`,
    });
  }
  assert.equal(errors.length, 0);
  assert.ok(Math.abs(rows[1].ground - rows[1].anchor.y) < 0.01);
  assert.ok(rows[1].body.y > rows[1].ground);
  for (const row of rows) assert.ok(!row.modelError);
  writeFileSync(
    `${out}/render-cave.json`,
    JSON.stringify(
      {
        rows,
        errors,
        conditions:
          "旧保存姿勢と修正後20tick。描画は本番Renderer、視点と照明だけ検証用。実機・人操作・ネットワークではない。",
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ rows, errors }));
} finally {
  await browser.close();
}
