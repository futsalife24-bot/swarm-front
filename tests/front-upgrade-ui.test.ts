import { describe, expect, it } from "vitest";
import { createFrontRun, getFrontRunView } from "../src/shared/front-run";
import {
  frontUpgradeDetails,
  frontUpgradeStrip,
} from "../src/client/front-upgrade-ui";

const view = () =>
  getFrontRunView(
    createFrontRun({ runId: "ui", seed: 1, players: [{ id: "p" }] }, 0),
    "p",
  );

describe("強化状況の表示", () => {
  it("未取得状態と取得済みだけを区別し、状態を書き換えない", () => {
    const v = view();
    expect(frontUpgradeStrip(v, "/")).toBe("");
    expect(frontUpgradeDetails(v, "/")).toContain("まだ強化を取得していません");
    v.levels.fuse = 1;
    v.picks = 1;
    const before = structuredClone(v);
    const detail = frontUpgradeDetails(v, "/game/");
    expect(detail).toContain(
      "手動命中で印を付け、次の手動命中で印を消費して起爆。",
    );
    expect(detail).not.toContain('data-upgrade="blast-core"');
    expect(frontUpgradeStrip(v, "/game/")).toContain(
      "/game/rebuild/upgrades/fuse.png",
    );
    expect(v).toEqual(before);
  });
  it("補強の複数段階を合計効果として表示する", () => {
    const v = view();
    v.levels.armor = 2;
    v.levels.reload = 4;
    v.levels.magazine = 1;
    v.picks = 7;
    const detail = frontUpgradeDetails(v, "/");
    expect(detail).toContain("最大体力 +10%");
    expect(detail).toContain("基準値から20%短縮");
    expect(detail).toContain("最低1発）を1回分追加");
    expect(detail).toContain("4/4段階");
    expect(frontUpgradeStrip(v, "/")).toContain("整備手順 4段階");
  });
  it("発動済み進化だけに名称と効果を表示する", () => {
    const v = view();
    v.evolved = ["explosion"];
    const detail = frontUpgradeDetails(v, "/");
    expect(detail).toContain("進化 · 連鎖崩落");
    expect(detail).toContain("深度2まで伝播");
    expect(detail).not.toContain("進化 · 串刺し");
  });
});
