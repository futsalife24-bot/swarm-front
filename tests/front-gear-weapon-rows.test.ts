import { afterAll, describe, expect, it, vi } from "vitest";
import { gearWeaponRows } from "../src/client/gear-weapon-list";
import { freshProgress, soldier } from "../src/client/progression-save";

vi.hoisted(() => vi.stubGlobal("document", new EventTarget()));
afterAll(() => vi.unstubAllGlobals());

const rows = (html: string) =>
  [...html.matchAll(/<div class="pt-weapon-row (?!pt-weapon-head)[^>]+>/g)].map(
    ([tag]) => tag,
  );

describe("所持武器一覧", () => {
  it("装備を入れ替えても所持3丁を3行だけ表示する", () => {
    const save = freshProgress("normal");
    for (const id of save.inventory.map((weapon) => weapon.id)) {
      soldier(save).equipped[0] = id;
      const html = gearWeaponRows(save.inventory, save, false, new Set(), 0);
      expect(rows(html)).toHaveLength(save.inventory.length);
      for (const weapon of save.inventory) {
        expect(
          html.match(new RegExp(`data-row="${weapon.id}"`, "g")),
        ).toHaveLength(1);
      }
    }
  });

  it("絞り込みで非表示になった装備を追加せず、選択した枠だけを強調する", () => {
    const save = freshProgress("normal");
    const filtered = [save.inventory[2]];
    expect(
      rows(gearWeaponRows(filtered, save, false, new Set(), 0)),
    ).toHaveLength(1);
    const html = gearWeaponRows(save.inventory, save, false, new Set(), 1);
    const selected = rows(html).filter((tag) =>
      tag.includes("is-selected-slot"),
    );
    expect(selected).toHaveLength(1);
    expect(selected[0]).toContain(`data-row="${soldier(save).equipped[1]}"`);
  });

  it("装備中もロックと整理用の保護されたチェック欄を残し、保存を書き換えない", () => {
    const save = freshProgress("normal");
    const before = structuredClone(save);
    const html = gearWeaponRows(save.inventory, save, true, new Set(), 0);
    expect(html.match(/data-lock=/g)).toHaveLength(3);
    expect(html.match(/data-check=/g)).toHaveLength(3);
    expect(html).toMatch(
      new RegExp(`data-check="${soldier(save).equipped[0]}"[^>]+disabled`),
    );
    expect(save).toEqual(before);
  });
});
