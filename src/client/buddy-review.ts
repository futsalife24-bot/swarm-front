import * as T from "three";
import type { Renderer } from "./render";
import type { World } from "../shared/game";
import { BuddyVisuals } from "./buddy-visuals";
import { BUDDY_ASSETS, type BuddyKind, type BuddyMotion } from "./buddy-assets";

/** DEVからのみimport。検証用の割当であり、装備・所有・通信の製品契約ではない。 */
export function attachBuddyReview(view: Renderer) {
  const visuals = new BuddyVisuals(view.scene);
  const panel = document.createElement("details");
  panel.id = "buddy-review";
  panel.style.cssText =
    "position:fixed;left:4px;top:4px;z-index:9999;background:#15252e;color:#fff;padding:4px;font:12px sans-serif";
  panel.innerHTML = `<summary>バディ外観検証（開発専用）</summary><label>個体 <select data-buddy-kind><option value="none">なし</option>${Object.entries(
    BUDDY_ASSETS,
  )
    .map(([key, value]) => `<option value="${key}">${value.name}</option>`)
    .join(
      "",
    )}</select></label><label>動作 <select data-buddy-motion>${["auto", "Idle", "Follow", "Display", "Coil"].map((v) => `<option>${v}</option>`).join("")}</select></label><label><input type="checkbox" data-buddy-peers>味方にも仮割当</label><label><input type="checkbox" data-buddy-shadow checked>影</label><output></output>`;
  document.body.append(panel);
  const kind = panel.querySelector<HTMLSelectElement>("[data-buddy-kind]")!;
  const motion = panel.querySelector<HTMLSelectElement>("[data-buddy-motion]")!;
  const peers = panel.querySelector<HTMLInputElement>("[data-buddy-peers]")!;
  const shadow = panel.querySelector<HTMLInputElement>("[data-buddy-shadow]")!;
  shadow.checked = false;
  let previousShadow = false;
  const refreshShadows = () => {
    for (const light of view.scene.children)
      if (light instanceof T.DirectionalLight) light.shadow.needsUpdate = true;
  };
  const samples: {
    updateMs: number;
    renderSubmitMs: number;
    calls: number;
    triangles: number;
  }[] = [];
  let localId = "",
    world: World | null = null,
    updateMs = 0;
  const api = {
    panel,
    visuals,
    samples,
    set(selection: BuddyKind | "none", clip = "auto", includePeers = false) {
      kind.value = selection;
      motion.value = clip;
      peers.checked = includePeers;
    },
    snapshot() {
      return {
        run: world?.run,
        phase: world?.phase,
        localId,
        players: world?.players.map((p) => ({
          id: p.id,
          x: p.x,
          y: p.y,
          z: p.z,
          hp: p.hp,
          connected: p.connected,
        })),
        entries: [...visuals.entries.values()].map((e) => ({
          key: e.key,
          owner: e.owner,
          kind: e.kind,
          visible: e.root.visible,
          loaded: !!e.model,
          motion: e.motion,
          error: e.error,
          position: e.root.position.toArray(),
          scale: e.root.scale.toArray(),
          rotation: e.root.rotation.y,
          clips: [...(e.actions?.keys() ?? [])],
          animationTime: e.mixer?.time,
          screenBounds: e.model
            ? (() => {
                const box = new T.Box3().setFromObject(e.root, true);
                const points = [box.min.x, box.max.x].flatMap((x) =>
                  [box.min.y, box.max.y].flatMap((y) =>
                    [box.min.z, box.max.z].map((z) =>
                      new T.Vector3(x, y, z).project(view.camera),
                    ),
                  ),
                );
                return {
                  minX: Math.min(...points.map((p) => p.x)),
                  maxX: Math.max(...points.map((p) => p.x)),
                  minY: Math.min(...points.map((p) => p.y)),
                  maxY: Math.max(...points.map((p) => p.y)),
                };
              })()
            : null,
          bounds: e.model
            ? new T.Box3()
                .setFromObject(e.root, true)
                .getSize(new T.Vector3())
                .toArray()
            : null,
          screen: e.root.position
            .clone()
            .add(new T.Vector3(0, 0.5, 0))
            .project(view.camera)
            .toArray(),
        })),
        memory: { ...view.renderer.info.memory },
        calls: view.renderer.info.render.calls,
        shadow: view.renderer.shadowMap.enabled,
        samples: samples.slice(-120),
      };
    },
    dispose() {
      visuals.dispose();
      if (previousShadow) refreshShadows();
      panel.remove();
      view.buddyReview = undefined;
      delete (window as any).swarmBuddyReview;
    },
  };
  (window as any).swarmBuddyReview = api;
  window.addEventListener("pagehide", () => visuals.dispose(), { once: true });
  return {
    update(next: World | null, id: string, dt: number) {
      world = next;
      localId = id;
      visuals.shadows = shadow.checked;
      for (const e of visuals.entries.values())
        e.model?.traverse((o) => {
          if (o instanceof T.Mesh) o.castShadow = shadow.checked;
        });
      const selection = Object.hasOwn(BUDDY_ASSETS, kind.value)
        ? (kind.value as BuddyKind)
        : null;
      const appearances = selection
        ? (world?.players ?? [])
            .filter((p) => peers.checked || p.id === id)
            .map((p) => ({
              key: `${p.id}:review`,
              owner: p.id,
              kind: selection,
            }))
        : [];
      const began = performance.now();
      visuals.update(
        world,
        appearances,
        dt,
        view.players,
        motion.value === "auto" ? undefined : (motion.value as BuddyMotion),
      );
      // 検証で影を生成する時だけ実際に毎フレーム更新し、OFF時は残像を消す。
      if (shadow.checked || previousShadow) refreshShadows();
      previousShadow = shadow.checked;
      updateMs = performance.now() - began;
      panel.querySelector("output")!.textContent =
        ` ${visuals.entries.size}体・外観のみ`;
    },
    afterRender(renderSubmitMs: number) {
      samples.push({
        updateMs,
        renderSubmitMs,
        calls: view.renderer.info.render.calls,
        triangles: view.renderer.info.render.triangles,
      });
      if (samples.length > 180) samples.shift();
    },
  };
}
