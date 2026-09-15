import { expect, it } from "vitest";
import * as T from "three";
import { separateBackgroundTerrain } from "../src/client/scenery-boundary";

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
