import { liftMap } from "./terrain-view";
import { addMapDetail, weatherMapMaterials } from "./map-detail";
import { softenNaturalNormals } from "./map-surfaces";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  MAPS,
  TRAINING_MAP,
  DEFENSE_MAPS,
  ELEVATED_MAPS,
  CITY_TOWERS,
  type ArenaMap,
} from "../shared/stages";
import { terrainProps } from "../shared/terrain";
import { caveScene } from "./cave-scene";
import { trainingMapScene } from "./training-map";
export const VIEW_MAPS = [
  ...MAPS,
  TRAINING_MAP,
  ...DEFENSE_MAPS,
  ...ELEVATED_MAPS,
];
function addElevatedStructures(scene: T.Object3D, map: ArenaMap) {
  const box = (
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: number,
  ) => {
    const mesh = new T.Mesh(
      new T.BoxGeometry(w, h, d),
      new T.MeshStandardMaterial({ color, roughness: 0.78 }),
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    scene.add(mesh);
  };
  const index = map.assetIndex ?? MAPS.indexOf(map);
  const additions = index === 0 ? CITY_TOWERS : [];
  for (const b of [
    ...additions,
    ...(map.elevated && map.biome === "city" ? map.blocks.slice(-2) : []),
  ]) {
    box(b.x, b.h / 2, b.z, b.w, b.h, b.d, map.color);
    // Recessed dark glazing between concrete floor bands.
    for (let y = 2; y < b.h - 1; y += 3) {
      box(b.x, y, b.z, b.w + 0.04, 1.25, b.d + 0.04, 0x263c49);
    }
  }
  for (const b of terrainProps(map.blocks))
    box(b.x, b.base + b.h / 2, b.z, b.w, b.h, b.d, 0x79848a);
}
function disposeMap(group: T.Object3D) {
  const textures = new Set<T.Texture>(),
    materials = new Set<T.Material>();
  group.traverse((o) => {
    if (!(o instanceof T.Mesh || o instanceof T.LineSegments)) return;
    if (o instanceof T.BatchedMesh) o.dispose();
    else o.geometry.dispose();
    for (const mat of Array.isArray(o.material) ? o.material : [o.material]) {
      materials.add(mat);
      if (mat instanceof T.MeshStandardMaterial)
        for (const texture of [
          mat.map,
          mat.normalMap,
          mat.roughnessMap,
          mat.metalnessMap,
          mat.emissiveMap,
        ])
          if (texture) textures.add(texture);
    }
  });
  textures.forEach((t) => t.dispose());
  materials.forEach((m) => m.dispose());
  group.clear();
}
/** Models are already exported in world metres; never scale actors or tunnel cross-sections. */
export class MapAssets {
  readonly groups = VIEW_MAPS.map(() => new T.Group());
  readonly status = VIEW_MAPS.map(() => ({ state: "idle", error: "" }));
  readonly distantGroups = VIEW_MAPS.map(() => new T.Group());
  readonly distantStatus = VIEW_MAPS.map(() => ({ state: "idle", error: "" }));
  private loader = new GLTFLoader();
  shadowDirty = true;
  private selected = -1;
  private detailed = true;
  setQuality(quality: number) {
    const detailed = quality === 1;
    if (this.detailed === detailed) return;
    this.detailed = detailed;
    if (this.selected >= 0 && this.status[this.selected].state !== "loading")
      this.status[this.selected] = { state: "idle", error: "" };
  }
  constructor(scene: T.Scene) {
    this.distantGroups.forEach((g, i) => {
      g.name = `DISTANT_MAP_${i}`;
      g.userData.visualOnly = true;
      g.visible = false;
      scene.add(g);
    });
    this.groups.forEach((g, i) => {
      g.name = `MAP_${i}`;
      scene.add(g);
      g.visible = false;
    });
  }
  private fallback(index: number) {
    const map = VIEW_MAPS[index],
      g = this.groups[index];
    if (map === TRAINING_MAP) {
      g.add(trainingMapScene());
      return;
    }
    if (map.biome !== "cave" || DEFENSE_MAPS.includes(map)) {
      const floor = new T.Mesh(
        new T.PlaneGeometry(420, 440, 210, 220),
        new T.MeshStandardMaterial({ color: map.ground }),
      );
      floor.rotation.x = -Math.PI / 2;
      g.add(floor);
      liftMap(g, map);
      const boxes = new T.InstancedMesh(
        new T.BoxGeometry(1, 1, 1),
        new T.MeshStandardMaterial({ color: map.color }),
        map.blocks.length,
      );
      const matrix = new T.Matrix4();
      map.blocks.forEach((b, j) => {
        matrix.makeScale(b.w, b.h, b.d);
        matrix.setPosition(b.x, b.h / 2, b.z);
        boxes.setMatrixAt(j, matrix);
      });
      g.add(boxes);
    }
  }
  select(index: number, load = true, distantVisible = true) {
    const assetIndex = VIEW_MAPS[index].assetIndex ?? index;
    if (this.selected !== index) {
      if (this.selected >= 0) {
        // GPU memory is bounded by the active map, including both detail levels.
        const previous = this.selected;
        disposeMap(this.groups[previous]);
        if (this.status[previous].state !== "loading")
          this.status[previous] = { state: "idle", error: "" };
      }
      this.selected = index;
      this.shadowDirty = true;
    }
    this.groups.forEach((g, i) => (g.visible = i === index));
    this.distantGroups.forEach((g, i) => {
      g.visible =
        i === index && distantVisible && VIEW_MAPS[i].biome !== "cave";
    });
    if (!this.groups[index].children.length) this.fallback(index);
    if (VIEW_MAPS[index] === TRAINING_MAP) {
      this.status[index].state = "ready";
      return;
    }
    if (DEFENSE_MAPS.includes(VIEW_MAPS[index])) {
      this.distantStatus[index].state = "ready";
      if (!load || this.status[index].state !== "idle") return;
      this.status[index].state = "loading";
      const variant = index - MAPS.length - 1;
      this.loader
        .loadAsync(
          `${import.meta.env.BASE_URL}assets/maps/defense_${variant}_v2.glb`,
        )
        .then(({ scene }) => {
          if (this.selected !== index) {
            disposeMap(scene);
            this.status[index] = { state: "idle", error: "" };
            return;
          }
          scene.traverse((o) => {
            if (o instanceof T.Mesh) {
              const distant = o.name.startsWith("DISTANT_");
              o.castShadow = !distant && !o.name.startsWith("PLAZA_FLAT");
              o.receiveShadow = true;
              if (distant) o.raycast = () => {};
            }
          });
          disposeMap(this.groups[index]);
          this.groups[index].add(scene);
          this.status[index].state = "ready";
          this.shadowDirty = true;
        })
        .catch((e) => {
          this.status[index] = { state: "error", error: String(e) };
        });
      return;
    }
    if (!load) return;
    if (
      distantVisible &&
      VIEW_MAPS[index].biome !== "cave" &&
      this.distantStatus[index].state === "idle"
    ) {
      this.distantStatus[index].state = "loading";
      this.loader
        .loadAsync(
          `${import.meta.env.BASE_URL}assets/maps/distant_${assetIndex}_v1.glb`,
        )
        .then(({ scene }) => {
          scene.traverse((o) => {
            if (!(o instanceof T.Mesh)) return;
            o.castShadow = false;
            o.receiveShadow = false;
            // Scenery never participates in camera/aim raycasts, even if the caller traverses the scene.
            o.raycast = () => {};
          });
          this.distantGroups[index].add(scene);
          this.distantStatus[index].state = "ready";
        })
        .catch((e) => {
          this.distantStatus[index] = { state: "error", error: String(e) };
          console.error("Distant scenery load failed", index, e);
        });
    }
    if (this.status[index].state !== "idle") return;
    if (index === 5 && !this.groups[index].children.length) {
      const fallback = caveScene();
      liftMap(fallback, VIEW_MAPS[index]);
      this.groups[index].add(fallback);
    }
    this.status[index].state = "loading";
    this.loader
      .loadAsync(
        `${import.meta.env.BASE_URL}assets/maps/map_${assetIndex}_v1.glb`,
      )
      .then(({ scene }) => {
        if (this.selected !== index) {
          disposeMap(scene);
          this.status[index] = { state: "idle", error: "" };
          return;
        }
        liftMap(scene, VIEW_MAPS[index], this.detailed);
        if (assetIndex === 3 || assetIndex === 4) softenNaturalNormals(scene);
        addElevatedStructures(scene, VIEW_MAPS[index]);
        addMapDetail(scene, this.detailed);
        weatherMapMaterials(scene, assetIndex, this.detailed);
        scene.userData.detailed = this.detailed;
        let meshes = 0;
        scene.traverse((o) => {
          if (!(o instanceof T.Mesh)) return;
          o.castShadow =
            index !== 5 &&
            !/earth|road_asphalt|meadow_ground|granular_snow|worn_road_paint/.test(
              o.name,
            );
          o.receiveShadow = index !== 5;
          meshes++;
          for (const m of Array.isArray(o.material) ? o.material : [o.material])
            if (m instanceof T.MeshStandardMaterial) {
              for (const texture of [m.map, m.normalMap, m.roughnessMap])
                if (texture) texture.anisotropy = 4;
            }
        });
        if (!meshes) throw new Error("Map contains no meshes");
        const group = this.groups[index];
        disposeMap(group);
        group.add(scene);
        this.status[index].state = "ready";
        this.shadowDirty = true;
      })
      .catch((e) => {
        this.status[index] = { state: "error", error: String(e) };
        console.error("Map asset load failed", index, e);
      });
  }
}
