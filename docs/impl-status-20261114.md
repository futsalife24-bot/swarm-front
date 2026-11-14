# 実装状態：管制AI音声基盤 W0（2026-11-14）

担当: Claude Code（Opus） / ブランチ: `claude/voice-w0-20261114`（main `a3c089ca` から） / ブリーフ: `docs/impl-brief-opus-20261114.md`

## 着手（2026-11-14）
- ブリーフ・参照資料3件（tutorial-proposal / voice-proposal / impl-brief-20261113）を読了。
- 範囲は W0（管制AI再生基盤）のみ。merge・push・公開はしない。

## 節目：実装（2026-11-14）

### 追加・変更したファイル
| ファイル | 内容 |
| --- | --- |
| `src/client/control-voice-lines.ts`（新規） | 台詞定義表。チュートリアル34本を提案書 §6 のとおり登録。各行に ID（クリップ名）／セット／トリガー／文面（字幕兼用）／タグ（common・solo・multi）／再生優先度／制作優先度（必須・推奨・余力）／有効フラグ を**データとして**保持 |
| `src/client/control-voice.ts`（新規） | 再生基盤。声の選択（hiromi / hiyori / yoko、既定 hiromi、端末保存）、規約パスの組み立て、タグによる絞り込み、再生キュー `ControlVoiceQueue` |
| `src/client/audio.ts`（変更） | `Sound` に管制AIの再生口を追加（`controlVoice`、`prepareControlVoice()`、`setControlVoice()`）。既存の効果音・兵士ボイス・敵の声の処理は変更なし |
| `tests/control-voice.test.ts`（新規）・`vitest.config.ts` | 単体テスト15件を追加し、`npm test` の対象に登録 |

### 設計判断
1. **再生キュー（提案書 §8-1 に準拠）**: 発話は同時に1本。再生優先度は5区分。
   - `warning`（警告系）: `tutorial` / `ack` / `guide` の再生中なら止めて割り込む。逆はしない。`warning`・`announce` の再生中は捨てる。
   - `announce`（通常アナウンス）: 再生中なら捨てる（現行 `speak()` と同じ）。
   - `tutorial`（基礎訓練の説明）: 再生中なら最新の1本だけ待たせる（たまらない）。
   - `ack`（相づち `tut-ack-*`・促し `tut-nudge`）: 再生中なら捨てる。
   - `guide`（初回ガイド・`tut-offer`）: 再生中なら最大5秒待ち、過ぎたら声を諦める（字幕は呼び出し側が出す）。
   - 重複抑止: 再生中・待機中と同じIDの要求は `duplicate` で無視。
   - 警告で中断された説明は再開しない。待機中の1本は警告の終了後に流れる。
2. **タグの絞り込み**: キューの `mode`（solo / multi）に対し、common は常に、solo / multi は一致時のみ再生候補。判定は「協力の経路で入ったか」で呼び出し側が設定する（提案書 §4-3）。
3. **既定の声はヒロミ**。選択は `localStorage` の新キー `swarm-front-control-voice-v1` に保存。保存先が無い・不正値・例外時は既定に戻る。既存の保存データ（`ProgressSave` など）には触れていない。
4. **音量は SE に追随**: 管制AIの声は SE と同じ master ゲインを通る。SE 音量0・画面非表示・AudioContext 停止中は再生しない（`unavailable`）。全体停止（`stop()`、画面を隠す、SE を0にする）で再生中と待機中を止める。
5. **読み込みを増やさない（§8-4-1）**: 起動時の一括読み込みには載せない。`prepareControlVoice(ids)` で、選択中の声の指定台詞だけを取得・展開する。
6. **実ファイルが無くても動く**: 取得失敗（404・通信エラー）・展開失敗・未読み込みはすべて例外にせず、再生要求は `unavailable` を返す。テストで実ファイル無しの状態を確認済み。
7. **規約パス**: `public/assets/audio/voice-<set>-<voice>-v<N>/<clip>.wav`。チュートリアルは `voice-tutorial-hiromi-v1/tut-intro.wav` のようになる（先行ブリーフの受け渡しフォルダ名 `voice-tutorial-hiromi-v1` に合わせた）。版数はセットごとに定数で持つ。
8. **範囲外として組み込まなかったもの**: `brief-*`（廃止確定）、`anomaly-*`（保留。`anomaly-new` も今回触れていない）、管制AI147行・隊長・兵士・バディの組み込み（フェーズ2）、チュートリアル本体 W2〜W5、声の選択UI（設定画面）、訓練中の兵士の掛け声停止（§8-1 の3。W3 で訓練モードと一緒に配線する）。
9. `tut-enemy-info`（G18）は、敵情報開示の仕組みが未実装のため `enabled: false`（再生要求は `disabled`）。
10. `tut-reload` の文面は本ブリーフの指示どおり提案書 §6 の表の文（「弾を撃ち切ると、自動で装填が始まります。…」）を採用。

### テスト結果（2026-11-14）
- `npm run typecheck`: 成功（エラー0）
- `npm test`: 成功（175ファイル / 1784件すべて成功。追加分 `tests/control-voice.test.ts` 15件を含む）
- 実ブラウザでの確認は未実施（W0 は画面・配線を持たないため。音声実物も未着）。

## 要確認
1. **`tut-reload` の文面の食い違い**: 先行ブリーフ（impl-brief-20261113）は「弾切れになると、自動で装填が始まります。…」を正としていたが、本ブリーフは「提案書 §6 の表が正」と指示。本ブリーフ優先で §6 の文（「弾を撃ち切ると、…」）を採用した。生成済み音声の実際の文面と一致しているか確認したい。
2. **管制AI本体のフォルダ名**: 3声分のフォルダ名が未確認。仮に `voice-control-<voice>-v1/` とした（提案書の `voice-control-v1/` に声名を挟んだ形）。実物の受け渡し時に合わせる。定数1か所の変更で済む。
3. **チュートリアル音声の声**: 先行ブリーフでは34本はヒロミのみ。ヒヨリ・ヨウコを選んだ場合、チュートリアルの声は `unavailable`（字幕のみ）になる。ヒロミへ代替するか、3声分を作るかは未決（提案書は3声で生成する前提）。
4. **声の選択UI**: 保存と切り替えの口（`setControlVoice`）だけ用意し、設定画面のUIは作っていない。提案書 W0 は「設定画面」を含むが、本ブリーフの範囲列挙に無いため保留。
5. **再生優先度の割り当て**: `tut-offer` を `guide`、`tut-skip` を `tutorial`、`tut-nudge` を `ack` とした（提案書に区分の明記なし）。
6. **配信形式（判断点4）**: WAV のまま規約パスで参照している。圧縮形式に変える場合は拡張子の定数を変える必要がある。
7. 参照資料4件（`docs/impl-brief-*.md`、`docs/*-proposal-20261113.md`）はビビが配置した未追跡ファイルのため、commit に含めていない。

## 完了（2026-11-14）
- W0（管制AI再生基盤）完了。完了条件（typecheck・npm test 成功、状態ファイル記録）を満たした。
- ブランチ `claude/voice-w0-20261114` にローカル commit 済み。push・main への merge・公開はしていない。
- ブリーフの指示どおり、ここで停止する。フェーズ2以降（音声セット組み込み、チュートリアル W2〜W5）は未着手。

---

# フェーズ2：音声セット組み込み（2026-11-14）

担当: Claude Code（Opus） / ブランチ: `claude/voice-w0-20261114`（W0 `f3649e6e` の続き） / ブリーフ: `docs/impl-brief-phase23-20261114.md`

## 確定事項の反映
1. `tut-reload` の文面を生成済み音声の採用文言（「弾切れになると、自動で装填が始まります。…」）へ変更（字幕・定義表とも）。W0 要確認1は解消。
2. 管制AIのフォルダ名 `voice-control-<voice>-v1/` を正式採用（受け渡しフォルダ名と一致）。W0 要確認2は解消。
3. チュートリアル音声のフォールバック（**暫定仕様**）: 選択中の声が収録されていないセットは、ヒロミで再生する。判定は `src/client/control-voice.ts` の **データ** `CONTROL_VOICE_SET_VOICES`（セットごとの収録済みの声。現在 tutorial は `["hiromi"]` のみ）と `CONTROL_VOICE_FALLBACK`（`"hiromi"`。`null` にすると代替せず字幕だけ）で切り替える。3声分が届いたら tutorial の一覧に声を足すだけで、選んだ声で鳴る。W0 要確認3は解消。

## やったこと
| 項目 | 内容 |
| --- | --- |
| 配置 | `public/assets/audio/voice-control-{hiromi,hiyori,yoko}-v1/` 各111本、`voice-tutorial-hiromi-v1/` 34本（計367本・約158MB、WAV 44.1kHz モノラル16bit）。inbox からコピー（inbox 側は残置）。**brief-*（26本×3）と anomaly-<名前>（10本×3）はコピーしていない**（組み込まない指示のため）。inbox の `plain-backup/`・`voice-tutorial-hiromi-v1/backup/`（tut-reload の旧版）・兵士/隊長/バディのセットも対象外として触れていない |
| 定義表 | `src/client/control-voice-lines.ts` に管制AIの **全147行** を登録（チュートリアル34行と合わせ181行）。各行に ID・セット・カテゴリ・読み込み場面・トリガー・字幕テキスト・タグ（common/solo/multi）・再生優先度・制作優先度・**採用フラグ（adopted）**・止める理由（blocked）をデータで持つ |
| 採用フラグ | 管制AIは「必須＋推奨＝採用、余力＝不採用」で初期化（147行中 採用64・不採用83。採用のうち anomaly 識別名10行は保留のため、実際に再生候補になるのは54行）。ファイルは消さず、`adopted` の書き換えだけで出し分けできる。不採用の行は再生要求が `unadopted` になり、読み込みもしない |
| brief-* | 26行を登録したうえで `blocked: "abolished"`（再生・読み込みの対象外）。ファイルは配置していない |
| anomaly-* | 識別名10行は `blocked: "on-hold"`（保留）。`anomaly-new` は通常の行として採用（初遭遇の告知で再生） |
| 武器名 | 12行を現状の文言のまま登録（余力のため不採用）。読みの差し替えはフォルダ版数で反映する |
| 再生基盤 | `controlVoicePath` がセットの収録状況に従って声を選ぶ（上記3）。`Sound.say(id)`（その場で1本取得→鳴らす。1.5秒以内に用意できなければ声は諦める）、`Sound.announce(id, key)`（同じ key では二度鳴らさない）、`Sound.prepareControlScene(scene)`（場面の採用分だけ取得）を追加 |
| 発話は同時に1本 | 管制AIが話し始めたら兵士の掛け声を止め、管制AIの発話中は兵士の掛け声を出さない。`Sound.soldierVoiceEnabled`（基礎訓練で false にする口）を追加 |
| 戦闘中の合図 | 新規 `src/client/control-announcer.ts`。World の変化から wave-clear / hp-danger（30秒間隔）/ boss-detected（15秒間隔）/ base-under-attack（20秒間隔）/ ally-down / self-down / revived を拾う。中断・非表示・訓練中は基準を取り直し、古い出来事をあとから鳴らさない |
| 補給演出 | 新規 `src/client/supply-voice.ts`。演出側（public/supply-reveal）は変えず、見出し `.gx-status` とカットイン名 `.gx-ghost` の変化から supply-request / descend / detect / confirmed / complete / ssr / buddy を鳴らす |
| 読み込み | 起動時の一括読み込みには載せない。戦闘の読み込み画面で `battle` 場面の採用分、補給画面で `supply`、協力の接続時に `coop` を、選択中の声だけ取得。事前ダウンロード（asset-download-catalog）には入れていない |

### 配線した採用行（呼び出し場所）
- 進撃ソロ（`playtest-app.ts`）: adv-sortie / daily-sortie（出撃）、stage-clear（回収時間）、adv-failed（敗北）、result-win（戦果）、daily-victory / daily-destroyed / daily-ended、wave-incoming（増援まで10秒）、anomaly-new（初遭遇）、loading、title（起動後最初のホーム）/ home（以降）、pick-operation、補給の見出し
- 協力（`main.ts`）: adv-sortie / adv-complete / adv-failed / result-win、loading、gear-ready、coop-connected / coop-disconnect（切断1回につき1回）/ coop-closed / coop-member-join / coop-member-left / coop-all-ready / coop-begin。キューの mode は協力の経路なら multi
- 生存・防衛（`front-app.ts`）: srv-sortie / def-sortie / adv-sortie、結果の srv-extract / srv-ended / adv-complete / adv-failed、levelup、treasure、boss-reward、final-large、time-warning、return-soon、loading。協力時は multi
- 戦闘共通（`audio.ts` 経由）: 上記 control-announcer の各行

### 採用だが未配線の行（理由）
- `tutorial-combat`（G2）・`guide-step-3`（G5）: フェーズ3の初回ガイドで配線する
- `supply-launch`（射出の停止点）、`supply-sr`（SR+ への昇格）、`supply-buddy-new` / `supply-buddy-join`（結果表示）: 演出側の内部状態で、見出しの変化からは取れない。演出側（public/supply-reveal/core.js）に通知を足す必要がある
- `coop-resync`: 通信内部の切断理由で、画面の状態文として届かない
- 生存側の協力ロビー（`front-app.ts` のロビー）の coop-* : 進撃協力（main.ts）だけ配線した

## テスト結果（フェーズ2完了時点）
- `npm run typecheck`: 成功
- `npm test`: 成功（176ファイル / 1794件。追加・更新: `tests/control-voice.test.ts`（定義表181行・採用初期値・ブロック・全採用行の実ファイル存在・声の代替）、`tests/control-announcer.test.ts`（新規、戦闘合図と補給見出しの対応））
- 実ブラウザでの再生確認は未実施。

## 要確認（フェーズ2）
1. **solo / multi / 共通 タグの割り当て（147行）**: 棚卸しの供給が無かったため、提案書の記述から仮に決めた。multi: coop-*、ally-down、self-down、revived、squad-choosing。solo: daily-*（daily-done含む）、stage-clear、medkit、branch-ready、resume-run、return-save、tutorial-combat。ほかは common。差し替えは表のデータ変更だけで済む。
2. **再生優先度の割り当て**: warning＝hp-danger、ally-down、self-down、boss-detected、final-large、time-warning、base-under-attack、spawn-warning、coop-disconnect。guide＝tutorial-combat / growth / accessory、guide-step-1〜4。ほかは announce。
3. **同じ場面の2本の取り合い**: 発話は1本で announce は待たないため、ソロの回収時間は adv-complete ではなく stage-clear を鳴らす（作戦キューの画像は従来どおり adv-complete）。ソロ・協力の敗北は adv-failed だけ鳴らし、result-lose は鳴らさない。
4. **title / home**: 起動後最初のホームで title、以降のホームで home を鳴らす形にした。ただし初回表示は利用者の操作前で AudioContext が止まっているため、title は多くの場合鳴らない（字幕扱いの文言もない）。
5. **anomaly-new の扱い**: 「現状維持」を「初遭遇の告知の行として通常どおり扱う」と解釈し、採用・配線した。鳴らさない意図だった場合は `blocked: "on-hold"` を付けるだけで止まる。
6. **容量**: 管制AI 3声＋チュートリアルで約158MB（WAV）。配信形式（判断点4・圧縮への変換）は未決のまま WAV で配置した。
7. **report-*（エネミーレポートの読み上げ20行）**: 余力のため不採用・再生操作も未実装。ファイルは配置した（データで出し分け）。保留扱い（anomaly 説明系）に含める意図なら `blocked` を付ける。

## 次
- フェーズ3（チュートリアル実装 W2〜W5）に着手する。

---

# フェーズ3：チュートリアル実装（W2〜W5 相当、2026-11-14）

担当: Claude Code（Opus） / ブランチ: `claude/voice-w0-20261114`（フェーズ2 `80d0f56e` の続き）

## 初期値（提案書 §9 どおり）
- 基礎訓練は招待制（新しい進行で初めて「ソロ → 進撃」に入るとき1回だけ誘う。断れる）。タイトルの「チュートリアル」から何度でも受けられる。
- 既存のプレイヤーへは自動表示しない: 記録が無い端末で進撃の保存データ（ProgressSave）が既にある場合、訓練の誘いと初回ガイドをすべて既読として記録を作る（判断点5の推奨）。
- ガイド音声は SE 音量に従う（専用設定は作らない）。相づちは3種（直前と違うものを選ぶ）。
- tut-enemy-info（G18）は無効のまま（`blocked: "unimplemented"`。ガイド定義にも入れていない）。
- ゲームルール・報酬・保存データの仕様は変えていない。進撃の ProgressSave（既存の tutorials 3件を含む）は読み書きしない。

## やったこと
| 作業 | ファイル | 内容 |
| --- | --- | --- |
| W2 訓練用の世界 | 新規 `src/shared/tutorial.ts` | 既存の訓練射撃場（`createTrainingWorld`）を土台に、T8 用の倒せる訓練標的3体（攻撃しない。体力60）、T9 用の見本の武器1個を追加。`stepTutorial` は毎tick 報酬を空にし、ドロップは見本1個だけ、未確定戦利品は回収ステップの間だけ数えて他では空にする。抜けるときは `clearTutorialLoot` で戦利品を消す |
| W3 進行役 | 新規 `src/client/tutorial-run.ts` | T0〜T11 の状態機械と達成判定（移動8m・視点90度・命中5・装填の開始→完了・切替・回避・ジャンプ・撃破3・回収）。相づち（直前と違う1本）、20秒で促し1回、10秒で「この手順を飛ばす」、T9 達成後は tut-drop-rule の長さの見込みだけ待って T10、T10 は2本を順に流し「次へ」か自動で T11。台詞の長さは文字数からの見込み（約5.5字/秒）で扱い、声が無くても同じ速さで進む。時間は一時停止中に進まない |
| W3 案内表示 | `src/client/training-app.ts`、`src/menu-ui.css` | `?training=1&tutorial=1` で基礎訓練モード。既存の訓練射撃場の上部帯をそのまま使い、1行の案内（字幕を兼ねる）・進行（n / 11）・「この手順を飛ばす」「次へ」「訓練を終える」を出す。タッチと PC で操作説明を出し分ける。一時停止から「訓練を終了」（tut-skip を流してから抜ける）。訓練中は兵士の掛け声を止め、選択中の声の訓練分（19本）だけを読み込む。既存の「試し撃ち」モードは変更なし |
| W4 入口と記録 | 新規 `src/client/tutorial-flags.ts`・`src/client/tutorial-launch.ts`、`src/client/tutorial-guide.ts`、`playtest-app.ts` | 既読・修了の記録は端末ごとの新キー `swarm-front-tutorial-v1`（見たIDの一覧だけ。進撃・生存・協力の3入口から読む）。タイトルの「チュートリアル」に「基礎訓練を始める」「初回ガイドをもう一度表示」を追加（再表示は誘い・修了の記録を残し、ガイドだけ未読に戻す）。初回の誘いダイアログ（tut-offer）。読み物の文言を今のボタン名に更新（「ソロ：進撃 または 生存」「協力：進撃 または 生存」、基地にバディ・補給ポッド・生存カードを追記） |
| W5 初回ガイド | 新規 `src/client/first-guides.ts`、`playtest-app.ts`・`main.ts`・`front-app.ts` | 各1回・止めない。1行の案内は既存の欄に出す（進撃の画面は状態欄 `.pt-status`、戦闘は HUD の状態欄、協力ロビーは状態文、生存側は既存の通知欄 `rebuild-notice`）。配線: G1 出撃準備、G2 ソロ（既存「戦闘の基本」に tutorial-combat を重ねる）・協力（進撃協力と生存協力の最初の戦闘）、G3 バディ同行の戦闘10秒後（スキル初発動か戦闘終了で既読。進撃ソロ・進撃協力）、G5 初めての戦果（勝利）、G6 基地、G9 補給ポッド、G10 バディ画面（最初の1体を選んだら既読）、G11 生存戦の出撃準備、G12 初めてのカード3択（選んだら既読）、G13 融合が初めて候補に出た、G14 防衛戦の最初の出撃、G16 協力ロビー（進撃協力・生存協力。自分の準備完了で既読）、G17 進撃協力の最初の戦闘20秒後に分配→6秒後に蘇生、初めて味方が倒れたときにも蘇生 |

- G4（stage-clear）・G15（daily-sortie）はフェーズ2の戦闘アナウンスのまま。G7・G8 は既存の文字案内のまま。G18 は未有効化。

## テスト結果（フェーズ3完了時点）
- `npm run typecheck`: 成功
- `npm test`: 成功（178ファイル / 1819件）。追加: `tests/tutorial.test.ts`（W2: 報酬・ドロップ・未確定戦利品を持ち出さない、標的の扱い、見本の回収 / W3: 12ステップ、各達成条件、T9→T10 の待ち、T10 の2本と自動進行、相づちの重複回避、20秒の促し・10秒の飛ばし、終了、タッチ/PC の出し分け）、`tests/tutorial-flags.test.ts`（新規・既存プレイヤーの初期値、記録キーの分離、再表示、保存不可時、ガイドの1回表示・完了判定・G3・G17・案内の表示時間）。`tests/control-voice.test.ts` に訓練の読み込み対象（19本、誘いは含めない）を追加。
- 実ブラウザ（ローカル開発サーバー・Edge ヘッドレス、`dist-validation/tutorial-check.mjs`、コミット対象外）:
  - 844×390 / 640×360 / 568×320 で基礎訓練の iframe を開き、T0 の開始画面 → 「訓練を始める」→ T1（移動）→ W キーで 8m 移動して T2（視点）へ進むことを確認。タッチ端末（640・568 はタッチ扱い）では「タッチ：左スティック」、PC では「PC：W A S D」と出し分け。上部帯（高さ80px）の1行案内は溢れなし、一時停止ボタンと重ならない。
  - 訓練の開始時に `voice-tutorial-hiromi-v1/` の訓練分だけを取得し、兵士以外の追加取得が無いことを確認（声の再生音そのものはヘッドレスのため未確認）。
  - タイトルの「チュートリアル」ダイアログに「基礎訓練を始める」「初回ガイドをもう一度表示」が1行で並ぶことを 844×390 で確認。
- **未確認**: タイトル画面では、自動操作の物理クリックが既存の画面遷移ガードに止められ（既存のタブ切替も同じく反応しなかった）、入口ボタン → iframe 生成は処理を直接呼んで確認した。実端末のタップでの入口操作、T3 以降の各ステップの実操作、初回ガイド（G1〜G17）の画面表示と声、協力・生存側の実画面、ボタン配置を変えた状態、実機の音声再生は未確認。

## 要確認（フェーズ3）
1. **G5・G7・G8 の声**: 流用元の `guide-step-3`・`tutorial-growth`・`tutorial-accessory` は管制AIの制作優先度が「余力」のため採用フラグの初期値で不採用。G5 は1行の案内だけ出て声は鳴らない（G7・G8 は既存の文字案内のまま）。鳴らす場合は定義表の `adopted` を true にするだけでよい。
2. **既存プレイヤーの判定**: 「記録が無く、進撃の保存データがある端末」を既存プレイヤーとした。生存だけ遊んだ端末（進撃の保存なし）は新規扱いになる。
3. **G17 の範囲**: 「戦利品は隊員ごとに別」は進撃協力の仕様（Drop.owner）のため、進撃協力（main.ts）だけで鳴らし、生存協力では鳴らしていない。G2・G16 は両方で鳴らす。
4. **T0→T1 のつなぎ**: 「T0 の台詞の終了後に T1」は、音声の終了を進行条件にしない決まりと両立させるため、T1 の台詞を再生キューの待ち（最新1本）に入れて T0 の直後に鳴らす形にした。画面テキストは開始直後から T1 になる。
5. **見本の武器**: 標準武器の1本目（STARTERS[0]）を ID `tutorial-sample` で置く。回収しても保存・報酬には入らない。
6. **基礎訓練中の生存・協力の入口**: 訓練はソロの場のみ（提案書どおり）。協力・生存側のタイトルには入口を足していない（生存側のタイトルの「操作ガイド」は既存のまま）。
7. **e2e テスト**: 既存の e2e（`e2e/*.spec.ts`）は旧ボタン名「ソロで出撃準備」を参照しており、本作業以前から現行 UI と合っていない。今回は触れていない（`npm run test:e2e` は未実行）。

## 完了
- フェーズ2・フェーズ3とも完了条件（`npm run typecheck` と `npm test` の成功、状態ファイルへの記録）を満たした。
- ブランチ `claude/voice-w0-20261114` にローカル commit。push・main への merge・公開はしていない。

---

# 公開前の仕様変更：音声の任意ダウンロード化・支給ボックス・ログインボーナス・ヒヨリ配布（2026-11-14〜15）

担当: Claude Code（Opus） / ブランチ: `claude/voice-w0-20261114`（フェーズ3 `f5995e2b` の続き） / ブリーフ: `docs/impl-brief-release-20261114.md`
（5時間制限で一度中断し、2026-11-15 に同じ作業ツリーから再開。中断前の変更はすべて残っていた。）

## §1 音声の任意ダウンロード化
| 項目 | 内容 |
| --- | --- |
| WAVの扱い | `public/assets/audio/voice-control-{hiromi,hiyori,yoko}-v1/`・`voice-tutorial-hiromi-v1/`（367本・WAV計約158MiB）を `assets-src/` へ `git mv`。公開ビルド（dist）にWAVは入らない（build後に `dist/assets/audio/voice-*` が無いことを確認）。原本はパック再生成のため保持（履歴の書き換えはしていない） |
| パック形式 | 声ごとに1ファイル `public/assets/voice-packs/control-voice-<voice>-v1.bin`。中身はMP3（モノラル44.1kHz・64kbps、全ブラウザの decodeAudioData で展開可）を目次付きで束ねた独自形式SFVP v1。生成は `node scripts/build-voice-packs.mjs <ffmpeg>`（同じ入力で同じバイトになることを確認）。容量・SHA-256は自動生成の `src/client/control-voice-pack-catalog.ts` |
| 取得と保存 | 新規 `src/client/control-voice-packs.ts`。設定で押したときだけ `fetch(cache:"reload")`（Service Worker の自動保存を通さない）→ 容量とSHA-256を検証 → Cache Storage `swarm-front-voice-packs-v1` に保存。再起動後も保存から読む。旧版（SHA不一致）は「更新あり」と表示し、鳴らさない。事前ダウンロード（asset-download）には入れていない |
| 再生基盤 | `control-voice.ts` の台詞キーを `voice-<set>-<voice>-v<N>/<id>` に変更し、`audio.ts` の `prepareControlVoice` は通信せず保存済みパックから引く。削除時は展開済みの声を捨てて再生を止める。未ダウンロード・旧版・削除後は `unavailable`（字幕だけで進行、エラーにしない）。展開中に追加された台詞を取りこぼさないよう `Sound.load()` を修正 |
| 設定UI | 新規 `src/client/control-voice-menu.ts/.css`。タイトル（進撃）と協力（main.ts）の「設定」→「管制AIボイス」。声ごとに1行（選択・名前・容量・状態・ダウンロード/削除/更新）。ヨウコは「未解放」で選択・DL不可。進行中は%表示 |

### 各パックの容量
| パック | 収録 | 容量 | 元WAV |
| --- | --- | ---: | ---: |
| `control-voice-hiromi-v1.bin` | 管制AI111本＋チュートリアル34本＝145本 | 6,197,594 B（5.91 MiB） | 64.3 MiB |
| `control-voice-hiyori-v1.bin` | 管制AI111本 | 4,382,297 B（4.18 MiB） | 45.4 MiB |
| `control-voice-yoko-v1.bin` | 管制AI111本 | 4,682,173 B（4.47 MiB） | 48.5 MiB |

## §2 ヒヨリの初起動配布
- タイトル（進撃・通常モード）を開いたとき、支給ボックスへ「管制AI『ヒヨリ』解放」を1回だけ入れる（ID `dist-control-voice-hiyori-20261114`、済み記録は箱の `granted`）。受け取って初めて解放され、設定の声選択でヒヨリを選べる。
- 既定の声はヒロミのまま。解放状態は新キー `swarm-front-control-voice-unlocks-v1`。声の選択キー `swarm-front-control-voice-v1` の意味は変えず、未解放の声が保存されていても読み込み時にヒロミへ戻す。ヨウコは配らない（未解放）。

## §3 支給ボックス
- 新規 `src/client/supply-box.ts`（データ・配布・受取）、`supply-box-ui.ts/.css`（画面）。保存は新キー `swarm-front-supply-box-v1` のみで、既存の進行保存（ProgressSave）の形式・キーは変更なし。
- 中身は `{id, source(login/distribution/event/compensation), title, detail, reward, at}`。報酬は現在 `coins` と `control-voice`（今後の種類は型に追加する）。未受取の上限100件。壊れた保存は上書きせず理由を表示。
- 受取は個別・一括（ヘッダーの「すべて受け取る」）。順序は 声の解放（冪等）→ 箱から外して保存 → コインを既存の `persistProgress` で加算。コインの保存に失敗（競合など）したら箱を元に戻して理由を表示。進行開始前はコインを受け取れず箱に残る（ボタンは「進行開始後」）。
- ホームの「チャレンジ」段（日替わり防衛・週間ミッション）に3つ目として配置し、未受取件数を既存の赤バッジで表示。3列1段に収め、844×390・640×360・568×320 で段の追加・はみ出しなし。

## §4 ログインボーナス
- 日付の基準: **日本時間0時切替（既存の日替わり防衛・週間ミッションと同じ `japanDay`）**。ただし判定は端末の時計（サーバー時刻ではない）。同じ日は二重に入らず、時計が最終付与日より前に戻っていたら入れない。
- 報酬は箱へ入れるだけ（直接付与しない）。報酬表はデータ `LOGIN_BONUS_TABLE`（通算ログイン日数で7日周期）。

### ログインボーナス初期値（要確認・仮置き）
| 通算日（7日周期） | 報酬 |
| --- | --- |
| 1〜6日目 | 50コイン |
| 7日目 | 100コイン |

- 1週間で400コイン（進撃1回の勝利報酬は100コイン〜、週間ミッション3件で計800コイン）。補給券・ガチャ関連・素材・粉は配らない。

## テスト・確認
- `npm run typecheck`: 成功
- `npm test`: 成功（180ファイル / 1840件。追加: `tests/control-voice-packs.test.ts` 10件（同梱パックとカタログの一致・全再生対象台詞の収録と保留/廃止行の非収録・WAV非同梱・未DL時は無音で通信なし・DL済みの再生・削除後に止まり無音・再起動後も保持・破損DLの拒否・旧版を鳴らさない・保存不可端末）、`tests/supply-box.test.ts` 12件（一度きり配布・受取で初めて解放・既存キー不変・日次判定とJST切替・時計の巻き戻し・周期・上限・個別/一括受取・進行前はコイン保留・保存失敗時の巻き戻し・壊れた保存を上書きしない）。`tests/control-voice.test.ts` を新キー形式・解放状態に合わせて更新）
- 実ブラウザ（ローカル `vite preview`・Chrome、検証スクリプトはコミット対象外の `dist-validation/`）:
  - 844×390 / 640×360 / 568×320: ホームのバッジ（2件）、箱の一覧（ヒヨリ解放・ログインボーナス1日目）、ヒヨリ受取→解放キー保存・バッジ1件、設定→管制AIボイスの3行（ヨウコ未解放）。行のはみ出しなし。
  - 844×390: ヒロミをダウンロード（パック1本だけ取得）→保存済み→再読み込み後も保存済み→削除で未ダウンロード。ヒヨリ選択時は「字幕だけで進みます」と表示。
  - 進行開始後に「すべて受け取る」で 0→50コイン、箱が空になりバッジ非表示、再読み込みしても同日に再配布されない。
  - パックから取り出したMP3を実Chromeで展開し、元WAVと同じ長さ（tut-intro 8.00秒、home 3.36秒）を確認。

## 要確認（公開前仕様変更）
1. **「公開ビルドに音声を含めない」の解釈**: WAVは公開物から外したが、任意ダウンロードの取得元として圧縮パック3本（計約14.5MiB）は同じWorkerの静的ファイルとして公開している（設定で押したときだけ取得される）。別の配信先（R2など）は新規費用・新規公開先になるため使っていない。パックも公開物から外す意図なら配信先の指定が必要。
2. **ログインボーナス初期値**（上表）。補給券は配っていない（ガチャ・券配布ルールは不変）。
3. **ログインボーナスの日付は端末の時計**: 端末の日付を進めると前倒しで受け取れる（巻き戻しは無効）。サーバー時刻での判定にする場合はクラウド連携が必要。
4. **支給ボックスは端末ごと**（クラウド引き継ぎの対象外）。コインは受取時に進行保存へ入るため引き継がれる。未受取の中身・解放済みの声は引き継がれない。
5. **配置場所**: 支給ボックスとヒヨリ配布は進撃側のタイトルのみ（生存専用画面 front.html のタイトルには置いていない）。管制AIボイス設定は進撃タイトルと協力（main.ts）の設定にあり、生存側の設定には無い。開発者モード・TEST DATA では箱を出さない。
6. **ヨウコのパック**は公開物に含めたが未解放のため取得できない。配布時はデータ（解放アイテム）を足すだけでよい。
7. **report-*・weapon-* など不採用の台詞**もパックに入れている（採用フラグの切替だけで鳴らせるように）。容量を削る場合は採用分だけに絞れる。
