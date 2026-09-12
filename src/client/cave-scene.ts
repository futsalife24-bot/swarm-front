import * as T from "three";
import { caveClearance, caveCeiling, CAVE_NODES } from "../shared/cave";

export function caveScene() {
  const group = new T.Group(),
    vertices: number[] = [],
    colors: number[] = [];
  const stone = new T.Color();
  const triangle = (a: number[], b: number[], c: number[], shade: number) => {
    vertices.push(...a, ...b, ...c);
    stone.setRGB(0.24 * shade, 0.18 * shade, 0.14 * shade);
    for (let i = 0; i < 3; i++) colors.push(stone.r, stone.g, stone.b);
  };
  const size = 0.8,
    low = -94,
    high = 104;
  const inside = (x: number, z: number) =>
    caveClearance(x + size / 2, z + size / 2) >= 0;
  for (let x = low; x < high; x += size)
    for (let z = low; z < high; z += size) {
      if (!inside(x, z)) continue;
      const corners = [
        [x, z],
        [x + size, z],
        [x + size, z + size],
        [x, z + size],
      ];
      const top = corners.map(([px, pz]) => [
        px,
        Math.max(1.5, caveCeiling(px, pz)),
        pz,
      ]);
      const shade = 0.86 + 0.14 * Math.sin(x * 3.7 + z * 8.1);
      triangle(top[0], top[1], top[2], shade);
      triangle(top[0], top[2], top[3], shade);
      for (const [a, b, dx, dz] of [
        [0, 1, 0, -size],
        [1, 2, size, 0],
        [2, 3, 0, size],
        [3, 0, -size, 0],
      ]) {
        if (inside(x + dx, z + dz)) continue;
        const floorA = [top[a][0], 0, top[a][2]],
          floorB = [top[b][0], 0, top[b][2]];
        triangle(floorA, top[a], top[b], shade);
        triangle(floorA, top[b], floorB, shade);
      }
    }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  group.add(
    new T.Mesh(
      geometry,
      new T.MeshStandardMaterial({
        vertexColors: true,
        side: T.DoubleSide,
        roughness: 1,
        flatShading: true,
      }),
    ),
  );
  // A few differently coloured mineral patches help teammates describe junctions.
  for (const [i, p] of CAVE_NODES.entries()) {
    const color = [0x63bdc1, 0xdca45b, 0x9987d5][i % 3];
    const crystal = new T.Mesh(
      new T.ConeGeometry(0.35, 1.8, 5),
      new T.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.65,
      }),
    );
    crystal.position.set(p.x + 3.8, 0.8, p.z + 2.2);
    crystal.rotation.z = -0.3;
    group.add(crystal);
  }
  return group;
}
