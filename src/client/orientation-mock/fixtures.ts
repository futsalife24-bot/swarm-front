import { WEAPONS, type Kind } from "../../shared/defs";
import { makeWeapon, SKILLS } from "../../shared/progression";
import {
  FRONT_UPGRADE_IDS,
  type FrontUpgradeId,
} from "../../shared/front-upgrades";
import { freshProgress, type ProgressSave } from "../progression-save";

/** Fictional data, constructed in memory. No game save is read or migrated. */
export function mockProgress(): ProgressSave {
  const save = freshProgress("normal");
  save.inventory = (Object.keys(WEAPONS) as Kind[]).flatMap((kind, i) =>
    [0, 1].map((variant) =>
      makeWeapon(
        `mock-${kind}-${variant}`,
        kind,
        (i + variant) % 5,
        { power: variant ? 20 : -10, reload: 10, range: 20, rate: -5 },
        false,
        i * 2 + variant,
      ),
    ),
  );
  save.soldiers[0].equipped = [save.inventory[0].id, save.inventory[4].id];
  save.soldiers[0].levels = { hp: 2, aim: 1, move: 1, swap: 1 };
  save.locks = [save.inventory[0].id, save.inventory[7].id];
  save.unlocked = [...SKILLS];
  save.points = 120;
  save.materials = 12;
  save.coins = 4200;
  save.powder = 850;
  save.serial = 100;
  save.missions = Object.fromEntries(
    Array.from({ length: 8 }, (_, i) => [
      `${i + 1}:normal`,
      [true, true, false],
    ]),
  );
  return save;
}

export function mockUpgrades() {
  const levels = Object.fromEntries(
    FRONT_UPGRADE_IDS.map((id) => [id, 0]),
  ) as Record<FrontUpgradeId, number>;
  levels["blast-core"] = 2;
  levels["armor"] = 1;
  levels["magnet"] = 1;
  return { levels, picks: 4, evolved: [], growthVersion: 3 as const };
}

export const MOCK_ROOMS = [
  {
    id: "DEMO0001",
    name: "縦横チェック部隊",
    players: 3,
    stage: "攻略 ST5・出撃準備中",
  },
  {
    id: "DEMO0002",
    name: "生存戦を一緒に",
    players: 2,
    stage: "生存・参加募集中",
  },
  {
    id: "DEMO0003",
    name: "初めての協力",
    players: 1,
    stage: "攻略 ST1・出撃準備中",
  },
] as const;

export const MOCK_ENEMY_NOTES: Record<string, string> = {
  crawler:
    "低い姿勢で追跡。胸部の襞が開いたあと、前方へ衝撃波を放ちます。予兆を見たら横へ回避。",
  ant: "五脚と浮遊する背骨を持つ異構体。扇状の弾と接近時のパルスを使います。",
  spider:
    "五脚を縮めて跳躍し、壁を足場に再び飛び出します。着地の範囲から離れましょう。",
  spitter: "離れた場所から照準した地点へ低速のエネルギー弾を放ちます。",
  hornet: "隊員の上方を旋回。中央の縦穴に光が集まった後、電撃杭を放ちます。",
  bastion:
    "連射を受けると装甲が硬化。赤い危険帯の後に放射弾を放ち、その直後にコアを露出します。",
  boss: "壁・レール・リングからなる移動工場。大きな支持脚を持ち、隊員の集まる位置へ攻撃します。",
  worm: "頭部と胴節の発光器官からレーザーを放つ機械体。胴節の破壊で分離します。",
  calyx:
    "五枚の花弁と三本の根を持つ生物型。花粉弾の着弾地点にはドーム状の花粉が広がります。",
  harrow:
    "地上と空中を行き来する大型異構体。突進・回転・爆撃・急降下の予兆を見て回避します。",
};
