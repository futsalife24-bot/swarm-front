import { afterEach, expect, it, vi } from "vitest";
import { ENEMIES } from "../src/shared/defs";
import { developerProgress } from "../src/client/developer-mode";
import { freshProgress } from "../src/client/progression-save";

afterEach(() => vi.unstubAllGlobals());

it("unlocks CALYX and every report enemy in the developer sandbox", () => {
  const save = developerProgress();
  expect(save.encounters.calyx).toBe("solo");
  for (const kind of [...Object.keys(ENEMIES), "worm"])
    expect(save.encounters[kind], kind).toBe("solo");
});

it("keeps developer encounters disposable and normal progress locked", () => {
  const read = vi.fn(() => {
    throw new Error("unexpected save read");
  });
  const write = vi.fn(() => {
    throw new Error("unexpected save write");
  });
  vi.stubGlobal("localStorage", { getItem: read, setItem: write });
  const normal = freshProgress("normal");
  const first = developerProgress();
  first.encounters.calyx = "coop";
  expect(developerProgress().encounters.calyx).toBe("solo");
  expect(normal.encounters).toEqual({});
  expect(read).not.toHaveBeenCalled();
  expect(write).not.toHaveBeenCalled();
});
