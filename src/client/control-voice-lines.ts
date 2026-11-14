/**
 * 管制AI音声の台詞定義表（W0）。
 * 正本: docs/tutorial-proposal-20261113.md §6（ID・トリガー・文面・タグ・制作優先度）と §8-1（再生の決まり）。
 * 文面は字幕にも使う。タグと再生優先度はコードではなくこの表のデータで持つ。
 */

/** 音声セット。フォルダは `voice-<set>-<voice>-v<version>/`。 */
export type ControlVoiceSet = "tutorial" | "control";
/** 共通＝人数に関係なく正しい / solo＝ソロのみ / multi＝協力の経路のみ。 */
export type ControlVoiceTag = "common" | "solo" | "multi";
/**
 * 再生優先度（§8-1）。
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

export interface ControlVoiceLine {
  /** クリップ名（拡張子なし）。台詞IDとして使う。 */
  id: string;
  set: ControlVoiceSet;
  /** 鳴らすきっかけ（提案書のトリガー列の要約）。 */
  trigger: string;
  /** 台詞（字幕にも使う）。 */
  text: string;
  tag: ControlVoiceTag;
  priority: ControlVoicePriority;
  production: ControlVoiceProduction;
  /** false の行は再生候補にしない（仕組みが未実装の場面など）。 */
  enabled?: boolean;
}

const tut = (
  id: string,
  trigger: string,
  text: string,
  tag: ControlVoiceTag,
  priority: ControlVoicePriority,
  production: ControlVoiceProduction,
  enabled = true,
): ControlVoiceLine => ({
  id,
  set: "tutorial",
  trigger,
  text,
  tag,
  priority,
  production,
  ...(enabled ? {} : { enabled: false }),
});

/** チュートリアル34本（提案書 §6 の表どおり）。 */
export const CONTROL_VOICE_LINES: readonly ControlVoiceLine[] = [
  // 第1層 基礎訓練
  tut(
    "tut-offer",
    "初めて「ソロ → 進撃」に入ったときの誘い",
    "基礎訓練を受けますか。操作をひととおり確認できます。あとから受けることもできます。",
    "common",
    "guide",
    "recommended",
  ),
  tut(
    "tut-intro",
    "T0 訓練の開始ボタン",
    "基礎訓練を開始します。ここでは、報酬も失敗もありません。操作をひとつずつ確認しましょう。",
    "common",
    "tutorial",
    "required",
  ),
  tut(
    "tut-move",
    "T1 開始（T0の台詞の終了後）",
    "まず、移動です。訓練場の中を、自由に動いてみてください。",
    "common",
    "tutorial",
    "required",
  ),
  tut(
    "tut-look",
    "T2 開始（T1達成: 移動8m）",
    "次に、視点です。周囲を見回してください。",
    "common",
    "tutorial",
    "required",
  ),
  tut(
    "tut-fire",
    "T3 開始（T2達成: 視点90度）",
    "正面の標的を狙って、射撃してください。射撃は、押し続けている間つづきます。",
    "common",
    "tutorial",
    "required",
  ),
  tut(
    "tut-reload",
    "T4 開始（T3達成: イベント hit 5回）",
    "弾を撃ち切ると、自動で装填が始まります。装填ボタンで、好きなときに装填することもできます。一度、装填してください。",
    "common",
    "tutorial",
    "required",
  ),
  tut(
    "tut-swap",
    "T5 開始（T4達成: reload の完了）",
    "武器は、二つ持って出撃します。もう一つの武器に、切り替えてください。",
    "common",
    "tutorial",
    "required",
  ),
  tut(
    "tut-dodge",
    "T6 開始（T5達成: slot の変化）",
    "回避です。すばやく動いて、敵の攻撃をかわします。一度使うと、少しの間は使えません。回避してください。",
    "common",
    "tutorial",
    "required",
  ),
  tut(
    "tut-jump",
    "T7 開始（T6達成: evade の発動）",
    "ジャンプもできます。一度、跳んでみてください。",
    "common",
    "tutorial",
    "required",
  ),
  tut(
    "tut-kill",
    "T8 開始（T7達成: y の変化）",
    "実戦形式に移ります。訓練標的を三体、撃破してください。",
    "common",
    "tutorial",
    "required",
  ),
  tut(
    "tut-drop",
    "T9 開始（T8達成: イベント kill 3回）",
    "敵を倒すと、武器や回復アイテムを落とすことがあります。近づくだけで回収できます。落ちている武器を、回収してください。",
    "common",
    "tutorial",
    "required",
  ),
  tut(
    "tut-drop-rule",
    "T9 達成（pending が1個増えた）",
    "回収した武器は、作戦を達成すると持ち帰れます。一度の出撃で持ち帰れる数には、限りがあります。",
    "common",
    "tutorial",
    "required",
  ),
  tut(
    "tut-recover",
    "T10 開始（tut-drop-rule の終了後）",
    "体力は、しばらく攻撃を受けなければ、半分まで自動で回復します。",
    "common",
    "tutorial",
    "required",
  ),
  tut(
    "tut-medkit",
    "T10 の2本目（tut-recover の終了後）",
    "危険なときは、救急箱を使ってください。一度の出撃で一回だけ、体力を全回復できます。",
    "solo",
    "tutorial",
    "required",
  ),
  tut(
    "tut-complete",
    "T11 修了",
    "基礎訓練、修了です。訓練は、タイトルのチュートリアルから、いつでもやり直せます。",
    "common",
    "tutorial",
    "required",
  ),
  tut(
    "tut-ack-1",
    "T1〜T9 のステップ達成（3種から直前と違うもの）",
    "確認しました。",
    "common",
    "ack",
    "required",
  ),
  tut(
    "tut-ack-2",
    "T1〜T9 のステップ達成（3種から直前と違うもの）",
    "良好です。",
    "common",
    "ack",
    "recommended",
  ),
  tut(
    "tut-ack-3",
    "T1〜T9 のステップ達成（3種から直前と違うもの）",
    "その調子です。",
    "common",
    "ack",
    "recommended",
  ),
  tut(
    "tut-nudge",
    "同じステップで20秒達成がない（1ステップに1回まで）",
    "画面の案内を見ながら、操作を試してください。",
    "common",
    "ack",
    "recommended",
  ),
  tut(
    "tut-skip",
    "一時停止から「訓練を終了」を選んだ",
    "訓練を終了します。",
    "common",
    "tutorial",
    "optional",
  ),
  // 第2層 初回ガイド
  tut(
    "tut-gear",
    "G1 進撃の出撃準備を初めて開いた",
    "出撃準備です。ステージと難易度、持っていく二つの武器を選んで、出撃してください。",
    "solo",
    "guide",
    "required",
  ),
  tut(
    "tut-battle-multi",
    "G2 協力の最初の戦闘開始",
    "協力作戦、開始です。部隊で協力して、すべてのウェーブの敵を倒してください。",
    "multi",
    "guide",
    "required",
  ),
  tut(
    "tut-buddy-battle",
    "G3 バディを連れた最初の戦闘の開始10秒後",
    "バディが同行しています。バディは、自動で攻撃します。スキルボタンで固有スキルを発動、長押しで、力をためて強化できます。",
    "common",
    "guide",
    "required",
  ),
  tut(
    "tut-base",
    "G6 基地を初めて開いた",
    "基地です。武器の整理、アクセサリ、兵士の育成、バディ、補給ポッドは、ここから利用できます。",
    "common",
    "guide",
    "required",
  ),
  tut(
    "tut-supply",
    "G9 補給ポッドを初めて開いた",
    "補給ポッドです。補給券を使って、武器やバディ、武装片を受け取れます。",
    "common",
    "guide",
    "recommended",
  ),
  tut(
    "tut-buddy-menu",
    "G10 バディ画面を初めて開いた（starterChosen が false）",
    "バディの編成です。最初のバディを一体、選んでください。選んだバディは、進撃作戦に同行します。",
    "common",
    "guide",
    "required",
  ),
  tut(
    "tut-survival",
    "G11 生存戦の出撃準備を初めて開いた",
    "生存戦です。専用の武器ひとつで出撃し、強化カードを選びながら、できるだけ長く生き延びてください。",
    "common",
    "guide",
    "required",
  ),
  tut(
    "tut-card",
    "G12 生存で初めてのカード3択",
    "三枚のカードから、強化をひとつ選んでください。同じ強化を重ねると、段階が上がります。",
    "common",
    "guide",
    "required",
  ),
  tut(
    "tut-fusion",
    "G13 生存で融合が初めて候補に出た",
    "融合が候補に現れました。二つの強化が、ひとつにまとまります。",
    "common",
    "guide",
    "optional",
  ),
  tut(
    "tut-defense",
    "G14 防衛戦の最初の出撃",
    "防衛戦です。拠点を守りながら、戦ってください。拠点の耐久は、画面の上で確認できます。",
    "common",
    "guide",
    "recommended",
  ),
  tut(
    "tut-lobby",
    "G16 協力ロビーに初めて入った",
    "協力ロビーです。装備を確認して、準備完了を押してください。全員の準備が整うと、部隊長が出撃を開始します。",
    "multi",
    "guide",
    "required",
  ),
  tut(
    "tut-loot-multi",
    "G17 協力の最初の戦闘の開始20秒後",
    "戦利品は、隊員ごとに別々に用意されます。取り合いにはなりません。",
    "multi",
    "guide",
    "recommended",
  ),
  tut(
    "tut-revive",
    "G17 tut-loot-multi の後／初めて味方が倒れたとき",
    "倒れた味方に近づいて、蘇生ボタンを押し続けると、味方を復帰させられます。",
    "multi",
    "guide",
    "required",
  ),
  // G18 は敵情報開示の仕組みが未実装のため、実装後に有効化する。
  tut(
    "tut-enemy-info",
    "G18 ステージ初クリアで敵情報が開示されたとき",
    "ステージクリアにより、このステージの敵情報が開示されました。",
    "common",
    "guide",
    "optional",
    false,
  ),
];

const BY_ID = new Map(CONTROL_VOICE_LINES.map((line) => [line.id, line]));

export function controlVoiceLine(id: string): ControlVoiceLine | undefined {
  return BY_ID.get(id);
}
