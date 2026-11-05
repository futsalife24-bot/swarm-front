# 生存終了時の獲得報酬UI：Claudeデザインへの実依頼

本人依頼「生存モード終了時の獲得報酬画面がない」。既存終了画面は合計文のみ、獲得武器一覧がない。報酬計算・取得条件・保存形式は維持し、終了画面内へ獲得報酬と今回の武器を表示する。

作業場所: `C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a/task-survival-build`。branch `codex/survival-result-rewards-20261105`、base `aa0e1fe15284a42fe08bdbc7036ae0c506eb2f99`。同じ作業場所で主担当と担当ファイルを分離する。branch切替・commit/push/main反映・公開は禁止、主担当が実施する。他タスクの実行・未保存入力へ割り込まない。

担当指定: 今回もUI設計/レイアウトはClaude CodeのClaudeデザインへ依頼。既存の軍事SFテーマ、終了画面と武器1丁1行の継承、横画面844×390/640×360、スクロール時も見える戻る操作、動き軽減を守る。新しい画像・音・依存は不要。

Claudeの担当ファイルは新規 `src/client/front-result-ui.ts` / `.css` と、必要なら既存 `src/client/gear-weapon-list.ts` の後方互換な表示用オプションのみ。共有STATE/MainVaultとfront-app.ts・front-result-rewards.ts・保存/戦闘/server/testsは編集しない。納品はこの文書末尾へ追記する。公開済バディ・旧カード試作は変更しない。

主担当提供の契約: `src/client/front-result-rewards.ts` の `FrontResultRewards` を受ける `frontResultRewardsMarkup(rewards: FrontResultRewards): string` をexportする。既存終了section内に挿入予定。CSSはfront-appからimportする。既存gearWeaponRowsを継承し、今回のweaponsだけ表示。武器の恒久Lv、レア、名前、効果、全性能、保留/未保存状態を確認できるようにする。結果では装備・解体・ロック操作はしない。クリックできるのに無反応のボタンを作らない。任意詳細は主担当と接続契約を相談する。データ0件、save=null、error=trueも扱う。

coinsは獲得予定額（既存計算式）、campaignが空なら保存確定と表示しない。progress/campaignは既存保存済表示。weapons.state=stored/pending/unsaved。pendingは保存済の超過保留、unsavedは保存未確認。saveは既存のProgressSaveまたはnull。eligible=falseでは対象外とし武器0件。武器0丁なら「武器は60秒以上かつ1撃破から」を説明。宝箱コインはcoinsに含むので二重加算しない。作戦内カードは持ち帰れないので恒久報酬に含めない。

画面全体の接続・再保存ボタン・実ソロ/実Worker通信・保存再試行/二重付与/再接続・型/単体/build/実ブラウザー・commit/main反映/既存Worker公開は主担当。まず読取と担当範囲を返答し、次に製品へ接続可能な最小UIを納品してください。既存バディ依頼で確認済の参考ノートを必要な範囲で再利用可。今回も余分な新演出は追加不要。

## Claudeデザイン納品（2026-11-05）

依頼書を読み、指定の3ファイルだけを編集した。branch切替・commit/push・front-app.ts・front-result-rewards.ts・STATE/MainVault・tests・保存/戦闘/serverは未変更。主担当が作業中だった `front-app.ts` の接続（`front-result-panel` クラス、`${rewards}` を合計文の位置へ挿入、失敗時は `role="alert"` の理由文と既存再試行）をそのまま前提にしている。接続側の追加変更は不要。

納品ファイル（SHA256先頭12桁）:

- `src/client/front-result-ui.ts`（新規 `E81B77F253FD`）: `frontResultRewardsMarkup(rewards: FrontResultRewards): string`。計算・保存・再試行は持たない。
- `src/client/front-result-ui.css`（新規 `C515B3071C68`）: `.fr-` 接頭辞と、`.front-result-panel:has(.fr-rewards)` に限定した終了sectionの調整。
- `src/client/gear-weapon-list.ts`（追記 `96DAF6EFF798`）: 後方互換。`gearWeaponRows` の出力は変更前と同じ文字列で、性能セルと見出しを内部関数 `statCells` / `listHead` へ切り出して共用した。新規export `gearReadOnlyRows(items, label, stateHead="状態")` と `GearRowState`。

### 表示の決め方

- 既存終了section（見出し・理由・時間/取得/連鎖・融合）はそのまま。合計文の位置に「獲得報酬」を置く。見出し行に要約のチップ、その下に今回の武器の一覧。
- チップ:
  - 攻略コイン `+coins`（宝箱分があれば「宝箱Nを含む」と内数で表示し、二重に足さない）。状態は campaign が空でなければ「保存済」、空でerrorなら「未保存」、空でerrorなしなら「獲得予定」。campaign が空の間は保存済と出さない。
  - 功績: progress の既存文をそのまま表示。progress が空でerrorなら「功績 未保存」。
  - 武器 N丁: 内訳を「保存済a・保留b・未保存c」で表示（0件の項目は省く）。
  - 状態は色と文字の両方で示す。
- 武器一覧:
  - 出撃準備と同じ1丁1行。行高30px・見出し20px・同じ列幅/列順（特殊効果・威力・装弾・装填・射程・連射）・同じ性能書式と▲▼印。
  - 名前の後ろに恒久Lv（`weaponLevel`）を出す。右端のロック位置には、操作でなく状態の文字（保存済/保留/未保存）を出し、`title` に意味を入れる。未保存の行は上下の枠線を破線にする。
  - 装備・解体・ロック・詳細のボタンは作らない。押せる要素は特殊効果の既存説明（`effect-help`、押すと既存の説明ダイアログが開く）だけ。
- 補足文:
  - 保留または未保存がある時だけ、一覧の下に意味を1行で出す。
  - 武器0丁（対象内）は「今回の武器はありません。武器は60秒以上かつ1撃破から獲得できます。」
  - eligible=false は「今回の結果は武器・攻略コインの対象外です。」とし、一覧とコインは出さない。progress があれば功績だけ出す。
- save=null: 一覧は weapons の state だけで描くので、save を参照しない。
- 戦闘中は `body.playtest` が外れていて `gear-weapon-list.css`（`.playtest #ui` 限定）が効かない。そのため、行の寸法・列定義を `.fr-rewards` 配下へ写した。既存CSSは変更していない。
- 戻る操作と再試行:
  - 報酬一覧がある時だけ、終了sectionの `header`（見出し＋タイトルへ）をスクロール中も上端に固定する。上端線と地色は既存 `.pause-card` に合わせた。
  - section直下の `#front-retry-save` は、一覧が長くてもスクロールせず押せるよう下端に固定する。
  - 短い高さ（420px以下・380px以下）では、section内の段落余白とボタン寸法だけを詰めた。
- 新しい演出・画像・音・依存はなし。アニメーションを足していないので、動き軽減では表示が変わらない。

任意の改善案（主担当判断・未実施）: 再試行ボタンを `header` の「タイトルへ」の左へ移すと、640×360の失敗時に3行目の名前へ重ならない。移した場合、下端固定のCSSは「section直下」限定なので自動で外れる。

### 検証（Claude側・実ブラウザー）

- `npx tsc --noEmit -p .` 成功（主担当の作業中の差分を含む作業場所全体）。3ファイルはPrettier整形済み。
- 既存の武器行テスト `tests/weapon-stat-marks.test.ts`・`tests/front-gear-weapon-rows.test.ts` は2ファイル8件とも成功。TEMPはscratchpadに限定し、テストは変更していない。
- 確認用Viteを `--port 5193` で別に起動し、隔離したChrome（動き軽減・タッチあり）で検査した。終了直前のfixtureは主担当の `check-survival-result.mjs` と同じ（時間とHPだけ）。
  - 寸法は 844×390、640×360、1280×720。
  - 場面は、実ソロ戦闘の帰還（3丁）、短時間の全滅（0丁）、保存失敗（未保存→再試行→保存済）。
  - 帰還の後、表示データだけ差し替えた変種を実際の終了section内で描画した。変種は次の3つ。
    - 混在7丁: 全レア・Lv1〜60・保留/未保存・error・save=null
    - 獲得予定
    - 対象外
- 126項目すべて成功、ページ例外0。確認した項目:
  - 「タイトルへ」が画面内で押せる（最上端・最下端までスクロールした時も）。
  - 失敗時の再試行がスクロールなしで押せる。
  - 行高30px。844px以上では全性能を横スクロールなしで表示（640でも横はみ出し0）。
  - 結果一覧のボタンは効果説明だけで、押すと説明が開く。
  - 状態の文字、0丁の説明、対象外の表示、獲得予定時にコインを保存済と出さないこと。
- 終了sectionのスクロール量:
  - 実3丁: 844と640で0。
  - 失敗時: 844で68px、640で95px。
  - 混在7丁: 844で138px、640で179px。
  - 1280はどれも0。
- 証拠（ローカル）: `C:/Users/futsa/AppData/Local/Temp/claude/015f2ffdbe350595/8e09aef0-055f-4ebb-9f1a-d61a7f7c836b/scratchpad/result-ui/`
  - `check-result-ui.mjs`（検査）
  - `shots/results.json`（測定値）
  - `shots/*.png`（26枚。例: `844-return-real.png`、`640-save-failure-fail.png`、`640-return-mixed-scrolled.png`）
  - 必要なら主担当の evidence へ複製してください。
- 検査の終了後、確認用Viteは `docs/evidence/.../solo-results.json` の監視で `EBUSY` になり停止した（主担当の検査が同時に書き込んだため）。検査結果には影響しない。ほかに起動したプロセスは残っていない。

未検証（主担当の範囲）:

- 実Worker通信・協力戦の本人分
- 再接続・二重付与
- 公開build
- 主担当 `check-survival-result.mjs` の通常モード（見出し「獲得報酬」と `#ui [data-row]` 3/0件は、この納品の構造で満たす想定）
- 実スマートフォン
