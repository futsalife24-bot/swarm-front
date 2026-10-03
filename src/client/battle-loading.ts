import type { Renderer } from "./render";
import type { World } from "../shared/game";
import { mapFor, stageFor } from "../shared/stages";
import { VIEW_MAPS } from "./map-assets";
import { loadStandardTrooper } from "./standard-trooper";
import { loadProgressionWeapons } from "./progression-weapons";

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
  await wait(
    Promise.all([
      loadStandardTrooper(),
      ...(world.defense ? [view.defenseVisual.load()] : []),
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
  check();
  view.renderer.render(view.scene, view.camera);
  progress(100);
}
