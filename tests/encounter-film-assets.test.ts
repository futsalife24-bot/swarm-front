import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import {
  ENEMY_MOTION_FILES,
  FOUNDRY_WORM_FILE,
} from "../src/client/enemy-motion-assets";
import { ENCOUNTER_FILM_FILES } from "../src/client/encounter-film-files";
import { STRUCTURE_ASSETS } from "../src/client/structure-motion";
import { ENEMY_REPORT_NAMES } from "../src/shared/enemy-identity";
import { ENEMY_REPORT_ORDER } from "../src/shared/enemy-report-order";
import { BASTION_ASSET } from "../src/client/bastion-view";

// 2026-10-15 の9種と、2026-10-18 に追加した BASTION を報告順に合わせて照合する。
const read = (file: string) => JSON.parse(readFileSync(file, "utf8"));
const rows = [
  ...read("docs/evidence/encounter-films-current-20261015/manifest.json").rows,
  ...read("docs/evidence/encounter-films-bastion-20261018/manifest.json").rows,
];
const manifest = {
  rows: ENEMY_REPORT_ORDER.map((key) =>
    rows.find((row: { key: string }) => row.key === key),
  ).filter(Boolean),
};
const hash = (file: string) =>
  createHash("sha256").update(readFileSync(file)).digest("hex");

it("every report film matches the shipped model, name and encoded video", () => {
  expect(manifest.rows.map((row: { key: string }) => row.key)).toEqual(
    ENEMY_REPORT_ORDER,
  );
  for (const key of ENEMY_REPORT_ORDER) {
    const row = manifest.rows.find((item: { key: string }) => item.key === key);
    const model =
      key === "worm"
        ? FOUNDRY_WORM_FILE
        : key === "bastion"
          ? BASTION_ASSET
          : ENEMY_MOTION_FILES[STRUCTURE_ASSETS[key]];
    const modelFile = "public/" + model.split("?")[0];
    expect(row.name, key).toBe(ENEMY_REPORT_NAMES[key]);
    expect(row.assets, key).toContainEqual({
      file: modelFile,
      sha256: hash(modelFile),
    });
    expect(row.sha256, key).toBe(hash(row.file));
    expect("public/" + ENCOUNTER_FILM_FILES[key].split("?")[0], key).toBe(
      row.file,
    );
    expect(row.worldFrozen && row.allDecoded && row.idleAnimated, key).toBe(
      true,
    );
    expect(row.width).toBe(1280);
    expect(row.height).toBe(720);
    expect(row.fps).toBe(30);
    expect(row.capture).toBe("webcodecs-vp9-frames");
    expect(row.frameCount).toBe((key === "harrow" ? 20 : 11) * 30);
  }
});
