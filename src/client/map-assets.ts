import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MAPS } from "../shared/stages";
import { caveScene } from "./cave-scene";
/** Models are already exported in world metres; never scale actors or tunnel cross-sections. */
export class MapAssets {
  readonly groups = MAPS.map(() => new T.Group());
  readonly status = MAPS.map(() => ({ state: "idle", error: "" }));
  readonly distantGroups = MAPS.map(() => new T.Group());
  readonly distantStatus = MAPS.map(() => ({ state: "idle", error: "" }));
  private loader = new GLTFLoader();
  shadowDirty = true;
  private selected = -1;
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
      const map = MAPS[i];
      if (map.biome !== "cave") {
        const floor = new T.Mesh(
          new T.PlaneGeometry(420, 440),
          new T.MeshStandardMaterial({ color: map.ground }),
        );
        floor.rotation.x = -Math.PI / 2;
        g.add(floor);
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
    });
  }
  select(index: number, load = true, distantVisible = true) {
    if (this.selected !== index) {
      this.selected = index;
      this.shadowDirty = true;
    }
    this.groups.forEach((g, i) => (g.visible = i === index));
    this.distantGroups.forEach((g, i) => {
      g.visible = i === index && distantVisible && MAPS[i].biome !== "cave";
    });
    if (!load) return;
    if (
      distantVisible &&
      MAPS[index].biome !== "cave" &&
      this.distantStatus[index].state === "idle"
    ) {
      this.distantStatus[index].state = "loading";
      this.loader
        .loadAsync(
          `${import.meta.env.BASE_URL}assets/maps/distant_${index}_v1.glb`,
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
    if (index === 5 && !this.groups[index].children.length)
      this.groups[index].add(caveScene());
    this.status[index].state = "loading";
    this.loader
      .loadAsync(`${import.meta.env.BASE_URL}assets/maps/map_${index}_v1.glb`)
      .then(({ scene }) => {
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
        group.traverse((o) => {
          if (o instanceof T.Mesh) {
            o.geometry.dispose();
            for (const m of Array.isArray(o.material)
              ? o.material
              : [o.material])
              m.dispose();
          }
        });
        group.clear();
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
