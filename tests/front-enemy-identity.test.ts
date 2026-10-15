import { expect, it } from "vitest";
import { enemyReportId } from "../src/shared/enemy-identity";
import { createWorld, spawn } from "../src/shared/game";
import {
  freshProgress,
  validateProgress,
} from "../src/client/progression-save";

it("通常型と連結型を戦闘中の実個体から別々の保存キーへ対応させる", () => {
  const world = createWorld("enemy-report-identities");
  const normal = spawn(world, "boss", 0, 0, "crown")!;
  const linked = spawn(world, "boss", 12, 0, "worm")!;
  expect(enemyReportId(normal)).toBe("boss");
  expect(enemyReportId(linked)).toBe("worm");
  linked.fractured = true;
  expect(enemyReportId(linked)).toBe("worm");
});

it("既存セーブの通常型と連結型の遭遇状態を独立して保持する", () => {
  const onlyNormal = freshProgress("normal");
  onlyNormal.encounters.boss = "solo";
  expect(validateProgress(onlyNormal).encounters).toMatchObject({
    boss: "solo",
  });
  expect(validateProgress(onlyNormal).encounters.worm).toBeUndefined();

  const onlyLinked = freshProgress("normal");
  onlyLinked.encounters.worm = "solo";
  expect(validateProgress(onlyLinked).encounters).toMatchObject({
    worm: "solo",
  });
  expect(validateProgress(onlyLinked).encounters.boss).toBeUndefined();
});
