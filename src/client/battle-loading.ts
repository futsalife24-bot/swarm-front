import type { Renderer } from "./render";
import type { World } from "../shared/game";
import { MAPS, stageFor } from "../shared/stages";
import { loadStandardTrooper } from "./standard-trooper";
import { loadProgressionWeapons } from "./progression-weapons";

/** Covers downloads, actor attachment and the first GPU compile, with one deadline. */
export async function prepareBattle(
  view: Renderer,
  world: World,
  id: string,
  cancelled: () => boolean,
  progress: (value: number) => void = () => {},
) {
  const began = performance.now();
  const check = () => {
    if (cancelled()) throw new Error("準備を中止しました");
    if (performance.now() - began > 60000)
      throw new Error(
        "読み込みに時間がかかっています。通信を確認して再試行してください。",
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
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
  check();
  progress(5);
  await wait(
    Promise.all([
      loadStandardTrooper(),
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
  const mapIndex = stageFor(world).map + (world.defense ? MAPS.length + 1 : 0);
  while (true) {
    check();
    view.render(world, id, 0, 0, 0, undefined, false);
    view.mapAssets.select(mapIndex, true);
    const map = view.mapAssets.status[mapIndex],
      distant = view.mapAssets.distantStatus[mapIndex];
    const models = world.players.map((p) => view.players.get(p.id));
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
        MAPS[mapIndex].biome === "cave" ||
        distant.state === "ready") &&
      models.every((m) => m?.userData.trooper)
    )
      break;
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
  }
  progress(85);
  await wait(view.renderer.compileAsync(view.scene, view.camera));
  check();
  view.renderer.render(view.scene, view.camera);
  progress(100);
}
