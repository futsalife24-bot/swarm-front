import { afterEach, describe, expect, it, vi } from "vitest";
import * as T from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { BastionView } from "../src/client/bastion-view";
import { createWorld, spawn } from "../src/shared/game";

const views: BastionView[] = [];
afterEach(() => {
  views.splice(0).forEach((view) => view.dispose());
  vi.restoreAllMocks();
});
function view() {
  const value = new BastionView("/local-bastion-fixture.glb");
  views.push(value);
  return value;
}
function model() {
  const scene = new T.Group(),
    root = new T.Group(),
    body = new T.Group();
  root.name = "BASTION_ROOT";
  root.userData.rig = JSON.stringify({
    params: { loose: 0.1, spike_ext: 0.4, open_max: 60, ports: 12 },
    plates: [],
    spikes: [],
  });
  body.name = "Body";
  body.position.y = 1.7;
  const band = new T.Group(),
    core = new T.Group();
  band.name = "band";
  core.name = "core";
  body.add(band, core);
  root.add(body);
  scene.add(root);
  const materials = [
    "BASTION_seam",
    "BASTION_port",
    "BASTION_core",
    "BASTION_shell",
  ].map((name) => {
    const material = new T.MeshStandardMaterial();
    material.name = name;
    material.map = new T.Texture();
    return material;
  });
  const meshes = materials.map(
    (material) => new T.Mesh(new T.BoxGeometry(1, 1, 1), material),
  );
  body.add(meshes[0], meshes[3]);
  band.add(meshes[1]);
  core.add(meshes[2]);
  vi.spyOn(GLTFLoader.prototype, "loadAsync").mockResolvedValue({
    scene,
  } as unknown as GLTF);
  return { root, materials, meshes };
}
const instanced = (roots: T.Object3D[]) =>
  roots.filter(
    (root): root is T.InstancedMesh => root instanceof T.InstancedMesh,
  );
const haloIn = (root: T.Object3D) => {
  let halo: T.Mesh<T.SphereGeometry, T.MeshBasicMaterial> | undefined;
  root.traverse((object) => {
    if (object instanceof T.Mesh && object.geometry instanceof T.SphereGeometry)
      halo = object as typeof halo;
  });
  expect(halo).toBeDefined();
  return halo!;
};

describe("BASTION loading-screen preparation resources", () => {
  it("allocates full-capacity dynamic spark/flash colors before a first hit and draws zero instances", () => {
    const load = vi.spyOn(GLTFLoader.prototype, "loadAsync");
    const v = view();
    const roots = v.preparationRoots;
    expect(roots).toHaveLength(4);
    const effects = instanced(roots);
    expect(effects.map((mesh) => mesh.instanceMatrix.count)).toEqual([
      1152, 96, 128, 48,
    ]);
    expect(effects.every((mesh) => mesh.count === 0)).toBe(true);
    for (const mesh of effects.slice(2)) {
      expect(mesh.instanceColor).not.toBeNull();
      expect(mesh.instanceColor!.count).toBe(mesh.instanceMatrix.count);
      expect(mesh.instanceColor!.usage).toBe(T.DynamicDrawUsage);
      const color = new T.Color();
      mesh.getColorAt(0, color);
      expect(color.getHexString()).toBe("ffffff");
    }
    expect(load).not.toHaveBeenCalled();
  });

  it("keeps one reusable hidden model outside normal units and includes its visible halo", async () => {
    const fixture = model(),
      v = view();
    const promise = v.load();
    expect(v.load()).toBe(promise);
    await promise;
    expect(GLTFLoader.prototype.loadAsync).toHaveBeenCalledTimes(1);
    expect(v.ready).toBe(true);
    const first = v.preparationRoots,
      second = v.preparationRoots;
    expect(first).toHaveLength(5);
    first.forEach((root, index) => expect(second[index]).toBe(root));
    const preparation = first[0];
    expect(preparation).not.toBe(fixture.root);
    expect(preparation.parent).toBe(v.root);
    expect(preparation.visible).toBe(false);
    expect(haloIn(preparation).visible).toBe(true);
    expect(v.placed(-1)).toBe(false);
    expect(v.inspect(-1)).toBeUndefined();
    expect(v.bounds(-1)).toBeUndefined();
  });

  it("preserves preparation resources hidden across real placement, clear and repeated preparation", async () => {
    model();
    const v = view();
    await v.load();
    const roots = v.preparationRoots,
      preparation = roots[0];
    const w = createWorld("bastion-preparation");
    const e = spawn(w, "bastion", 0, 0)!;
    const authority = JSON.stringify(w);
    expect(v.place(e, new T.Vector3(3, 1, 4), 1, 0.05)).toBe(true);
    expect(v.placed(e.id)).toBe(true);
    expect(v.placed(-1)).toBe(false);
    v.spark({ x: 0, y: 1.7, z: 0, guard: 2 });
    v.begin(null, [], 0.01);
    expect(
      instanced(roots)
        .slice(2)
        .some((mesh) => mesh.count > 0),
    ).toBe(true);
    preparation.visible = true; // The parent loading-screen pass restores this flag.
    v.clear();
    expect(preparation.visible).toBe(false);
    expect(v.placed(e.id)).toBe(false);
    expect(v.preparationRoots).toEqual(roots);
    expect(haloIn(preparation).visible).toBe(true);
    expect(instanced(roots).every((mesh) => mesh.count === 0)).toBe(true);
    expect(JSON.stringify(w)).toBe(authority);
  });

  it("disposes preparation-owned clone/halo materials without prematurely releasing shared geometry or textures", async () => {
    const fixture = model(),
      v = view();
    await v.load();
    const preparation = v.preparationRoots[0],
      halo = haloIn(preparation);
    const materials = new Set<T.Material>();
    preparation.traverse((object) => {
      if (object instanceof T.Mesh)
        for (const m of [object.material].flat()) materials.add(m);
    });
    const owned = [...materials].filter(
      (m) => !fixture.materials.includes(m as T.MeshStandardMaterial),
    );
    expect(owned).toHaveLength(4);
    const ownedDispose = owned.map((m) => vi.spyOn(m, "dispose"));
    const sharedGeometry = fixture.meshes.map((mesh) =>
      vi.spyOn(mesh.geometry, "dispose"),
    );
    const sharedTexture = fixture.materials.map((m) =>
      vi.spyOn(m.map!, "dispose"),
    );
    const templateMaterials = fixture.materials.map((m) =>
      vi.spyOn(m, "dispose"),
    );
    const haloGeometry = vi.spyOn(halo.geometry, "dispose");
    v.clear();
    expect(
      [
        ...ownedDispose,
        ...sharedGeometry,
        ...sharedTexture,
        ...templateMaterials,
        haloGeometry,
      ].every((spy) => spy.mock.calls.length === 0),
    ).toBe(true);
    views.splice(views.indexOf(v), 1);
    v.dispose();
    for (const spy of [
      ...ownedDispose,
      ...sharedGeometry,
      ...sharedTexture,
      ...templateMaterials,
      haloGeometry,
    ])
      expect(spy).toHaveBeenCalledTimes(1);
    expect(preparation.parent).toBeNull();
    expect(v.preparationRoots).not.toContain(preparation);
  });

  it("returns the same particle-only roots after model load failure so the ordinary fallback remains available", async () => {
    vi.spyOn(GLTFLoader.prototype, "loadAsync").mockRejectedValue(
      new Error("local fixture unavailable"),
    );
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const v = view(),
      before = v.preparationRoots;
    await v.load();
    expect(v.ready).toBe(false);
    expect(v.error).toContain("local fixture unavailable");
    expect(v.preparationRoots).toEqual(before);
    expect(v.preparationRoots).toHaveLength(4);
    expect(v.placed(-1)).toBe(false);
    v.clear();
    expect(
      instanced(v.preparationRoots).every((mesh) => mesh.count === 0),
    ).toBe(true);
  });
});
