import type { Renderer } from "./render";
import type { World } from "../shared/game";
import { mapFor, stageFor } from "../shared/stages";
import { VIEW_MAPS } from "./map-assets";
import { loadStandardTrooper } from "./standard-trooper";
import { loadProgressionWeapons } from "./progression-weapons";
import { InstancedMesh, Vector4 } from "three";

// Background tabs can suspend animation frames. Keep preparation and its deadline alive.
const nextPreparationFrame = () =>
  new Promise<void>((resolve) => {
    let frame: number;
    const finish = () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      resolve();
    };
    const timer = setTimeout(finish, 80);
    frame = requestAnimationFrame(finish);
  });

/** Covers downloads, actor attachment and the first GPU compile, with one deadline. */
export async function prepareBattle(
  view: Renderer,
  world: World,
  id: string,
  cancelled: () => boolean,
  progress: (value: number) => void = () => {},
) {
  const began = performance.now();
  let pending = "素材";
  const check = () => {
    if (cancelled()) throw new Error("準備を中止しました");
    if (performance.now() - began > 60000)
      throw new Error(
        `読み込みに時間がかかっています（${pending}）。通信を確認して再試行してください。`,
      );
  };
  const wait = async (promise: Promise<unknown>) => {
    let settled = false,
      error: unknown;
    void promise.then(
      () => {
        settled = true;
      },
      (e) => {
        error = e;
        settled = true;
      },
    );
    while (!settled) {
      check();
      await new Promise((r) => setTimeout(r, 30));
    }
    check();
    if (error) throw error;
  };
  // Paint the loading screen before synchronous geometry/material work.
  await nextPreparationFrame();
  await nextPreparationFrame();
  check();
  progress(5);
  const prepareBastion =
    (world.front?.growthVersion === 3 && !world.defense) ||
    stageFor(world).waves.some((wave) => wave.troops.bastion);
  await wait(
    Promise.all([
      loadStandardTrooper(),
      ...(world.defense ? [view.defenseVisual.load()] : []),
      // 失敗しても簡易形状で戦えるため、BASTIONの読込は準備の失敗にしない。
      ...(prepareBastion ? [view.bastion.load()] : []),
      loadProgressionWeapons(world.players.flatMap((p) => p.weapons)),
    ]),
  );
  progress(35);
  await wait(Promise.all([...view.structures.values()].map((s) => s.loading)));
  for (const wave of stageFor(world).waves) {
    for (const kind of [
      ...Object.keys(wave.troops),
      ...(wave.bosses.length ? ["boss"] : []),
    ]) {
      const error = view.structures.get(kind as "crawler")?.error;
      if (error) throw new Error(error);
    }
  }
  progress(55);
  const mapIndex = VIEW_MAPS.indexOf(mapFor(world));
  // A failed daily map download must be retryable without spending participation.
  if (world.defense && view.mapAssets.status[mapIndex].state === "error")
    view.mapAssets.status[mapIndex] = { state: "idle", error: "" };
  while (true) {
    check();
    // Actor preparation must continue in background tabs, without drawing every frame.
    view.render(world, id, 0, 0, 0, undefined, false, false, false, false);
    view.mapAssets.select(mapIndex, true);
    const map = view.mapAssets.status[mapIndex],
      distant = view.mapAssets.distantStatus[mapIndex];
    const models = world.players.map((p) => view.players.get(p.id));
    pending =
      map.state !== "ready"
        ? "マップ"
        : !world.defense &&
            mapFor(world).biome !== "cave" &&
            distant.state !== "ready"
          ? "遠景"
          : `兵士 ${models.filter((m) => m?.userData.trooper).length}/${models.length}`;
    if (
      map.state === "error" ||
      distant.state === "error" ||
      models.some((m) => m?.userData.trooperError)
    )
      throw new Error(
        "マップまたは兵士を読み込めません。通信を確認して再試行してください。",
      );
    if (
      map.state === "ready" &&
      (world.defense ||
        mapFor(world).biome === "cave" ||
        distant.state === "ready") &&
      models.every((m) => m?.userData.trooper)
    )
      break;
    await nextPreparationFrame();
  }
  progress(85);
  pending = "描画の準備";
  await wait(view.renderer.compileAsync(view.scene, view.camera));
  // Three 0.185.1 defers uniform/attribute discovery to first use. Without
  // KHR_parallel_shader_compile, compileAsync may resolve before the driver
  // finishes linking; transparent two-sided variants also need both programs.
  // Finish this work behind the loading screen, preserving shader diagnostics.
  const programs = [...(view.renderer.info.programs ?? [])];
  for (let i = 0; i < programs.length; i++) {
    check();
    programs[i].getUniforms();
    progress(Math.round(85 + (8 * (i + 1)) / programs.length));
    await nextPreparationFrame();
  }
  check();
  // Some drivers defer GPU work until an actual draw, even after link/uniform
  // preparation. Draw one representative of each enemy/arrival behind loading,
  // then wait for its GPU fence without blocking the browser with gl.finish().
  // World, animation state, transforms and the normal viewport stay unchanged.
  const roots = [
    ...[...view.structures.values()].flatMap((s) =>
      s.batch ? [s.batch.group] : [],
    ),
    ...view.spawnEffects.preparationRoots,
    ...(prepareBastion ? view.bastion.preparationRoots : []),
  ];
  const visibility = roots.map((root) => [root, root.visible] as const);
  const viewport = view.renderer.getViewport(new Vector4());
  const scissor = view.renderer.getScissor(new Vector4());
  const scissorTest = view.renderer.getScissorTest();
  const warmCamera = view.camera.clone();
  warmCamera.position.set(0, 2, 7);
  warmCamera.lookAt(0, 1, 0);
  warmCamera.updateMatrixWorld();
  const gl = view.renderer.getContext();
  if (!("fenceSync" in gl))
    throw new Error("このブラウザーでは描画を準備できません。");
  // Warm one group at a time and yield between groups. A single large first
  // render can block message/ping handling long enough to disconnect a lobby.
  for (const [index, root] of roots.entries()) {
    check();
    const instances: [InstancedMesh, number, boolean][] = [];
    let fence: WebGLSync | null = null;
    try {
      for (const [other] of visibility) other.visible = false;
      root.visible = true;
      root.traverse((object) => {
        if (object instanceof InstancedMesh) {
          instances.push([object, object.count, object.frustumCulled]);
          object.count = Math.min(1, object.instanceMatrix.count);
          object.frustumCulled = false;
        }
      });
      view.renderer.setViewport(0, 0, 64, 64);
      view.renderer.setScissor(0, 0, 64, 64);
      view.renderer.setScissorTest(true);
      view.renderer.render(view.scene, warmCamera);
      fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      if (!fence) throw new Error("描画を準備できません。再試行してください。");
      gl.flush();
    } finally {
      for (const [object, count, culled] of instances) {
        object.count = count;
        object.frustumCulled = culled;
      }
      for (const [object, visible] of visibility) object.visible = visible;
      view.renderer.setViewport(viewport);
      view.renderer.setScissor(scissor);
      view.renderer.setScissorTest(scissorTest);
    }
    try {
      while (true) {
        check();
        const result = gl.clientWaitSync(fence, 0, 0);
        if (result === gl.WAIT_FAILED)
          throw new Error("描画を準備できません。再試行してください。");
        if (result !== gl.TIMEOUT_EXPIRED) break;
        await nextPreparationFrame();
      }
    } finally {
      gl.deleteSync(fence);
    }
    // Allow queued lobby states and input events to run even on a warm GPU.
    progress(Math.round(93 + (6 * (index + 1)) / roots.length));
    await nextPreparationFrame();
  }
  check();
  view.renderer.render(view.scene, view.camera);
  progress(100);
}
