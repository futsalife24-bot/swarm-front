import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { KINDS } from "../src/shared/defs";
import { makeWeapon } from "../src/shared/progression";
import { supplyResults } from "../src/client/supply-presentation";
import { weaponModelUrl } from "../src/client/weapon-model-url";

const render = JSON.parse(
  readFileSync("docs/evidence/supply-weapon-art-20261112/render.json", "utf8"),
) as {
  records: {
    kind: string;
    grade: number;
    input: string;
    inputSha256: string;
    file: string;
    sha256: string;
    bytes: number;
  }[];
};
const hash = (data: Uint8Array) =>
  createHash("sha256").update(data).digest("hex");

describe("補給演出の武器画像", () => {
  it("12武器と５等級をそれぞれ対応する画像へ変換する", () => {
    expect(render.records).toHaveLength(KINDS.length * 5);
    for (const kind of KINDS)
      for (let grade = 0; grade < 5; grade++) {
        const weapon = makeWeapon(
          `art_${kind}_${grade}`,
          kind,
          grade,
          { power: 0, reload: 0, range: 0, rate: 0 },
          false,
          grade,
        );
        const result = supplyResults([{ type: "weapon", weapon }])[0];
        expect(result).toMatchObject({ art: `w-v2-${kind}-${grade}` });
        const row = render.records.find(
          (item) => item.kind === kind && item.grade === grade,
        );
        expect(row).toBeDefined();
        expect(row!.file).toBe(`w-v2-${kind}-${grade}.webp`);
        expect(row!.input).toBe(weaponModelUrl(kind, grade));
        const source = readFileSync(`public${row!.input}`);
        const image = readFileSync(`public/supply-reveal/assets/${row!.file}`);
        expect(hash(source)).toBe(row!.inputSha256);
        expect(hash(image)).toBe(row!.sha256);
        expect(image.length).toBe(row!.bytes);
        expect(image.toString("ascii", 0, 4)).toBe("RIFF");
        expect(image.toString("ascii", 8, 12)).toBe("WEBP");
      }
  });

  it("見た目の等級が指定された場合は表示モデルに合わせる", () => {
    const weapon = {
      ...makeWeapon(
        "art_override",
        "medic",
        1,
        { power: 0, reload: 0, range: 0, rate: 0 },
        false,
        1,
      ),
      appearanceTier: 4,
    };
    expect(supplyResults([{ type: "weapon", weapon }])[0]).toMatchObject({
      art: "w-v2-medic-4",
    });
  });
});
