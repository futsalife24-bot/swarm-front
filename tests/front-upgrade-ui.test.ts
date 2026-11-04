import { describe, expect, it } from "vitest";
import { createFrontRun, getFrontRunView } from "../src/shared/front-run";
import {
  frontUpgradeDetails,
  frontUpgradeStrip,
  frontUpgradeCardCopy,
  frontUpgradeCardMarkup,
  frontUpgradeCardView,
  renderSurvivalCardM,
} from "../src/client/front-upgrade-ui";
import * as legacyUi from "../src/client/front-legacy-upgrade-ui";
import { FRONT_UPGRADE_CATALOG as oldCatalog } from "../src/shared/front-legacy-upgrades";

const view = () =>
  getFrontRunView(
    createFrontRun({ runId: "ui", seed: 1, players: [{ id: "p" }] }, 0),
    "p",
  );

describe("強化状況の表示", () => {
  it("新規則は通常/融合の共通カードを3択・HUD・取得一覧に使う", () => {
    const v = view();
    v.growthVersion = 3;
    const normal = frontUpgradeCardMarkup(v, "armor", "/game/");
    const fusion = frontUpgradeCardMarkup(v, "fusion-bastion", "/game/");
    expect(normal).toContain('data-card="armor"');
    expect(normal).toContain('data-kind="normal"');
    expect(normal).toContain('data-type="ability"');
    const weapon = frontUpgradeCardMarkup(v, "power-cell", "/game/");
    expect(weapon).toContain('data-kind="normal"');
    expect(weapon).toContain('data-type="weapon"');
    expect(weapon).toContain("武器強化");
    expect(normal).toContain('data-size="L"');
    expect(normal).toContain("最大体力 +5%");
    expect(fusion).toContain('data-kind="fusion"');
    expect(fusion).toContain("◆");
    expect(fusion).toContain("素材：装甲補強 × 生命回収");
    v.levels.armor = 2;
    v.levels["fusion-bastion"] = 1;
    const strip = frontUpgradeStrip(v, "/game/");
    expect(strip).toContain('data-size="S"');
    expect(strip).toContain("◆");
    expect(strip).toContain("装甲補強（能力強化） 2/4段階");
    const details = frontUpgradeDetails(v, "/game/");
    expect(details).toContain('data-upgrade="armor"');
    expect(details).toContain('data-size="row"');
    expect(details).toContain("2/4段階");
  });

  it("基地Mは閲覧のみと候補編集を分け、未発見の素材を伏せる", () => {
    const readOnly = renderSurvivalCardM(frontUpgradeCardView("armor", "/"));
    expect(readOnly).toContain('data-inspect="armor"');
    expect(readOnly).not.toContain("data-pool=");
    const editable = renderSurvivalCardM(
      frontUpgradeCardView("armor", "/", { deck: "in", inspecting: true }),
    );
    expect(editable).toContain('data-pool="armor"');
    expect(editable).toContain('role="checkbox" aria-checked="true"');
    expect(editable).toContain('data-inspecting="true"');
    const unknown = renderSurvivalCardM(
      frontUpgradeCardView("fusion-bastion", "/", {
        undiscovered: true,
      }),
    );
    expect(unknown).toContain("？？ × ？？");
    expect(unknown).not.toContain("生命回収");
    expect(unknown).not.toContain("fusion-atlas.png");
  });
  it("旧規則のHUD・停止詳細・全12カードは旧文言と段階規則を維持する", () => {
    const v = view();
    v.growthVersion = 1;
    v.maxPicks = 7;
    v.levels["blast-core"] = 1;
    v.levels.magazine = 2;
    v.picks = 3;
    expect(frontUpgradeStrip(v, "/")).toBe(legacyUi.frontUpgradeStrip(v, "/"));
    expect(frontUpgradeDetails(v, "/")).toBe(
      legacyUi.frontUpgradeDetails(v, "/"),
    );
    expect(frontUpgradeStrip(v, "/")).not.toContain("誘爆核 1段階");
    expect(frontUpgradeDetails(v, "/")).not.toContain("1/1段階");
    expect(frontUpgradeDetails(v, "/")).toContain(
      "基準弾倉の10%を切り上げた量（最低1発）を2回分追加。",
    );
    for (const id of Object.keys(oldCatalog) as (keyof typeof oldCatalog)[]) {
      const card = frontUpgradeCardCopy(v, id);
      expect(card.aria).toBe(oldCatalog[id].description);
      expect(card.description).toBe(legacyUi.legacyUpgradeCopy[id]);
      expect(card.prefix).toBe("");
    }
    expect(frontUpgradeCardCopy(v, "blast-core").description).toBe(
      "射撃で撃破すると、周囲を爆破。",
    );
  });
  it("未取得状態と取得済みだけを区別し、状態を書き換えない", () => {
    const v = view();
    expect(frontUpgradeStrip(v, "/")).toBe("");
    expect(frontUpgradeDetails(v, "/")).toContain("まだ強化を取得していません");
    v.levels.fuse = 1;
    v.picks = 1;
    const before = structuredClone(v);
    const detail = frontUpgradeDetails(v, "/game/");
    expect(detail).toContain("命中で印、次の命中で起爆。威力 34。");
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
  it("ダウン中の装甲補強も回復の生存条件を明記する", () => {
    const run = createFrontRun(
      { runId: "downed", seed: 1, players: [{ id: "p" }] },
      0,
    );
    run.world.players[0].hp = 0;
    const v = getFrontRunView(run, "p");
    v.levels.armor = 2;
    v.picks = 2;
    expect(frontUpgradeDetails(v, "/")).toContain(
      "最大体力 +10%。生存中の取得時は増加分を回復。",
    );
    expect(run.world.players[0].hp).toBe(0);
  });
});
