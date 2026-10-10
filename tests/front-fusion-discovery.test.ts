import {
  createFrontUpgradeState,
  grantFrontUpgradeRights,
  openFrontUpgradeOffer,
  selectFrontUpgrade,
} from "../src/shared/front-upgrades";
import { describe, expect, it } from "vitest";
import {
  FRONT_BASE_IDS,
  FRONT_FUSION_IDS,
  FRONT_UPGRADE_CATALOG,
} from "../src/shared/front-upgrades";
import { createFrontRun, getFrontRunView } from "../src/shared/front-run";
import { frontUpgradeDetails } from "../src/client/front-upgrade-ui";
import {
  FRONT_FUSION_DISCOVERY_KEY as key,
  readFrontFusionDiscovery,
  recordFrontFusionDiscovery,
} from "../src/client/front-fusion-discovery";
const storage = () => {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
  };
};
const view = () => {
  const v = getFrontRunView(
    createFrontRun(
      { runId: "discovery", seed: 1, players: [{ id: "p" }], fusion: true },
      0,
    ),
    "p",
  );
  return v;
};
describe("融合の発見", () => {
  it("候補では解放せず、自分の確定した融合を保存して次の出撃にも引き継ぐ", () => {
    const s = storage(),
      v = view();
    v.levels.fuse = 3;
    v.levels["blast-radius"] = 3;
    expect(recordFrontFusionDiscovery(s, v).ids).toEqual([]);
    expect(s.data.size).toBe(0);
    v.levels["fusion-collapse"] = 1;
    expect(recordFrontFusionDiscovery(s, v).ids).toEqual(["fusion-collapse"]);
    expect(readFrontFusionDiscovery(s).ids).toEqual(["fusion-collapse"]);
    const html = frontUpgradeDetails(
      view(),
      "/",
      readFrontFusionDiscovery(s).ids,
    );
    expect(html).toContain("チェインノヴァ＝導火 × 爆域拡張");
    expect(html).toContain("リフレクトバースト＝？？ × ？？");
  });
  it("協力の自分用viewからだけ発見し、部隊員の融合は引き継がない", () => {
    const run = createFrontRun(
      {
        runId: "coop-discovery",
        seed: 1,
        players: [{ id: "self" }, { id: "ally" }],
        fusion: true,
      },
      0,
    );
    let state = grantFrontUpgradeRights(
      createFrontUpgradeState("ally", 1, undefined, [
        "fuse",
        "blast-radius",
        "armor",
        "reload",
        "magnet",
        "magazine",
      ]),
      119,
    );
    for (let n = 0; n < 120 && !state.levels["fusion-collapse"]; n++) {
      if (!state.offer) state = openFrontUpgradeOffer(state).state;
      const offer = state.offer!;
      const cardId =
        (["fusion-collapse", "fuse", "blast-radius"] as const).find((id) =>
          offer.cardIds.includes(id),
        ) ?? offer.cardIds[0];
      const result = selectFrontUpgrade(state, {
        runId: state.runId,
        offerId: offer.id,
        revision: offer.revision,
        requestId: `discovery-${n}`,
        cardId,
      });
      expect(result.ok).toBe(true);
      state = result.state;
    }
    expect(state.levels["fusion-collapse"]).toBe(1);
    run.upgrades.ally = state;
    const mine = storage();
    expect(
      recordFrontFusionDiscovery(mine, getFrontRunView(run, "self")).ids,
    ).toEqual([]);
    expect(
      recordFrontFusionDiscovery(storage(), getFrontRunView(run, "ally")).ids,
    ).toEqual(["fusion-collapse"]);
    expect(mine.data.size).toBe(0);
  });
  it("未発見の融合条件を伏せ、共通説明は1回だけ表示する", () => {
    const v = view();
    v.levels.armor = 1;
    const html = frontUpgradeDetails(v, "/");
    expect(html).toContain("チェインノヴァ＝？？ × ？？");
    expect(html.match(/1枠空く/g)).toHaveLength(1);
    expect(html).not.toContain("0/3");
    expect(html).not.toContain("爆域拡張");
    expect(html).toContain("1/4段階");
  });
  it("破損記録・保存失敗で既存データを上書きせず、成功扱いしない", () => {
    const s = storage(),
      v = view();
    v.levels["fusion-collapse"] = 1;
    s.setItem(key, "broken");
    expect(recordFrontFusionDiscovery(s, v).error).not.toBe("");
    expect(s.getItem(key)).toBe("broken");
    expect(
      recordFrontFusionDiscovery(
        {
          getItem: () => null,
          setItem: () => {
            throw Error();
          },
        },
        v,
      ).ids,
    ).toEqual([]);
  });
  it("他の保存キーと旧作戦に触れず、同じ発見を二重保存しない", () => {
    const s = storage(),
      v = view();
    s.setItem("existing-save", "keep");
    v.levels["fusion-collapse"] = 1;
    v.growthVersion = 2;
    recordFrontFusionDiscovery(s, v);
    expect(s.data.size).toBe(1);
    v.growthVersion = 3;
    recordFrontFusionDiscovery(s, v);
    const raw = s.getItem(key);
    recordFrontFusionDiscovery(s, v);
    expect(s.getItem(key)).toBe(raw);
    expect(s.getItem("existing-save")).toBe("keep");
  });
  it("融合元は日本語表記、融合先はカタカナ名に統一する", () => {
    for (const id of FRONT_BASE_IDS)
      expect(FRONT_UPGRADE_CATALOG[id].name).not.toMatch(/[ァ-ヶー]/);
    for (const id of FRONT_FUSION_IDS)
      expect(FRONT_UPGRADE_CATALOG[id].name).toMatch(/^[ァ-ヶー]+$/);
  });
});
