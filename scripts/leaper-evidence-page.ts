// Browser half of scripts/check-leaper-grown.mjs (served by Vite so bare imports resolve).
import * as T from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { loadEnemyMotion } from "../src/client/hound-motion";
import { Renderer } from "../src/client/render";
import { prepareBattle } from "../src/client/battle-loading";
import * as g from "../src/shared/game";

/** The game's own loader + skinned vertices for every baked clip. */
export async function inspectLoader() {
  const asset = await loadEnemyMotion("leaper");
  const v2 = await new GLTFLoader().loadAsync(
    "/assets/enemies/leaper_motion_v2.glb",
  );
  let v2Bones: string[] = [];
  v2.scene.traverse((o) => {
    if (o instanceof T.SkinnedMesh && !v2Bones.length)
      v2Bones = o.skeleton.bones.map((b) => b.name);
  });
  const meshes: T.SkinnedMesh[] = [];
  asset.model.traverse((o) => {
    if (o instanceof T.SkinnedMesh) meshes.push(o);
  });
  const mixer = new T.AnimationMixer(asset.model);
  const v = new T.Vector3();
  const points = () => {
    asset.model.updateMatrixWorld(true);
    const all: number[] = [];
    for (const m of meshes) {
      m.skeleton.update();
      const pos = m.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        m.getVertexPosition(i, v);
        v.applyMatrix4(m.matrixWorld);
        all.push(v.x, v.y, v.z);
      }
    }
    return all;
  };
  const clips: Record<string, Record<string, number>> = {};
  for (const clip of asset.clips) {
    mixer.stopAllAction();
    const action = mixer.clipAction(clip);
    action.reset().setLoop(T.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.play();
    mixer.setTime(0);
    const first = points();
    let last = first,
      minY = Infinity,
      maxY = -Infinity,
      nonFinite = 0,
      maxMove = 0,
      startMinY = Infinity,
      endMinY = Infinity;
    const steps = Math.round(clip.duration * 30);
    for (let f = 0; f <= steps; f++) {
      mixer.setTime((f / steps) * clip.duration);
      const p = points();
      for (let i = 0; i < p.length; i += 3) {
        if (!Number.isFinite(p[i] + p[i + 1] + p[i + 2])) nonFinite++;
        minY = Math.min(minY, p[i + 1]);
        if (f === 0) startMinY = Math.min(startMinY, p[i + 1]);
        if (f === steps) endMinY = Math.min(endMinY, p[i + 1]);
        maxY = Math.max(maxY, p[i + 1]);
        maxMove = Math.max(
          maxMove,
          Math.hypot(p[i] - first[i], p[i + 1] - first[i + 1], p[i + 2] - first[i + 2]),
        );
      }
      last = p;
    }
    let loopSeam = 0;
    for (let i = 0; i < first.length; i += 3)
      loopSeam = Math.max(
        loopSeam,
        Math.hypot(last[i] - first[i], last[i + 1] - first[i + 1], last[i + 2] - first[i + 2]),
      );
    clips[clip.name] = {
      duration: clip.duration,
      samples: steps + 1,
      minY,
      maxY,
      startMinY,
      endMinY,
      nonFinite,
      maxMove,
      loopSeam,
    };
  }
  mixer.stopAllAction();
  return {
    meshes: meshes.length,
    bones: asset.bones,
    vertices: meshes.reduce((n, m) => n + m.geometry.attributes.position.count, 0),
    boneNamesEqualV2:
      JSON.stringify(meshes[0].skeleton.bones.map((b) => b.name)) ===
      JSON.stringify(v2Bones),
    sameBinding: meshes.every(
      (m) =>
        m.bindMatrix.equals(meshes[0].bindMatrix) &&
        m.matrixWorld.equals(meshes[0].matrixWorld),
    ),
    ranges: asset.ranges,
    clips,
  };
}

type Scene = Awaited<ReturnType<typeof setupScene>>;
let scene: Scene | undefined;
const log: Record<string, unknown>[] = [];

/** Real Renderer with one VOLLEY (reference) and one LEAPER facing the player. */
export async function setupScene() {
  document.body.innerHTML = '<canvas id="world"></canvas><div id="damage"></div>';
  const view = new Renderer(document.getElementById("world") as HTMLCanvasElement);
  const w = g.createWorld("leaper-evidence", 42, 1);
  const p = g.addPlayer(w, "p");
  p.x = 0;
  p.z = 0;
  w.phase = "battle";
  g.spawn(w, "ant", 0, -4.6);
  g.spawn(w, "spider", 0, 4.6);
  for (const e of w.enemies) e.targetId = p.id;
  const [ant, spider] = w.enemies;
  ant.x = 0;
  ant.z = -4.6;
  spider.x = 0;
  spider.z = 4.6;
  await prepareBattle(view, w, "p", () => false);
  const controller = view.structures.get("spider")!.controller;
  scene = { view, w, spider, controller };
  return scene;
}

const DT = 1 / 30;
/** Advance `frames` real-time frames of one visual phase; logs the LEAPER controller state. */
export async function runPhase(phase: string, start: number, frames: number, total: number) {
  const { view, w, spider, controller } = scene!;
  for (let f = start; f < start + frames; f++) {
    const u = f / total;
    spider.wind = 0;
    spider.jump = 0;
    if (phase === "windup") spider.wind = 0.45 * (1 - u) + 1e-4;
    if (phase === "impact") spider.cool = f === 0 ? 1.2 : Math.max(0, spider.cool - DT);
    if (phase === "leap") {
      spider.jump = 0.001 + 0.9 * u;
      spider.y = Math.sin(Math.PI * u) * 3.5;
    } else spider.y = 0;
    if (phase === "run") spider.x += 0.05;
    w.time += DT;
    view.render(w, "p", DT, 0, 0, undefined, true);
    const s = controller.states.get(spider.id)!;
    log.push({
      phase,
      frame: f,
      clip: s.clip,
      time: +s.time.toFixed(4),
      from: s.from,
      blend: +s.blend.toFixed(4),
    });
    await new Promise((r) => setTimeout(r, 1000 / 30));
  }
}
export const sequenceLog = () => log;
