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
