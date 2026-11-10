import * as T from "three";
import {
  FoundryWormView,
  FOUNDRY_WORM_ASSET,
} from "../src/client/foundry-worm";
import { createWorld, addPlayer, spawn } from "../src/shared/game";
import { moveWorm, wormNodes } from "../src/shared/worm";
import { stepOmega, omegaPhase } from "../src/shared/catena-omega";
import { OmegaWarning } from "../src/client/catena-omega-warning";
import { enemySize } from "../src/shared/enemy-size";
import { Renderer } from "../src/client/render";
const renderer = new T.WebGLRenderer({
  antialias: true,
  preserveDrawingBuffer: true,
});
renderer.setSize(960, 540);
document.body.append(renderer.domElement);
const scene = new T.Scene();
scene.background = new T.Color(0x17222b);
scene.add(new T.HemisphereLight(0xf0f7ff, 0x36464b, 2));
const light = new T.DirectionalLight(0xffffff, 3);
light.position.set(5, 15, 9);
scene.add(light);
const floor = new T.Mesh(
  new T.PlaneGeometry(200, 200),
  new T.MeshStandardMaterial({ color: 0x34414b, roughness: 0.85 }),
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.002;
scene.add(floor);
scene.add(new T.GridHelper(200, 100, 0x556069, 0x3c4850));
const camera = new T.PerspectiveCamera(42, 960 / 540, 0.1, 300);
const view = await FoundryWormView.load(FOUNDRY_WORM_ASSET);
scene.add(view.root);
const w = createWorld("omega-preview", 11, 6);
const p = addPlayer(w, "viewer");
p.x = 100;
p.z = 100;
const e = spawn(w, "boss", 0, 0, "worm")!;
e.active = true;
w.training = true;
e.size = 0.8;
const baseline = new URLSearchParams(location.search).has("baseline");
if (baseline) e.segments = e.segments!.slice(0, 7);
// 見本の配置だけを直線にする。モデル・歩行・ジャンプは本番経路。
for (const [i, n] of wormNodes(e).entries())
  Object.assign(n, {
    x: 0,
    y: 0,
    z: (i - (wormNodes(e).length - 1) / 2) * 3.2 * enemySize(e) - 10,
    heading: Math.PI,
  });
e.omegaReadyAt = 1;
const warning = new OmegaWarning();
scene.add(warning.mesh);
const soldier = new T.Mesh(
  new T.CapsuleGeometry(0.4, 1, 4, 8),
  new T.MeshStandardMaterial({ color: 0x8be3ec }),
);
scene.add(soldier);
Object.assign(p, { x: 0, y: 0, z: -10, hp: 100 });
const game = new URLSearchParams(location.search).has("game")
  ? new Renderer(document.createElement("canvas"))
  : undefined;
if (game) {
  const until = performance.now() + 120000;
  while (!(game as any).foundryWorms.get(e.id)?.view) {
    game.render(w, p.id, 0, 0, 0, undefined, false, false, false, false);
    if (performance.now() > until) throw Error("本番描画の読込待ち期限");
    await new Promise((r) => setTimeout(r, 40));
  }
}
const film = document.createElement("canvas");
film.width = 960;
film.height = 540;
const ctx = film.getContext("2d")!;
let clock = 0;
(window as any).__omega = {
  view,
  w,
  e,
  async frame(t: number) {
    while (clock + 1e-6 < t) {
      const dt = Math.min(1 / 30, t - clock);
      clock += dt;
      w.time = clock;
      if (!baseline) stepOmega(w, e);
    }
    const nodes = wormNodes(e);
    const center = nodes.reduce((s, n) => s + n.x, 0) / nodes.length;
    camera.position.set(63, 19, -3);
    camera.lookAt(0, 5, -10);
    soldier.position.set(p.x, (p.y ?? 0) + 0.9, p.z);
    warning.update([e], clock);
    view.update(e, clock);
    renderer.render(scene, camera);
    if (game) {
      game.render(w, p.id, 1 / 15, 0, 0, undefined, true, false, false, false);
      game.renderer.setSize(960, 540);
      game.renderer.render(game.scene, camera);
    }
    ctx.drawImage(
      game?.renderer.domElement ?? renderer.domElement,
      0,
      0,
      960,
      540,
    );
    ctx.fillStyle = "rgba(0,0,0,.7)";
    ctx.fillRect(0, 0, 960, 68);
    ctx.fillStyle = "white";
    ctx.font = "18px sans-serif";
    const phase = omegaPhase(e, clock);
    const label =
      phase === "brace"
        ? "予備動作"
        : phase === "warn"
          ? "赤い着地予告"
          : phase === "flight"
            ? "Ωジャンプ"
            : p.hp < 100
              ? "着地攻撃・被弾1回"
              : "待機";
    ctx.fillText(
      `独立監査前候補 / 頭1＋胴${e.segments!.length} / ${label} / HP ${p.hp.toFixed(1)}`,
      18,
      27,
    );
    ctx.fillText(
      `${game ? "本番Renderer" : "実GLB描画アダプター"}・検証配置 / 固定15fps / 実機未確認 / ${t.toFixed(2)}秒`,
      18,
      53,
    );
    document.getElementById("status")!.textContent =
      `CATENA ローカル確認 / 頭1＋胴${e.segments!.length} / ${omegaPhase(e, clock) ?? "待機"} / HP ${p.hp.toFixed(0)} / ${t.toFixed(2)}秒`;
    return {
      png: film.toDataURL(),
      phase: omegaPhase(e, clock),
      hp: p.hp,
      pads: warning.mesh.count,
      nodes: nodes.map((n) => ({ x: n.x, y: n.y, z: n.z })),
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
    };
  },
};
await (window as any).__omega.frame(0);
