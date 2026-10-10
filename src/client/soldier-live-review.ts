import * as T from "three";
import type { Renderer } from "./render";
import type { Controls } from "./input";
import type { World } from "../shared/game";
export interface LiveReview {
  beforeFrame(world: World | null, id: string, active: boolean): void;
  capture(world: World, id: string): void;
}
/** Development-only observer and ordinary Controls input sequence. Never edits World or saves. */
export function attachLiveReview(
  view: Renderer,
  controls: Controls,
): LiveReview {
  const panel = document.createElement("aside");
  panel.style.cssText =
    "position:fixed;bottom:8px;left:30%;z-index:9999;background:#132733;color:white;padding:8px;font:14px sans-serif;pointer-events:auto";
  panel.innerHTML =
    '<button type="button">次の戦闘で10秒記録</button> <span>開発用・通常の敵あり・入力を自動操作</span>';
  document.body.append(panel);
  const button = panel.querySelector("button")!,
    status = panel.querySelector("span")!;
  const output = document.createElement("canvas");
  output.width = 1280;
  output.height = 720;
  const ctx = output.getContext("2d")!;
  const close = new T.WebGLRenderer({
    antialias: true,
    preserveDrawingBuffer: true,
  });
  close.setPixelRatio(1);
  close.setSize(640, 720, false);
  close.shadowMap.enabled = false;
  close.outputColorSpace = view.renderer.outputColorSpace;
  close.toneMapping = view.renderer.toneMapping;
  close.toneMappingExposure = view.renderer.toneMappingExposure;
  const camera = new T.PerspectiveCamera(35, 640 / 720, 0.1, 80);
  let armed = false,
    running = false,
    start = 0,
    began = 0,
    stamp = "",
    frames = 0;
  let recorder: MediaRecorder | undefined,
    chunks: Blob[] = [],
    samples: unknown[] = [],
    fired = new Set<number>();
  const reset = () => {
    controls.keys.clear();
    controls.input.fire = false;
    controls.input.mx = controls.input.mz = 0;
  };
  const save = async (name: string, body: Blob | string) => {
    const r = await fetch(`/__soldier-proof/play-${stamp}/${name}`, {
      method: "POST",
      body,
    });
    if (!r.ok) throw new Error(`保存失敗 ${r.status}`);
  };
  const finish = (reason: string) => {
    if (!running) return;
    running = false;
    reset();
    status.textContent = `保存中（${reason}）`;
    recorder?.stop();
    document.querySelector<HTMLButtonElement>("#pause")?.click();
  };
  button.onclick = () => {
    if (running) {
      finish("手動終了");
      return;
    }
    armed = !armed;
    button.textContent = armed ? "予約を解除" : "次の戦闘で10秒記録";
    status.textContent = armed ? "通常戦闘の開始待ち" : "待機";
  };
  return {
    beforeFrame(world, id, active) {
      const p = world?.players.find((p) => p.id === id);
      if (armed && active && world && p && p.hp > 0) {
        armed = false;
        running = true;
        start = world.time;
        began = performance.now();
        stamp = String(Date.now());
        frames = 0;
        samples = [];
        chunks = [];
        fired = new Set();
        const mimeType = ["video/webm;codecs=vp8", "video/webm"].find((t) =>
          MediaRecorder.isTypeSupported(t),
        );
        recorder = new MediaRecorder(
          output.captureStream(30),
          mimeType ? { mimeType, videoBitsPerSecond: 5000000 } : {},
        );
        recorder.ondataavailable = (e) => {
          if (e.data.size) chunks.push(e.data);
        };
        recorder.onstop = () => {
          void (async () => {
            try {
              await save(
                "capture.webm",
                new Blob(chunks, { type: recorder!.mimeType }),
              );
              await save(
                "metrics.json",
                JSON.stringify({
                  scene:
                    "通常ソロ戦闘・通常敵あり。Controlsの入力を自動操作。ゲーム状態/体力/敵/保存の変更なし。左=通常画面、右=同じ姿勢の手元拡大（背景/影なし）。実時間MediaRecorder。",
                  stamp,
                  seconds: (performance.now() - began) / 1000,
                  frames,
                  samples,
                }),
              );
              status.textContent = `保存完了 play-${stamp} / ${frames}描画`;
            } catch (e) {
              status.textContent = String(e);
            }
            recorder!.stream.getTracks().forEach((t) => t.stop());
            button.textContent = "次の戦闘で10秒記録";
          })();
        };
        recorder.start();
        button.textContent = "記録を終了";
      }
      if (!running || !world || !p) return;
      if (p.hp <= 0 || performance.now() - began > 120000) {
        finish(p.hp <= 0 ? "戦闘不能" : "時間上限");
        return;
      }
      if (!active) {
        reset();
        return;
      }
      view.renderer.setPixelRatio(1);
      view.renderer.setSize(
        960,
        Math.round((960 * innerHeight) / innerWidth),
        false,
      );
      const t = world.time - start;
      if (t >= 10) {
        finish("10秒完了");
        return;
      }
      reset();
      const move =
        t < 1
          ? "KeyW"
          : t < 2
            ? "KeyS"
            : t < 3.2
              ? "KeyA"
              : t < 6.5
                ? "KeyD"
                : t < 6.7
                  ? "KeyW"
                  : t < 7.5
                    ? "KeyD"
                    : t < 9
                      ? "KeyS"
                      : "KeyA";
      controls.keys.add(move);
      controls.input.fire =
        t < 2.3 ||
        (t >= 4 && t < 5) ||
        (t >= 6.5 && t < 6.7) ||
        (t >= 7.1 && t < 7.5) ||
        t >= 9;
      for (const [at, key] of [
        [2.3, "reload"],
        [3.2, "swap"],
        [5, "reload"],
        [5.7, "swap"],
        [6.7, "dodge"],
        [7.5, "reload"],
        [8.2, "swap"],
      ] as const) {
        if (t >= at && !fired.has(at)) {
          controls.queued.add(key);
          fired.add(at);
        }
      }
      status.textContent = `通常戦闘を記録 ${t.toFixed(2)}秒`;
    },
    capture(world, id) {
      if (!running) return;
      const p = world.players.find((p) => p.id === id);
      if (!p) return;
      ctx.fillStyle = "#132733";
      ctx.fillRect(0, 0, 1280, 720);
      ctx.drawImage(
        view.renderer.domElement,
        0,
        100,
        640,
        (640 * view.renderer.domElement.height) /
          view.renderer.domElement.width,
      );
      const model = view.players.get(id);
      if (model) {
        camera.position.set(
          model.position.x + 1.25,
          model.position.y + 1.65,
          model.position.z - 2.0,
        );
        camera.lookAt(
          model.position.x,
          model.position.y + 1.15,
          model.position.z,
        );
        // Draw the exact same actor matrices, with only lights in the magnifier.
        const visibility = view.scene.children.map(
          (o) => [o, o.visible] as const,
        );
        for (const [o] of visibility) {
          if (o !== model && !(o as T.Light).isLight) o.visible = false;
        }
        try {
          close.render(view.scene, camera);
        } finally {
          for (const [o, visible] of visibility) o.visible = visible;
        }
        ctx.drawImage(close.domElement, 640, 0, 640, 720);
      }
      ctx.fillStyle = "rgba(0,0,0,.85)";
      ctx.fillRect(0, 0, 1280, 64);
      ctx.fillStyle = "white";
      ctx.font = "18px sans-serif";
      ctx.fillText(
        `通常ソロ・敵あり / 入力自動操作 / ${(world.time - start).toFixed(2)}秒 / ${p.weapons[p.slot].kind} / HP ${p.hp}`,
        12,
        26,
      );
      ctx.fillText(
        "左＝通常カメラ / 右＝同じゲーム姿勢の手元拡大（背景/影なし）",
        12,
        52,
      );
      frames++;
      samples.push({
        wall: (performance.now() - began) / 1000,
        t: world.time - start,
        hp: p.hp,
        x: p.x,
        z: p.z,
        weapon: p.weapons[p.slot].kind,
        slot: p.slot,
        ammo: [...p.ammo],
        reload: p.reload,
        evade: p.evade,
        swapCd: p.swapCd,
        enemies: world.enemies.length,
        keys: [...controls.keys],
        fire: controls.input.fire,
        pose: model?.userData.trooper?.mode,
        motionVersion:
          model?.userData.trooper?.model.userData.trooperMotionVersion,
        combat: model?.userData.trooper?.combat,
        shotTime: model?.userData.trooper?.shotTime,
        aimProgress: model?.userData.trooper?.aimProgress,
      });
    },
  };
}
