import { expect, it } from "vitest";
import * as T from "three";
import { readFileSync } from "node:fs";
import { MapAssets, VIEW_MAPS } from "../src/client/map-assets";
import mapFiles from "../src/client/assets/map-files.json";
import { DEFENSE_MAPS } from "../src/shared/stages";
import { separateBackgroundTerrain } from "../src/client/scenery-boundary";

it("keeps the ridge and skips the cloud triangles when switching a loaded city to multiplayer", () => {
  const maps = new MapAssets(new T.Scene());
  const defense = VIEW_MAPS.indexOf(DEFENSE_MAPS[0]);
  for (const [index, file, group] of [
    [0, mapFiles.distant[0], maps.distantGroups[0]],
    [defense, mapFiles.defense[0], maps.groups[defense]],
  ] as const) {
    const bytes = readFileSync("public/" + file);
    const gltf = JSON.parse(
      bytes.toString("utf8", 20, 20 + bytes.readUInt32LE(12)),
    );
    const node = gltf.nodes.find(
      (n: { name: string }) => n.name === "DISTANT_far",
    );
    const source = gltf.meshes[node.mesh];
    const ridge = source.extras.ridgeIndexCount;
    expect(ridge).toBeGreaterThan(0);
    expect(ridge).toBeLessThan(
      gltf.accessors[source.primitives[0].indices].count,
    );
    const mesh = new T.Mesh();
    mesh.name = node.name;
    mesh.userData = source.extras;
    group.add(mesh);
    maps.select(index, false, true, false);
    expect(mesh.geometry.drawRange.count).toBe(ridge);
    maps.select(index, false, true, true);
    expect(mesh.geometry.drawRange.count).toBe(Infinity);
  }
});

it("moves separately batched mountain surfaces together and preserves playable rocks", () => {
  const scene = new T.Group();
  const mesh = (name: string, vertices: number[]) => {
    const geometry = new T.BufferGeometry();
    geometry.setAttribute(
      "position",
      new T.Float32BufferAttribute(vertices, 3),
    );
    const result = new T.Mesh(geometry);
    result.name = name;
    scene.add(result);
    return result;
  };
  const base = mesh("weathered_granite", [80, 0, 80, 140, 0, 80, 110, 10, 100]);
  const top = mesh("granular_snow", [140, 0, 80, 110, 10, 100, 140, 30, 110]);
  const rock = mesh("weathered_granite", [-5, 0, -5, 5, 0, -5, 0, 6, 5]);
  const original = Array.from(rock.geometry.getAttribute("position").array);
  separateBackgroundTerrain(scene);
  expect(scene.userData.backgroundTerrain).toHaveLength(1);
  expect(Array.from(rock.geometry.getAttribute("position").array)).toEqual(
    original,
  );
  const a = base.geometry.getAttribute("position"),
    b = top.geometry.getAttribute("position");
  expect(a.getX(1)).toBe(b.getX(0));
  expect(a.getZ(1)).toBe(b.getZ(0));
  expect(
    Math.min(a.getX(0), a.getX(1), a.getX(2), b.getX(2)),
  ).toBeGreaterThanOrEqual(96);
  const after = Array.from(a.array);
  separateBackgroundTerrain(scene);
  expect(Array.from(a.array)).toEqual(after);
});
