import { Renderer } from "./render";
import { prepareBattle } from "./battle-loading";
import {
  addPlayer,
  createWorld,
  neutral,
  step,
  hurtPlayer,
  type Input,
} from "../shared/game";
import { STARTERS } from "../shared/defs";

// Local inspection entry only; excluded from production Vite inputs. No save access.
if (!import.meta.env.DEV) throw new Error("開発用の検証画面です");
const canvas = document.querySelector<HTMLCanvasElement>("#world")!;
const view = new Renderer(canvas);
const status = document.querySelector<HTMLElement>("#status")!;
const button = document.querySelector<HTMLButtonElement>("#record")!;
const focus = document.querySelector<HTMLSelectElement>("#focus")!;
const world = createWorld("soldier-motion-integration", 123);
for (let n = 0; n < 4; n++) {
  const p = addPlayer(world, `review-${n}`, [
    STARTERS[n % 3],
    STARTERS[(n + 1) % 3],
  ]);
  p.x = (n - 1.5) * 2.5;
}
// Keep the actual map, actor simulation and renderer; schedule no enemies in this scene.
world.phase = "battle";
world.wave = 1;
world.nextSpawn = 1e9;
const initial = structuredClone(world);
const output = document.createElement("canvas");
output.width = 960;
output.height = 540;
const ctx = output.getContext("2d")!;
const rollShotReview =
  new URLSearchParams(location.search).get("review") === "roll-shot";
const duration = rollShotReview ? 7.5 : 38;
const phases: ReadonlyArray<readonly [number, string]> = rollShotReview
  ? [
      [0, "待機"],
      [1, "左移動射撃"],
      [2.5, "右移動射撃"],
      [4, "前方ローリング"],
      [4.5, "回避後射撃"],
      [5.2, "回避の再使用待ち"],
      [6.5, "左ローリング"],
      [7.5, "終了"],
    ]
  : ([
      [0, "待機"],
      [2, "歩行"],
      [5, "走行"],
      [8, "停止→射撃"],
      [10, "射撃→装填"],
      [14, "移動射撃"],
      [16, "移動装填"],
      [20, "武器持ち替え"],
      [23, "元の武器へ"],
      [26, "回避"],
      [28, "後退・横移動"],
      [31, "ジャンプ"],
      [34, "被弾→転倒"],
      [38, "終了"],
    ] as const);
const samples: unknown[] = [];
const emissionSamples: unknown[] = [];
const renderSamples: unknown[] = [];
let running = false,
  accumulator = 0,
  fired = new Set<number>();
let frames = 0,
  sceneTime = 0;
let captureId = "";
const fps = 24;
async function store(name: string, body: Blob | string) {
  const response = await fetch(`/__soldier-proof/${captureId}/${name}`, {
    method: "POST",
    body,
  });
  if (!response.ok) throw new Error(`保存失敗 ${response.status}`);
}
function inputAt(t: number): Input {
  const i = neutral();
  i.cameraAim = false;
  if (rollShotReview) {
    i.mx =
      t >= 1 && t < 2.5 ? -0.6 : t >= 2.5 && t < 4 ? 0.6 : t >= 6.5 ? -1 : 0;
    i.mz = t >= 4 && t < 4.5 ? 1 : 0;
    i.fire = (t >= 1 && t < 4) || (t >= 4.5 && t < 5.2);
    for (const at of [4, 6.5])
      if (t >= at && !fired.has(at)) {
        i.dodge = true;
        fired.add(at);
      }
    return i;
  }
  if (t >= 2 && t < 5) i.mz = 0.35;
  if (t >= 5 && t < 8) i.mz = 1;
  if ((t >= 8 && t < 10) || (t >= 14 && t < 16)) i.fire = true;
  if (t >= 14 && t < 19) i.mx = 0.4;
  if (t >= 26 && t < 27) i.mz = 1;
  if (t >= 28 && t < 29.5) i.mz = -0.5;
  if (t >= 29.5 && t < 31) i.mx = -0.5;
  for (const [at, action] of [
    [10, "reload"],
    [16, "reload"],
    [20, "swap"],
    [23, "swap"],
    [26, "dodge"],
    [31, "jump"],
  ] as const) {
    if (t >= at && !fired.has(at)) {
      i[action] = true;
      fired.add(at);
    }
  }
  return i;
}
function draw(dt: number) {
  const focused = world.players[Number(focus.value)];
  view.render(
    { ...world, players: [focused] },
    focused.id,
    dt,
    0,
    0,
    undefined,
    running,
    false,
    true,
    false,
  );
  const p = focused;
  if (rollShotReview && running) {
    const body = view.players.get(p.id)?.position;
    renderSamples.push({
      t: sceneTime,
      evade: p.evade,
      lastEvent: view.lastEvent,
      events: world.events.map((e) => ({
        id: e.id,
        type: e.type,
        owner: e.owner,
      })),
      effects: view.combat.items.map((e) => ({
        kind: e.kind,
        anchored: !!e.shotAnchor,
        matching: e.shotAnchor === body,
      })),
      pose: view.players
        .get(p.id)
        ?.userData.trooper?.model.getObjectByName("Pelvis")
        ?.quaternion.toArray(),
    });
    if (body)
      for (const effect of view.combat.items) {
        if (effect.kind === "flash" && effect.shotAnchor === body) {
          emissionSamples.push({
            t: sceneTime,
            body: body.toArray(),
            origin: effect.mesh.position.toArray(),
            error: Math.hypot(
              effect.mesh.position.x - body.x,
              effect.mesh.position.y - body.y - 1.5,
              effect.mesh.position.z - body.z,
            ),
          });
        }
      }
  }
  view.camera.fov = 45;
  view.camera.position.set(p.x + 1.9, (p.y ?? 0) + 1.8, p.z - 2.9);
  view.camera.lookAt(p.x, (p.y ?? 0) + 1, p.z);
  view.camera.aspect = output.width / output.height;
  view.camera.updateProjectionMatrix();
  view.renderer.shadowMap.enabled = false;
  view.renderer.setPixelRatio(1);
  view.renderer.setSize(output.width, output.height, false);
  view.renderer.render(view.scene, view.camera);
  ctx.drawImage(canvas, 0, 0, output.width, output.height);
  ctx.fillStyle = "rgba(0,0,0,.8)";
  ctx.fillRect(0, 0, 1280, 64);
  ctx.fillStyle = "white";
  ctx.font = "22px sans-serif";
  const label =
    [...phases].reverse().find(([t]) => sceneTime >= t)?.[1] ?? "待機";
  ctx.fillText(
    `ゲーム処理の固定入力検証 / ${sceneTime.toFixed(2)}秒 / ${label}`,
    15,
    27,
  );
  ctx.font = "17px sans-serif";
  ctx.fillText(
    "選択した兵士のみ描画 / 敵なし・影なし / 保存データ変更なし",
    15,
    53,
  );
  status.textContent = `${sceneTime.toFixed(2)}秒 ${label}`;
}
button.onclick = async () => {
  button.disabled = true;
  focus.disabled = true;
  Object.assign(world, structuredClone(initial));
  // A replay rewinds event IDs; reset the renderer through its normal run boundary.
  view.render(null, "", 0, 0, 0, undefined, false, false, false, false);
  samples.length = 0;
  emissionSamples.length = 0;
  renderSamples.length = 0;
  fired = new Set();
  frames = 0;
  accumulator = 0;
  sceneTime = 0;
  captureId = `${focus.value}-${Date.now()}`;
  const player = world.players[Number(focus.value)];
  try {
    await prepareBattle(
      view,
      { ...world, players: [player] },
      player.id,
      () => false,
      (n) => {
        status.textContent = `選択した兵士の準備 ${n}%`;
      },
    );
    draw(0);
    running = true;
    queueFrame();
  } catch (e) {
    status.textContent = String(e);
    button.disabled = false;
    focus.disabled = false;
  }
};
await prepareBattle(
  view,
  world,
  "review-0",
  () => false,
  (n) => {
    status.textContent = `準備 ${n}%`;
  },
);
button.disabled = false;
view.renderer.setPixelRatio(1);
view.renderer.setSize(output.width, output.height, false);
const frameQueue = new MessageChannel();
frameQueue.port1.onmessage = () => {
  void frame();
};
function queueFrame() {
  frameQueue.port2.postMessage(null);
}
async function frame() {
  const dt = running ? 1 / fps : 0;
  if (running) {
    accumulator += dt;
    while (accumulator >= 0.05 && sceneTime < duration) {
      const input = inputAt(sceneTime);
      step(
        world,
        Object.fromEntries(world.players.map((p) => [p.id, { ...input }])),
        0.05,
      );
      if (!rollShotReview && sceneTime >= 34 && !fired.has(34)) {
        for (const p of world.players) hurtPlayer(world, p, 10000, true);
        fired.add(34);
      }
      sceneTime += 0.05;
      samples.push({
        t: sceneTime,
        worldTime: world.time,
        phase: world.phase,
        players: world.players.map((p) => ({
          id: p.id,
          x: p.x,
          z: p.z,
          y: p.y,
          hp: p.hp,
          slot: p.slot,
          ammo: [...p.ammo],
          reload: p.reload,
          evade: p.evade,
          swapCd: p.swapCd,
          accentSlot: p.accentSlot,
        })),
      });
      accumulator -= 0.05;
    }
  }
  draw(dt);
  if (running) {
    try {
      const data = atob(output.toDataURL("image/jpeg", 0.94).split(",")[1]);
      const jpg = new Blob([Uint8Array.from(data, (c) => c.charCodeAt(0))], {
        type: "image/jpeg",
      });
      await store(`${String(frames).padStart(4, "0")}.jpg`, jpg);
      frames++;
      if (frames >= duration * fps) {
        running = false;
        await store(
          "metrics.json",
          JSON.stringify({
            captureId,
            fps,
            frames,
            review: rollShotReview ? "roll-shot" : "full",
            scene: "固定入力の実ゲーム処理。24fps固定コマ保存。敵なし。",
            samples,
            emissionSamples,
            renderSamples,
          }),
        );
        status.textContent = `保存完了 ${captureId} / ${frames}コマ / 24fps`;
        button.disabled = false;
        focus.disabled = false;
        return;
      }
    } catch (e) {
      running = false;
      status.textContent = String(e);
      button.disabled = false;
      focus.disabled = false;
      return;
    }
  }
  if (running) queueFrame();
}
queueFrame();
