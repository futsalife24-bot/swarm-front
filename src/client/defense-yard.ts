import * as T from "three";
import type { ArenaMap } from "../shared/stages";

/** Environment beyond the enclosing wall; no extra obstacles in the playable yard. */
export function defenseYard(group: T.Group, map: ArenaMap) {
  const material = new T.MeshStandardMaterial({
    color: map.color,
    roughness: 0.95,
  });
  for (let n = 0; n < 20; n++) {
    const angle = (n * Math.PI) / 10,
      radius = 60 + (n % 3) * 8;
    const height = 10 + (n % 5) * 2;
    let geometry: T.BufferGeometry;
    if (map.biome === "city") geometry = new T.BoxGeometry(8, height, 10);
    else if (map.biome === "grass") geometry = new T.ConeGeometry(5, height, 7);
    else geometry = new T.ConeGeometry(10, height, 5);
    const mesh = new T.Mesh(geometry, material);
    mesh.position.set(
      Math.sin(angle) * radius,
      height / 2,
      Math.cos(angle) * radius,
    );
    group.add(mesh);
    if (map.biome === "snow") {
      const cap = new T.Mesh(
        new T.ConeGeometry(5, height / 2, 5),
        new T.MeshStandardMaterial({ color: 0xdce7e8 }),
      );
      cap.position.copy(mesh.position);
      cap.position.y += height / 4;
      group.add(cap);
    }
  }
  // Painted approach lanes and a perimeter mark identify the vault's purpose.
  const marking = new T.MeshBasicMaterial({
    color: 0xc7ab65,
    side: T.DoubleSide,
  });
  const ring = new T.Mesh(new T.RingGeometry(2.3, 2.4, 48), marking);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.015;
  group.add(ring);
  for (let side = 0; side < 4; side++) {
    const lane = new T.Mesh(new T.PlaneGeometry(0.12, 18), marking);
    lane.rotation.x = -Math.PI / 2;
    lane.rotation.z = (side * Math.PI) / 2;
    lane.position.set(
      Math.sin((side * Math.PI) / 2) * 14,
      0.015,
      Math.cos((side * Math.PI) / 2) * 14,
    );
    group.add(lane);
  }
}
