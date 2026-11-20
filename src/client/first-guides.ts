/**
 * 第2層 初回ガイド（tutorial-proposal §4-2・§8-3 W5）。
 * 各システムに初めて触れた場面で、管制AIが1回だけ短く案内する。戦闘・画面を止めない（声と1行の案内だけ）。
 * - 声は SE 音量に従う。声が出せないときも1行の案内は出る（音声の終了を進行条件にしない）。
 * - 既読は端末ごとの記録（tutorial-flags）。completion が "complete" のものは、
 *   完了判定（例: 最初のバディを選んだ）まで既読にしないが、同じ起動中には繰り返さない。
 * - G4（stage-clear）・G15（daily-sortie）は既存の戦闘アナウンスに任せる。
 *   G7・G8（育成・アクセサリ）は既存の文字案内のまま。G18 は仕組みの実装後に追加する。
 */
import { hasSeen, markSeen, type GuideKey } from "./tutorial-flags";

export interface FirstGuide {
  /** 提案書の番号。 */
  id: string;
  /** 管制AIの台詞ID（採用外なら再生キューが鳴らさず、案内だけになる）。 */
  line: string;
  /** 1行の案内（操作方法・数値は画面側で出す）。 */
  text: string;
  completion: "display" | "complete";
}

export const FIRST_GUIDES: Readonly<Record<GuideKey, FirstGuide>> = {
  gear: {
    id: "G1",
    line: "tut-gear",
    text: "ステージ・難易度・装備2枠を選んで出撃",
    completion: "display",
  },
  "battle-multi": {
    id: "G2",
    line: "tut-battle-multi",
    text: "全ウェーブの敵を倒せば作戦達成",
    completion: "display",
  },
  "buddy-battle": {
    id: "G3",
    line: "tut-buddy-battle",
    text: "バディスキル｜タップで発動 · 長押しでチャージ（PC：G）",
    completion: "complete",
  },
  result: {
    id: "G5",
    line: "guide-step-3",
    text: "手に入れた武器は基地で比較・整理できます",
    completion: "display",
  },
  base: {
    id: "G6",
    line: "tut-base",
    text: "武器・アクセサリ・育成・バディ・補給ポッド・生存カード",
    completion: "display",
  },
  supply: {
    id: "G9",
    line: "tut-supply",
    text: "補給券で1回・10連",
    completion: "display",
  },
  "buddy-menu": {
    id: "G10",
    line: "tut-buddy-menu",
    text: "最初のバディを1体選ぶ · 進撃に同行",
    completion: "complete",
  },
  survival: {
    id: "G11",
    line: "tut-survival",
    text: "専用武器1本 · カードで強化",
    completion: "display",
  },
  card: {
    id: "G12",
    line: "tut-card",
    text: "3枚から1枚を選ぶ",
    completion: "complete",
  },
  fusion: {
    id: "G13",
    line: "tut-fusion",
    text: "融合｜2つの強化が1枠にまとまる",
    completion: "display",
  },
  defense: {
    id: "G14",
    line: "tut-defense",
    text: "拠点の耐久は画面上部に表示",
    completion: "display",
  },
  lobby: {
    id: "G16",
    line: "tut-lobby",
    text: "装備を確認 →「準備完了」→ 部隊長が出撃",
    completion: "complete",
  },
  "loot-multi": {
    id: "G17",
    line: "tut-loot-multi",
    text: "戦利品は隊員ごとに別",
    completion: "display",
  },
  revive: {
    id: "G17",
    line: "tut-revive",
    text: "蘇生｜近づいて長押し",
    completion: "display",
  },
};

export interface GuideVoice {
  say(id: string): unknown;
}

const shown = new Set<GuideKey>();

/** 未読なら1行の案内と声を出す。出したら true。 */
export function showFirstGuide(
  key: GuideKey,
  voice: GuideVoice,
  caption: (text: string) => void,
) {
  if (shown.has(key) || hasSeen(key)) return false;
  const guide = FIRST_GUIDES[key];
  shown.add(key);
  if (guide.completion === "display") markSeen(key);
  caption(guide.text);
  void voice.say(guide.line);
  return true;
}

/** 完了判定のあるガイド（G3・G10・G12・G16）を既読にする。 */
export function completeFirstGuide(key: GuideKey) {
  shown.add(key);
  markSeen(key);
}

/** 「初回ガイドをもう一度表示」のあと、この起動中でも再び出せるようにする。 */
export function forgetShownGuides() {
  shown.clear();
}

interface BuddyWorld {
  run: string;
  time: number;
  phase: string;
  buddies?: { entries: Record<string, { lastSkillAt: number } | undefined> };
}
/**
 * G3: バディを連れた最初の戦闘の開始10秒後に1回。
 * 固有スキルの初発動（lastSkillAt の変化）か、発動しなくても戦闘終了で既読にする。
 */
export class BuddyGuideWatch {
  private run = "";
  private skill = -1;
  update(
    w: BuddyWorld,
    id: string,
    inBattle: boolean,
    voice: GuideVoice,
    caption: (text: string) => void,
  ) {
    const entry = w.buddies?.entries[id];
    if (!entry) return;
    if (this.run === w.run) {
      if (entry.lastSkillAt !== this.skill || w.phase !== "battle")
        completeFirstGuide("buddy-battle");
      return;
    }
    if (!inBattle || w.phase !== "battle" || w.time < 10) return;
    if (showFirstGuide("buddy-battle", voice, caption)) {
      this.run = w.run;
      this.skill = entry.lastSkillAt;
    }
  }
}

/**
 * G17: 協力の最初の戦闘で、開始から20秒後に分配と蘇生の2本。
 * 蘇生の案内は、初めて味方が倒れたときにも1回（既存 ally-down の後）。
 */
export class CoopGuideWatch {
  private lootAt?: number;
  update(
    w: {
      run: string;
      time: number;
      phase: string;
      players: { id: string; hp: number; connected: boolean }[];
    },
    id: string,
    inBattle: boolean,
    voice: GuideVoice,
    caption: (text: string) => void,
  ) {
    if (!inBattle || w.phase !== "battle") return;
    if (w.time >= 20 && this.lootAt === undefined)
      if (showFirstGuide("loot-multi", voice, caption)) this.lootAt = w.time;
    const allyDown = w.players.some(
      (p) => p.id !== id && p.connected && p.hp <= 0,
    );
    if ((this.lootAt !== undefined && w.time >= this.lootAt + 6) || allyDown)
      showFirstGuide("revive", voice, caption);
  }
}

/** 1行の案内を一定時間だけ出すための小さな器（HUD の状態欄などに差し込む）。 */
export class GuideCaption {
  private text = "";
  private until = 0;
  constructor(private readonly now: () => number = () => performance.now()) {}
  show(text: string, seconds = 8) {
    this.text = text;
    this.until = this.now() + seconds * 1000;
  }
  get current() {
    if (this.text && this.now() > this.until) this.text = "";
    return this.text;
  }
  clear() {
    this.text = "";
  }
}
