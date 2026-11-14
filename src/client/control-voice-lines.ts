/**
 * 管制AI音声の台詞定義表。
 * 正本:
 * - チュートリアル34本: docs/tutorial-proposal-20261113.md §6（ID・トリガー・文面・タグ・制作優先度）
 * - 管制AI147行: docs/voice-proposal-20261113.md §4-1〜4-5・4-8・4-9
 * 文面は字幕にも使う。タグ・再生優先度・採用フラグ・止めている理由は、コードではなくこの表のデータで持つ。
 */

/** 音声セット。フォルダは `voice-<set>-<voice>-v<version>/`。 */
export type ControlVoiceSet = "tutorial" | "control";
/** 共通＝人数に関係なく正しい / solo＝ソロのみ / multi＝協力の経路のみ。 */
export type ControlVoiceTag = "common" | "solo" | "multi";
/**
 * 再生優先度（tutorial-proposal §8-1）。
 * - warning: 警告系アナウンス。tutorial / ack / guide に割り込める（逆はしない）。
 * - announce: 通常アナウンス。再生中なら捨てる（現行 speak() と同じ）。
 * - tutorial: 基礎訓練の説明。再生中なら最新1本だけ待たせる。
 * - ack: 相づち・促し。再生中なら捨てる。
 * - guide: 初回ガイド。再生中なら鳴り終わりを最大5秒待ち、だめなら声を諦める。
 */
export type ControlVoicePriority =
  "warning" | "announce" | "tutorial" | "ack" | "guide";
/** 提案書の制作優先度（必須／推奨／余力があれば）。 */
export type ControlVoiceProduction = "required" | "recommended" | "optional";
/** voice-proposal のカテゴリ（チュートリアルは基礎訓練・初回ガイド）。 */
export type ControlVoiceCategory =
  | "training"
  | "guide"
  | "announce"
  | "supply"
  | "coop"
  | "system"
  | "weapon"
  | "report"
  | "brief";
/**
 * 読み込みのまとまり（§8-4-1: 起動時の一括読み込みには載せない）。
 * - battle: 戦闘の読み込み画面で、選択中の声の採用分だけ取得する。
 * - それ以外: その場面に入るときに必要な分だけ取得する。
 */
export type ControlVoiceScene =
  "training" | "guide" | "battle" | "menu" | "supply" | "coop" | "none";
/**
 * 再生候補にしない理由。
 * - abolished: 機能ごと廃止（brief-*）
 * - on-hold: 本人判断で保留（anomaly-* の識別名）
 * - unimplemented: 鳴らす仕組みが未実装（G18 など）
 */
export type ControlVoiceBlock = "abolished" | "on-hold" | "unimplemented";

export interface ControlVoiceLine {
  /** クリップ名（拡張子なし）。台詞IDとして使う。 */
  id: string;
  set: ControlVoiceSet;
  category: ControlVoiceCategory;
  scene: ControlVoiceScene;
  /** 鳴らすきっかけ（提案書のトリガー列の要約）。 */
  trigger: string;
  /** 台詞（字幕にも使う）。 */
  text: string;
  tag: ControlVoiceTag;
  priority: ControlVoicePriority;
  production: ControlVoiceProduction;
  /** 採用フラグ。false の行はファイルがあっても再生しない（本人のチェックで切り替える）。 */
  adopted: boolean;
  /** 設定されている行は再生候補にしない。 */
  blocked?: ControlVoiceBlock;
}

type Row = readonly [
  id: string,
  trigger: string,
  text: string,
  production: ControlVoiceProduction,
  tag?: ControlVoiceTag,
  priority?: ControlVoicePriority,
];

const R = "required",
  P = "recommended",
  O = "optional";

/** 管制AIの採用初期値: 必須＋推奨＝採用、余力があれば＝不採用（本人チェックリストの初期値）。 */
const adoptedByDefault = (production: ControlVoiceProduction) =>
  production !== "optional";

function rows(
  set: ControlVoiceSet,
  category: ControlVoiceCategory,
  scene: ControlVoiceScene,
  defaults: { tag: ControlVoiceTag; priority: ControlVoicePriority },
  list: readonly Row[],
  options: {
    adopted?: (production: ControlVoiceProduction) => boolean;
    blocked?: (id: string) => ControlVoiceBlock | undefined;
  } = {},
): ControlVoiceLine[] {
  return list.map(([id, trigger, text, production, tag, priority]) => {
    const blocked = options.blocked?.(id);
    return {
      id,
      set,
      category,
      scene,
      trigger,
      text,
      tag: tag ?? defaults.tag,
      priority: priority ?? defaults.priority,
      production,
      adopted: (options.adopted ?? adoptedByDefault)(production),
      ...(blocked ? { blocked } : {}),
    };
  });
}

// ─── チュートリアル34本（tutorial-proposal §6。セット voice-tutorial-*） ───
// 基礎訓練と初回ガイドは提案書の設計どおり全行を使うため、採用フラグは制作優先度に関係なく true。
const TUTORIAL_ADOPTED = () => true;

const TRAINING = rows(
  "tutorial",
  "training",
  "training",
  { tag: "common", priority: "tutorial" },
  [
    [
      "tut-offer",
      "初めて「ソロ → 進撃」に入ったときの誘い",
      "基礎訓練を受けますか。操作をひととおり確認できます。あとから受けることもできます。",
      P,
      "common",
      "guide",
    ],
    [
      "tut-intro",
      "T0 訓練の開始ボタン",
      "基礎訓練を開始します。ここでは、報酬も失敗もありません。操作をひとつずつ確認しましょう。",
      R,
    ],
    [
      "tut-move",
      "T1 開始（T0の台詞の終了後）",
      "まず、移動です。訓練場の中を、自由に動いてみてください。",
      R,
    ],
    [
      "tut-look",
      "T2 開始（T1達成: 移動8m）",
      "次に、視点です。周囲を見回してください。",
      R,
    ],
    [
      "tut-fire",
      "T3 開始（T2達成: 視点90度）",
      "正面の標的を狙って、射撃してください。射撃は、押し続けている間つづきます。",
      R,
    ],
    [
      "tut-reload",
      "T4 開始（T3達成: イベント hit 5回）",
      // 生成済み音声の採用文言（2026-11-14 本人確定。提案書§6の原文ではない）。
      "弾切れになると、自動で装填が始まります。装填ボタンで、好きなときに装填することもできます。一度、装填してください。",
      R,
    ],
    [
      "tut-swap",
      "T5 開始（T4達成: reload の完了）",
      "武器は、二つ持って出撃します。もう一つの武器に、切り替えてください。",
      R,
    ],
    [
      "tut-dodge",
      "T6 開始（T5達成: slot の変化）",
      "回避です。すばやく動いて、敵の攻撃をかわします。一度使うと、少しの間は使えません。回避してください。",
      R,
    ],
    [
      "tut-jump",
      "T7 開始（T6達成: evade の発動）",
      "ジャンプもできます。一度、跳んでみてください。",
      R,
    ],
    [
      "tut-kill",
      "T8 開始（T7達成: y の変化）",
      "実戦形式に移ります。訓練標的を三体、撃破してください。",
      R,
    ],
    [
      "tut-drop",
      "T9 開始（T8達成: イベント kill 3回）",
      "敵を倒すと、武器や回復アイテムを落とすことがあります。近づくだけで回収できます。落ちている武器を、回収してください。",
      R,
    ],
    [
      "tut-drop-rule",
      "T9 達成（pending が1個増えた）",
      "回収した武器は、作戦を達成すると持ち帰れます。一度の出撃で持ち帰れる数には、限りがあります。",
      R,
    ],
    [
      "tut-recover",
      "T10 開始（tut-drop-rule の終了後）",
      "体力は、しばらく攻撃を受けなければ、半分まで自動で回復します。",
      R,
    ],
    [
      "tut-medkit",
      "T10 の2本目（tut-recover の終了後）",
      "危険なときは、救急箱を使ってください。一度の出撃で一回だけ、体力を全回復できます。",
      R,
      "solo",
    ],
    [
      "tut-complete",
      "T11 修了",
      "基礎訓練、修了です。訓練は、タイトルのチュートリアルから、いつでもやり直せます。",
      R,
    ],
    [
      "tut-ack-1",
      "T1〜T9 のステップ達成（3種から直前と違うもの）",
      "確認しました。",
      R,
      "common",
      "ack",
    ],
    [
      "tut-ack-2",
      "T1〜T9 のステップ達成（3種から直前と違うもの）",
      "良好です。",
      P,
      "common",
      "ack",
    ],
    [
      "tut-ack-3",
      "T1〜T9 のステップ達成（3種から直前と違うもの）",
      "その調子です。",
      P,
      "common",
      "ack",
    ],
    [
      "tut-nudge",
      "同じステップで20秒達成がない（1ステップに1回まで）",
      "画面の案内を見ながら、操作を試してください。",
      P,
      "common",
      "ack",
    ],
    ["tut-skip", "一時停止から「訓練を終了」を選んだ", "訓練を終了します。", O],
  ],
  { adopted: TUTORIAL_ADOPTED },
);

const GUIDE = rows(
  "tutorial",
  "guide",
  "guide",
  { tag: "common", priority: "guide" },
  [
    [
      "tut-gear",
      "G1 進撃の出撃準備を初めて開いた",
      "出撃準備です。ステージと難易度、持っていく二つの武器を選んで、出撃してください。",
      R,
      "solo",
    ],
    [
      "tut-battle-multi",
      "G2 協力の最初の戦闘開始",
      "協力作戦、開始です。部隊で協力して、すべてのウェーブの敵を倒してください。",
      R,
      "multi",
    ],
    [
      "tut-buddy-battle",
      "G3 バディを連れた最初の戦闘の開始10秒後",
      "バディが同行しています。バディは、自動で攻撃します。スキルボタンで固有スキルを発動、長押しで、力をためて強化できます。",
      R,
    ],
    [
      "tut-base",
      "G6 基地を初めて開いた",
      "基地です。武器の整理、アクセサリ、兵士の育成、バディ、補給ポッドは、ここから利用できます。",
      R,
    ],
    [
      "tut-supply",
      "G9 補給ポッドを初めて開いた",
      "補給ポッドです。補給券を使って、武器やバディ、武装片を受け取れます。",
      P,
    ],
    [
      "tut-buddy-menu",
      "G10 バディ画面を初めて開いた（starterChosen が false）",
      "バディの編成です。最初のバディを一体、選んでください。選んだバディは、進撃作戦に同行します。",
      R,
    ],
    [
      "tut-survival",
      "G11 生存戦の出撃準備を初めて開いた",
      "生存戦です。専用の武器ひとつで出撃し、強化カードを選びながら、できるだけ長く生き延びてください。",
      R,
    ],
    [
      "tut-card",
      "G12 生存で初めてのカード3択",
      "三枚のカードから、強化をひとつ選んでください。同じ強化を重ねると、段階が上がります。",
      R,
    ],
    [
      "tut-fusion",
      "G13 生存で融合が初めて候補に出た",
      "融合が候補に現れました。二つの強化が、ひとつにまとまります。",
      O,
    ],
    [
      "tut-defense",
      "G14 防衛戦の最初の出撃",
      "防衛戦です。拠点を守りながら、戦ってください。拠点の耐久は、画面の上で確認できます。",
      P,
    ],
    [
      "tut-lobby",
      "G16 協力ロビーに初めて入った",
      "協力ロビーです。装備を確認して、準備完了を押してください。全員の準備が整うと、部隊長が出撃を開始します。",
      R,
      "multi",
    ],
    [
      "tut-loot-multi",
      "G17 協力の最初の戦闘の開始20秒後",
      "戦利品は、隊員ごとに別々に用意されます。取り合いにはなりません。",
      P,
      "multi",
    ],
    [
      "tut-revive",
      "G17 tut-loot-multi の後／初めて味方が倒れたとき",
      "倒れた味方に近づいて、蘇生ボタンを押し続けると、味方を復帰させられます。",
      R,
      "multi",
    ],
    // G18 は敵情報開示の仕組みが未実装のため、実装後に有効化する。
    [
      "tut-enemy-info",
      "G18 ステージ初クリアで敵情報が開示されたとき",
      "ステージクリアにより、このステージの敵情報が開示されました。",
      O,
    ],
  ],
  {
    adopted: TUTORIAL_ADOPTED,
    blocked: (id) => (id === "tut-enemy-info" ? "unimplemented" : undefined),
  },
);

// ─── 管制AI147行（voice-proposal §4。セット voice-control-*） ───

/** 4-1 戦闘アナウンス（46行）。anomaly-<名前> の識別名10行は本人判断で保留。anomaly-new は対象。 */
const ANNOUNCE = rows(
  "control",
  "announce",
  "battle",
  { tag: "common", priority: "announce" },
  [
    [
      "adv-sortie",
      "作戦キュー adv-sortie（出撃）",
      "進撃作戦、開始。出撃してください。",
      R,
    ],
    [
      "adv-complete",
      "作戦キュー adv-complete（作戦達成）",
      "作戦達成。全目標の撃破を確認しました。",
      R,
    ],
    [
      "adv-failed",
      "作戦キュー adv-failed（作戦失敗）",
      "作戦失敗。部隊の反応が途絶えました。",
      R,
    ],
    [
      "srv-sortie",
      "作戦キュー srv-sortie（生存戦の出撃）",
      "生存戦、開始。可能な限り、生き延びてください。",
      R,
    ],
    [
      "srv-extract",
      "作戦キュー srv-extract（撤収完了）",
      "撤収完了。戦果を持ち帰ります。",
      R,
    ],
    [
      "srv-ended",
      "作戦キュー srv-ended（戦闘終了）",
      "戦闘終了。記録を保存します。",
      R,
    ],
    [
      "def-sortie",
      "生存側の防衛戦の出撃",
      "防衛戦、開始。拠点を守り抜いてください。",
      P,
    ],
    [
      "daily-sortie",
      "日替わり武器庫防衛の開始",
      "日替わり防衛、開始。三分間、武器庫を守ってください。",
      P,
      "solo",
    ],
    [
      "daily-victory",
      "日替わり防衛の結果演出（守り抜いた）",
      "武器庫を守り抜いた。",
      P,
      "solo",
    ],
    [
      "daily-destroyed",
      "日替わり防衛の結果演出（武器庫のHPが0）",
      "武器庫が破壊された。",
      P,
      "solo",
    ],
    [
      "daily-ended",
      "日替わり防衛の結果演出（それ以外の終了）",
      "防衛作戦終了。",
      P,
      "solo",
    ],
    [
      "wave-clear",
      "HUD「WAVE CLEAR」。進撃の波の全滅時",
      "ウェーブクリア。次の波に備えてください。",
      R,
    ],
    [
      "wave-incoming",
      "HUD「増援まで N秒」（残り10秒以下）",
      "増援、まもなく到着します。",
      P,
    ],
    ["wave-final", "最終波に進んだとき", "最終ウェーブです。", O],
    [
      "boss-detected",
      "大型（boss / harrow / calyx）の出現",
      "大型反応を検知。警戒してください。",
      P,
      "common",
      "warning",
    ],
    [
      "stage-clear",
      "STAGE CLEAR（ソロ進撃の回収時間）",
      "ステージクリア。残った戦利品を回収してください。",
      R,
      "solo",
    ],
    ["result-win", "結果画面「戦果」", "戦果を確認してください。", P],
    ["result-lose", "結果画面「敗北」", "敗北。態勢を立て直しましょう。", P],
    [
      "hp-danger",
      "HUD「HP · 危険」（HP40以下）",
      "バイタル低下。危険域です。",
      P,
      "common",
      "warning",
    ],
    [
      "ally-down",
      "HUD「味方がダウン」、イベント down",
      "味方がダウン。蘇生に向かってください。",
      R,
      "multi",
      "warning",
    ],
    [
      "self-down",
      "HUD「味方の蘇生を待っています」（自分がダウン）",
      "戦闘不能。味方の蘇生を待ってください。",
      P,
      "multi",
      "warning",
    ],
    [
      "revived",
      "イベント revive（自分が復帰）",
      "蘇生完了。戦線に復帰します。",
      P,
      "multi",
    ],
    [
      "medkit",
      "救急箱の使用",
      "救急箱を使用。バイタル、回復しました。",
      O,
      "solo",
    ],
    [
      "branch-ready",
      "HUD「クリアで分岐解放」",
      "分岐ルートの条件を達成しました。",
      O,
      "solo",
    ],
    [
      "resume-run",
      "「中断した作戦」の再開",
      "中断した作戦を再開します。",
      O,
      "solo",
    ],
    [
      "anomaly-new",
      "初遭遇の告知「新たなANOMALYを確認」",
      "新たなアノマリーを確認。エネミーレポートに記録しました。",
      R,
    ],
    ["anomaly-harrow", "初遭遇の告知（HARROW）", "識別名、ハロウ。", P],
    ["anomaly-calyx", "初遭遇の告知（CALYX）", "識別名、ケイリクス。", P],
    ["anomaly-bastion", "初遭遇の告知（BASTION）", "識別名、バスティオン。", P],
    [
      "anomaly-volley",
      "初遭遇の告知（HOUND / VOLLEY）",
      "識別名、ハウンド・ボレー。",
      P,
    ],
    [
      "anomaly-leaper",
      "初遭遇の告知（HOUND / LEAPER）",
      "識別名、ハウンド・リーパー。",
      P,
    ],
    ["anomaly-pleat", "初遭遇の告知（PLEAT）", "識別名、プリート。", P],
    ["anomaly-prism", "初遭遇の告知（PRISM）", "識別名、プリズム。", P],
    ["anomaly-ray", "初遭遇の告知（RAY）", "識別名、レイ。", P],
    [
      "anomaly-foundry",
      "初遭遇の告知（FOUNDRY ZERO）",
      "識別名、ファウンドリー・ゼロ。",
      P,
    ],
    ["anomaly-catena", "初遭遇の告知（CATENA）", "識別名、カテナ。", P],
    [
      "levelup",
      "生存「レベルアップ／強化カードを選択」",
      "レベルアップ。強化カードを選択してください。",
      R,
    ],
    ["treasure", "生存「部隊の宝箱を開封中…」", "部隊の宝箱を開封します。", P],
    [
      "boss-reward",
      "生存「ボス撃破報酬」",
      "ボス撃破。報酬を獲得しました。",
      P,
    ],
    [
      "final-large",
      "生存側の局面 boss（最終大型）",
      "最終大型、出現。",
      P,
      "common",
      "warning",
    ],
    [
      "time-warning",
      "防衛戦のHUD「残り N」（残り1分）",
      "作戦時間、残り一分です。",
      P,
      "common",
      "warning",
    ],
    [
      "return-soon",
      "HUD「帰還まで」（残り300秒以下）",
      "帰還まで、残り五分です。",
      P,
    ],
    [
      "base-under-attack",
      "拠点・武器庫の耐久の減少",
      "拠点が攻撃を受けています。",
      P,
      "common",
      "warning",
    ],
    [
      "spawn-warning",
      "生存の出現予告の印",
      "敵性反応、接近。",
      O,
      "common",
      "warning",
    ],
    [
      "squad-choosing",
      "「部隊の選択を待っています」",
      "部隊の選択を待っています。",
      O,
      "multi",
    ],
    [
      "return-save",
      "「帰還して戦果を保存」（ソロ生存の任意帰還）",
      "帰還します。戦果を保存しました。",
      O,
      "solo",
    ],
  ],
  {
    blocked: (id) =>
      id.startsWith("anomaly-") && id !== "anomaly-new" ? "on-hold" : undefined,
  },
);

/** 4-2 補給（14行）。 */
const SUPPLY = rows(
  "control",
  "supply",
  "supply",
  { tag: "common", priority: "announce" },
  [
    ["supply-request", "進行見出し「投下要請」", "投下要請、受理。", R],
    ["supply-launch", "開始前の停止点 launch（射出）", "射出。", P],
    ["supply-descend", "進行見出し「降下中」", "補給ポッド、降下中。", P],
    ["supply-detect", "進行見出し「反応を検知」", "反応を検知。", R],
    ["supply-analyze", "進行見出し「解析中」", "解析中。", O],
    ["supply-open", "進行見出し「開封」", "開封します。", O],
    ["supply-confirmed", "進行見出し「確定」", "確定。", P],
    [
      "supply-complete",
      "進行見出し「受領完了」",
      "受領完了。補給を受領しました。",
      R,
    ],
    ["supply-sr", "昇格の停止点 promo（SR+ へ）", "高レア反応。", P],
    [
      "supply-ssr",
      "昇格の停止点 promo（SSR+ へ）",
      "最高ランクの反応です。",
      P,
    ],
    ["supply-buddy", "昇格の停止点 promo（バディへ）", "未知の通信を受信。", P],
    [
      "supply-buddy-new",
      "結果表示「新しいバディが合流」",
      "新しいバディが合流。",
      R,
    ],
    [
      "supply-buddy-join",
      "結果表示「バディが合流」（所持済み）",
      "バディが合流。",
      P,
    ],
    [
      "supply-resume",
      "「前回の確定した補給を再開できます。」",
      "前回の確定した補給を再開できます。",
      O,
    ],
  ],
);

/** 4-3 協力プレイ（10行）。協力の経路でだけ鳴らす。 */
const COOP = rows(
  "control",
  "coop",
  "coop",
  { tag: "multi", priority: "announce" },
  [
    ["coop-connected", "状態「接続済み」", "協力ロビーに接続しました。", P],
    ["coop-invited", "「招待を受け取りました」", "招待を受け取りました。", O],
    [
      "coop-member-join",
      "ロビーの接続中の人数が増えた",
      "隊員が合流しました。",
      P,
    ],
    [
      "coop-member-left",
      "隊員表示「切断中」「切断」",
      "隊員との通信が途絶えました。",
      P,
    ],
    [
      "coop-all-ready",
      "ロビー「全員の準備が整いました」",
      "全員の準備が整いました。",
      R,
    ],
    [
      "coop-waiting",
      "ロビー「隊員の準備完了を待っています」",
      "隊員の準備完了を待っています。",
      O,
    ],
    ["coop-begin", "「全員で出撃」ボタン", "全員で出撃します。", P],
    [
      "coop-disconnect",
      "状態「通信切断 · 再接続 N/5」",
      "通信切断。再接続を試みます。",
      R,
      "multi",
      "warning",
    ],
    [
      "coop-resync",
      "状態「戦況データを再取得します」",
      "戦況データを再取得します。",
      P,
    ],
    ["coop-closed", "「通信が終了しました」", "通信が終了しました。", P],
  ],
);

/** 4-4 システム・メニュー（19行）。 */
const SYSTEM = rows(
  "control",
  "system",
  "menu",
  { tag: "common", priority: "announce" },
  [
    ["title", "タイトル画面", "スウォーム・フロント。", P],
    [
      "home",
      "ホーム「戦術作戦本部」「出撃待機」",
      "戦術作戦本部。出撃待機中です。",
      P,
    ],
    [
      "pick-operation",
      "作戦選択「進撃と生存から作戦を選択してください。」",
      "進撃と生存から、作戦を選択してください。",
      P,
    ],
    [
      "gear-ready",
      "出撃準備「装備を確認したら、出撃しましょう。」",
      "装備を確認したら、出撃しましょう。",
      P,
    ],
    ["loading", "読み込み「戦場を準備中」", "戦場を準備中です。", P],
    ["equip-changed", "「装備 N を変更しました。」", "装備を変更しました。", O],
    [
      "armory-full",
      "「武器庫の整理と戦果の受取りを完了してください。」",
      "武器庫の整理と、戦果の受け取りを完了してください。",
      O,
    ],
    [
      "weekly-ready",
      "週間ミッションの受取可能通知",
      "週間ミッションの報酬を受け取れます。",
      O,
    ],
    [
      "daily-done",
      "「今日の防衛作戦は挑戦済みです。」",
      "今日の防衛作戦は挑戦済みです。日本時間、零時に更新されます。",
      O,
      "solo",
    ],
    ["settings-saved", "「設定を保存しました。」", "設定を保存しました。", O],
    [
      "buddy-skill-ready",
      "バディの固有スキルが再使用可能になった",
      "バディスキル、使用可能。",
      O,
    ],
    ["buddy-breakthrough", "「限界突破しました」", "限界突破しました。", O],
    [
      "tutorial-combat",
      "初回戦闘「戦闘の基本」（G2 ソロ）",
      "全ウェーブの敵を倒せばクリアです。時間と、救急箱なしは追加目標です。",
      P,
      "solo",
      "guide",
    ],
    [
      "tutorial-growth",
      "初回「兵士の育成」（G7）",
      "通常ステージ1から4の初クリアで解放素材、各面・難易度の初クリアでポイントを獲得します。兵士ごとに配分でき、割当を戻す確定には500コイン必要です。",
      O,
      "common",
      "guide",
    ],
    [
      "tutorial-accessory",
      "初回「アクセサリの作成と合成」（G8）",
      "武装片で作成します。同種・同レア品は合成して昇格できます。一括合成は消費品と完成品を確認してから実行します。全兵士の登録品とロック品は保護されます。",
      O,
      "common",
      "guide",
    ],
    [
      "guide-step-1",
      "チュートリアル「進め方 1. 出撃を準備」",
      "タイトルの「ソロで出撃準備」から、ステージと装備を選びます。操作が気になるときは「設定・操作」を確認しましょう。",
      O,
      "common",
      "guide",
    ],
    [
      "guide-step-2",
      "チュートリアル「進め方 2. 戦場に挑戦」",
      "出撃したら周囲の敵と状況を確認しながら戦います。敵への対処に迷ったら、タイトルのエネミーレポートが手がかりになります。",
      O,
      "common",
      "guide",
    ],
    [
      "guide-step-3",
      "チュートリアル「進め方 3. 報酬を確認」（G5 戦果画面で流用）",
      "戦闘が終わったら戦果を確認します。手に入れた武器を比べて、次の出撃に使う装備を選びましょう。",
      O,
      "common",
      "guide",
    ],
    [
      "guide-step-4",
      "チュートリアル「進め方 4. 基地で準備を整える」",
      "武器の整理や育成をして、次のステージや難易度へ挑戦します。仲間と遊ぶときはタイトルの「協力プレイ」へ進みましょう。",
      O,
      "common",
      "guide",
    ],
  ],
);

/** 4-5 武器名（12行）。読みの修正は別バッチでファイルを差し替える（フォルダ版数で反映）。 */
const WEAPON_NAMES = rows(
  "control",
  "weapon",
  "supply",
  { tag: "common", priority: "announce" },
  [
    ["weapon-rifle", "補給の武器名表示（WEAPONS.rifle）", "AR-9 リーフ。", O],
    ["weapon-smg", "補給の武器名表示（WEAPONS.smg）", "SMG-3 ワスプ。", O],
    [
      "weapon-shotgun",
      "補給の武器名表示（WEAPONS.shotgun）",
      "SG-4 ブレイカー。",
      O,
    ],
    ["weapon-slug", "補給の武器名表示（WEAPONS.slug）", "SG-7 スパイク。", O],
    [
      "weapon-rocket",
      "補給の武器名表示（WEAPONS.rocket）",
      "RL-2 コメット。",
      O,
    ],
    ["weapon-heavy", "補給の武器名表示（WEAPONS.heavy）", "RL-9 メテオ。", O],
    ["weapon-sniper", "補給の武器名表示（WEAPONS.sniper）", "SR-1 ソーン。", O],
    [
      "weapon-grenade",
      "補給の武器名表示（WEAPONS.grenade）",
      "GL-6 ホロウ。",
      O,
    ],
    [
      "weapon-sticky",
      "補給の武器名表示（WEAPONS.sticky）",
      "ST-3 リンバー。",
      O,
    ],
    ["weapon-laser", "補給の武器名表示（WEAPONS.laser）", "LZ-2 グリム。", O],
    ["weapon-kick", "補給の武器名表示（WEAPONS.kick）", "KB-6 ケストレル。", O],
    ["weapon-medic", "補給の武器名表示（WEAPONS.medic）", "MD-4 ブルーム。", O],
  ],
);

/** 4-8 読み上げ：エネミーレポート（20行）。再生の操作は未実装。 */
const REPORT = rows(
  "control",
  "report",
  "none",
  { tag: "common", priority: "announce" },
  [
    [
      "report-harrow-form",
      "エネミーレポート HARROW の形態",
      "長い首から胴体へ連なる鱗の被覆と、喉から腹を覆う装甲。細い後脚で歩き、支柱で組まれた翼を広げて高く飛び上がります。地上と空中を行き来し、飛行中に大きく損傷すると体勢を崩して落下します。",
      O,
    ],
    [
      "report-harrow-attack",
      "エネミーレポート HARROW の攻撃",
      "地上では短く突進し、翼爪から山なりの弾と直射弾を放ちます。地面すれすれまで伏せ、その場で一回転する攻撃も見られます。空中では山なり弾を放ち、標的の上空を直線に通過しながら左右二列へ爆撃します。急降下では二脚の爪を先行させ、地面に爪形の予兆が現れます。",
      O,
    ],
    [
      "report-calyx-form",
      "エネミーレポート CALYX の形態",
      "灰緑に赤茶の斑が混じる丸い蕾。三本の曲線の根を支えに、兵士側へ傾いたコマのように回転し、その周囲を回ります。五枚の花弁の奥に花粉嚢を隠しています。",
      O,
    ],
    [
      "report-calyx-attack",
      "エネミーレポート CALYX の攻撃",
      "前の花弁を開いて振り下ろします。また、前方の花粉嚢から花粉弾を放ち、着弾地点に花粉がドーム状に広がって周囲を覆う様子が観察されています。",
      O,
    ],
    [
      "report-bastion-form",
      "エネミーレポート BASTION の形態",
      "上下の装甲板と回転する帯に覆われた球体。地面から浮いたまま一定の距離を保ち、隊員の周りを回ります。硬化するほど動きが遅くなり、撃たれない時間が続くと装甲が緩んで元に戻ります。爆発やレーザー、間を空けた射撃は硬化の影響を受けにくいことが観察されています。",
      O,
    ],
    [
      "report-bastion-attack",
      "エネミーレポート BASTION の攻撃",
      "帯の発射口が赤く光って弾道が示された後、隊員へ単発の弾を放ちます。短い間隔で撃たれ続けると装甲が締まってトゲがせり出し、続けて当たる銃弾ほど弾かれます。硬化しきると帯が高速で回りながら震え、地面へ赤い危険帯が放射状に伸びた後、全方位へ弾を放ちます。放射の直後は装甲が開き、内部のコアが露出します。",
      O,
    ],
    [
      "report-volley-form",
      "エネミーレポート HOUND / VOLLEY の形態",
      "五脚と浮遊する背骨を持つHOUNDの派生個体。地上を回り込みます。",
      O,
    ],
    [
      "report-volley-attack",
      "エネミーレポート HOUND / VOLLEY の攻撃",
      "扇状にエネルギー弾を放ちます。接近した対象にはパルスを発します。",
      O,
    ],
    [
      "report-leaper-form",
      "エネミーレポート HOUND / LEAPER の形態",
      "五脚を縮めて跳躍し、壁を足場に再び飛び出します。",
      O,
    ],
    [
      "report-leaper-attack",
      "エネミーレポート HOUND / LEAPER の攻撃",
      "着地に続いて、周囲へパルスを発します。",
      O,
    ],
    [
      "report-pleat-form",
      "エネミーレポート PLEAT の形態",
      "獣の背を思わせる乾いた被覆。その下の支持肢は、外から見える体形と一致しません。低く追跡する途中で背が折り重なり、硬化した層が金属のように光ります。",
      O,
    ],
    [
      "report-pleat-attack",
      "エネミーレポート PLEAT の攻撃",
      "胸部の襞が開き、姿勢を沈めます。襞が閉じると、地面に沿って前方へ衝撃波が走ります。",
      O,
    ],
    [
      "report-prism-form",
      "エネミーレポート PRISM の形態",
      "浮遊する非対称多面体。離れた間合いを保ち、射線が通る遠い隊員を優先します。",
      O,
    ],
    [
      "report-prism-attack",
      "エネミーレポート PRISM の攻撃",
      "照準した地点へ、低速の強いエネルギー弾を放ちます。",
      O,
    ],
    [
      "report-ray-form",
      "エネミーレポート RAY の形態",
      "エイのような平面、ウナギを思わせる推進尾と中央の縦穴。羽ばたかず空中を遊泳し、隊員の上方を旋回します。",
      O,
    ],
    [
      "report-ray-attack",
      "エネミーレポート RAY の攻撃",
      "離れた隊員へ照準を向け、斜め下へ電撃杭を放ちます。発射に先立ち、中央の縦穴に光が集まります。",
      O,
    ],
    [
      "report-foundry-form",
      "エネミーレポート FOUNDRY ZERO の形態",
      "壁・レール・リングからなる移動工場。大きな支持脚で身体を支え、隊員の集まる場所へ向きを変えます。",
      O,
    ],
    [
      "report-foundry-attack",
      "エネミーレポート FOUNDRY ZERO の攻撃",
      "隊員の集まる場所へ予兆が広がり、周囲を攻撃します。損傷すると周囲の物質からPRISMを形成し、前脚と上体を高く持ち上げ、踏み下ろしと同時に攻撃します。",
      O,
    ],
    [
      "report-catena-form",
      "エネミーレポート CATENA の形態",
      "ミミズのようにうねり、多数の脚で地面を這う機械型の巨体。ひとつの頭部に十四の胴節がつながり、広い範囲を移動します。胴節が壊れるとその位置で分離し、両側の鎖が加速して隊員を追います。",
      O,
    ],
    [
      "report-catena-attack",
      "エネミーレポート CATENA の攻撃",
      "頭部と胴節の最大8か所の発光器官が隊員へ向き、光を集めてから細いレーザーを放ちます。連結中は頭から尾へ波打つように跳び、赤い予告円へ着地攻撃を行います。予告円の外へ退避してください。頭部を失うと、そのとき頭部側につながっていた残存節と同じ数の個体が現れます。現れる種類はマップによって異なります。",
      O,
    ],
  ],
);

/** 4-9 読み上げ：ステージの作戦説明（26行）。作戦説明の読み上げは本文ごと廃止が確定。 */
const BRIEF = rows(
  "control",
  "brief",
  "none",
  { tag: "common", priority: "announce" },
  [
    [
      "brief-01",
      "ステージ01「前哨掃討」の作戦説明",
      "HOUNDと散射派生で移動・射撃の基本を確認。ボスなし。",
      O,
    ],
    [
      "brief-02",
      "ステージ02「跳躍する影」の作戦説明",
      "跳躍派生が初登場。横からの跳躍に備える。",
      O,
    ],
    [
      "brief-03",
      "ステージ03「エネルギー弾の交差点」の作戦説明",
      "PRISMを優先して倒し、射線を確保。",
      O,
    ],
    [
      "brief-04",
      "ステージ04「形成炉迎撃」の作戦説明",
      "初のFOUNDRY ZERO。護衛を倒して攻撃の隙を作る。",
      O,
    ],
    [
      "brief-05",
      "ステージ05「倉庫上空」の作戦説明",
      "RAYが初登場。第2波の浮遊装甲球は撃ち続けると硬化、撃ち止めで解除。",
      O,
    ],
    [
      "brief-06",
      "ステージ06「装甲回廊」の作戦説明",
      "CATENAが初登場。長い胴体と護衛をまとめて狙う。",
      O,
    ],
    [
      "brief-07",
      "ステージ07「物流争奪」の作戦説明",
      "ボスなしの4連戦。各波で優先目標を切り替える。",
      O,
    ],
    [
      "brief-08",
      "ステージ08「開幕の王」の作戦説明",
      "開始直後にFOUNDRY ZERO。撃破後にも掃討戦が続く。",
      O,
    ],
    [
      "brief-09",
      "ステージ09「空域封鎖」の作戦説明",
      "空中のRAYと遠距離のエネルギー弾を同時に処理。",
      O,
    ],
    [
      "brief-10",
      "ステージ10「地底の反攻」の作戦説明",
      "中盤のCATENAを越え、最後は雑魚の増援を掃討。",
      O,
    ],
    [
      "brief-11",
      "ステージ11「双冠の門」の作戦説明",
      "FOUNDRY ZERO2体が初めて同時出現。片側から崩す。",
      O,
    ],
    [
      "brief-12",
      "ステージ12「工業区奔流」の作戦説明",
      "ボスなしの大群戦。短い5波で位置取りを試す。",
      O,
    ],
    [
      "brief-13",
      "ステージ13「異形共闘」の作戦説明",
      "FOUNDRY ZEROとCATENAが同時出現。間に挟まれない。",
      O,
    ],
    [
      "brief-14",
      "ステージ14「王の待ち伏せ」の作戦説明",
      "開幕から2体と護衛。撃破後も空陸の追撃が続く。",
      O,
    ],
    [
      "brief-15",
      "ステージ15「重装迎撃線」の作戦説明",
      "地上混成を突破し、CATENAを迎撃。クリアで15-Aを解放。",
      O,
    ],
    [
      "brief-16",
      "ステージ16「晶脈突破」の作戦説明",
      "地底の射線を確保し、CATENAと護衛を突破。",
      O,
    ],
    [
      "brief-17",
      "ステージ17「草原の双炉」の作戦説明",
      "広い草原で二つの形成炉を迎撃。",
      O,
    ],
    [
      "brief-18",
      "ステージ18「炉心突破戦」の作戦説明",
      "異なる護衛構成を突破し、最奥の形成炉へ。",
      O,
    ],
    [
      "brief-19",
      "ステージ19「雪峡の封鎖線」の作戦説明",
      "空陸混成の封鎖線を崩し、二つの炉を迎撃。",
      O,
    ],
    [
      "brief-20",
      "ステージ20「異翼の来襲」の作戦説明",
      "草原に現れた大型個体HARROWを迎撃。",
      O,
    ],
    [
      "brief-21",
      "ステージ21「残響の街区」の作戦説明",
      "分散した群れを短い三波で掃討。",
      O,
    ],
    [
      "brief-22",
      "ステージ22「蒼鉄再侵攻」の作戦説明",
      "護衛の増援を突破して双炉へ。",
      O,
    ],
    [
      "brief-23",
      "ステージ23「白嶺の反攻」の作戦説明",
      "空中群と地上群が交互に押し寄せる。",
      O,
    ],
    [
      "brief-24",
      "ステージ24「最後の形成炉」の作戦説明",
      "前衛を崩し、最後の双炉を突破する。",
      O,
    ],
    [
      "brief-25",
      "ステージ25「異翼の決戦」の作戦説明",
      "混成群の奥でHARROWとの最終戦に挑む。",
      O,
    ],
    [
      "brief-15a",
      "分岐ステージ15-A「異翼の痕跡」の作戦説明",
      "草原の奥部で観測されたHARROWを調査する。",
      O,
    ],
  ],
  { blocked: () => "abolished" },
);

export const TUTORIAL_VOICE_LINES: readonly ControlVoiceLine[] = [
  // 誘い（tut-offer）はホームで1本だけ取得するため、訓練の一括読み込みには含めない。
  ...TRAINING.map((line) =>
    line.id === "tut-offer" ? { ...line, scene: "guide" as const } : line,
  ),
  ...GUIDE,
];
/** 管制AIセットの147行（voice-proposal の管制AI・女性の全行）。 */
export const CONTROL_SET_LINES: readonly ControlVoiceLine[] = [
  ...ANNOUNCE,
  ...SUPPLY,
  ...COOP,
  ...SYSTEM,
  ...WEAPON_NAMES,
  ...REPORT,
  ...BRIEF,
];
export const CONTROL_VOICE_LINES: readonly ControlVoiceLine[] = [
  ...TUTORIAL_VOICE_LINES,
  ...CONTROL_SET_LINES,
];

const BY_ID = new Map(CONTROL_VOICE_LINES.map((line) => [line.id, line]));

export function controlVoiceLine(id: string): ControlVoiceLine | undefined {
  return BY_ID.get(id);
}

/** 再生候補になりうる行（採用済みで、止める理由がない）。 */
export const playableLine = (line: ControlVoiceLine) =>
  line.adopted && !line.blocked;

/** 場面ごとの読み込み対象（採用済み・有効な行だけ）。 */
export function controlVoiceIdsForScene(scene: ControlVoiceScene) {
  return CONTROL_VOICE_LINES.filter(
    (line) => line.scene === scene && playableLine(line),
  ).map((line) => line.id);
}
