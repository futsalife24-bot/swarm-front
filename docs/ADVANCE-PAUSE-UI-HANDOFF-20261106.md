# 進撃の停止・ダウンUI：Claudeデザイン依頼

今回の本人依頼は、停止メニューに同行バディの名前・レベル・スキルを表示、淡白なダウン画面の改善、戦闘pauseボタンの明確化の3点。既存本人指定のClaudeデザイン担当へ画面設計を依頼する。Codexは表示データ・接続・実ゲームQAを担当。

## 作業境界
正規main 1c0b77c2e95a6e9859a8c4003d0adc018338cc91 から作成した専用worktree `C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a/task-advance-pause-ui`、branch `codex/advance-pause-ui-20261106`。このworktreeのみ。root/他worktreeを切替・編集しない。AGENTS.md、docs/WORKFLOW.md、docs/STATE.mdとrootの入口文書を実読取する。

Claudeの編集は新規 `src/client/advance-pause-ui.ts` と `.css`、`design/advance-pause-ui/` のみ。実ゲームへ接続できる表示専用HTML生成関数を納品。playtest-app.ts/index.html/buddy-presentation.ts/共有STATEはCodexが編集。戦闘・保存・通信は変更禁止。commit/push/PR/main反映/公開・依存導入は禁止。依頼書末尾へ納品情報を追記可。

## 現行と要件
対象はsrc/client/playtest-app.tsのpause()（350付近）とdefeatChoice()（399付近）。front-app.tsの生存UIとは別。index.htmlの共通pauseボタンは現在 `| |`。既存の暗い紺/灰青・角型切欠き・灰緑の細枠を継承し、色だけでなく文字・階層・近接で整理する。横画面844×390/640×360/568×320と安全領域を優先。主操作は44px以上を目安、HUDの占有は増やしすぎない。新しい外部画像・音源は不要。

停止は既存menu-dialogのヘッダー/閉じるを継承。バディ詳細と再開/設定・操作/リタイアをまとめ、主操作は再開。出撃中の編成変更は追加しない。設定やリタイアの処理はCodexが既存コールバックへ接続する。

downはまだ敗北確定前。既存pt-defeatボタンを主操作として残し、現状と押すと敗北結果へ進むことを説明。SHOW_AD_UI=falseの隠し広告条件は維持し、復活・再挑戦・追加確認・新報酬を追加しない。まだ保存済みとも表現しない。巨大な空白をやめ、状態/戦況/次の操作を近接させる。戦況は実データで渡した値だけ使用。

## 表示契約（Codexが実データを準備）
`advanceBuddyMarkup(buddy)`：buddyは `{status:'present'|'none'|'unavailable', name?:string, level?:number|null, elementLabel?:string, skillName?:string, skillText?:string, cooldown?:number, remaining?:number|null, activeRemaining?:number|null, unavailable?:string|null}`。表示文字はescapeし、undefined/NaNを出さない。同行なしと情報取得不可を区別。remaining/activeRemainingは秒。停止中の操作不可と再使用待ちを混同しない。

`advanceDownMarkup(stats)`：statsは `{stageLabel:string, elapsed:string, kills:number|null}`。既存header('ダウン', body,false)のbodyとして使う。bodyにpt-defeat（敗北を確定）とpt-ad-noteを含める。広告非表示の通常経路用。見出しや結果数値を捏造しない。

`pauseButtonMarkup`：太い二本バー（aria-hidden）と短い「停止」ラベルのHTML文字列。既存id=pause/aria-label/操作接続は維持。CSSは既存layoutのサイズ指定を壊さないよう限定する。

## 画像と確認
添付2枚は親が実ピクセル確認済み。実装者への正規Library転送はWindows os.setxattr非対応で失敗し、元画像はここにない。見たと報告しない。親の観察：2048×932、停止は中央の幅1719/高さ333程度の角型パネルに3ボタンだけ。downはほぼ全画面パネルに『ダウン』『敗北を確定』のみで巨大な空白。Codexが現行の実ゲームから変更前画像を取得して共有するので、現行再現画面を視覚基準にする。

バディの正本はbuddy-presentation.tsのcatalogItemとBUDDY_COMBAT。ヨスガは持ち主だけ回復。world.buddies.runとworld.run一致、entries.soloを同行の正とする。恒久saveのselectedだけから同行を決めない。表示データはCodexが担当。

最初に担当範囲と読取確認を返し、実装へ進む。新規ファイルのみのためCodexと並行可。独立HTML fixtureの結果と製品動作は区別。代表画像・サイズ別検査・欠損ケース・納品ファイルを末尾へ記録する。

## Claudeデザイン納品（2026-11-06）

依頼書を読み、AGENTS.mdとSTATE先頭を確認した。編集は新規 `src/client/advance-pause-ui.ts` / `.css` と `design/advance-pause-ui/` に限定。playtest-app.ts・index.html・buddy-presentation.ts・STATE・戦闘/保存/通信は無変更。commit/push/PR/公開/依存導入なし。元添付は見ていない。視覚基準は現行ゲームの再現画面（主担当の `scripts/check-advance-pause-ui.mjs` を5194で実行して撮影、`design/advance-pause-ui/before/`）。

主担当が作業中だった playtest-app.ts の接続をそのまま前提にしており、接続側の追加変更は不要。接続内容は次の3つ。
- `advancePauseMarkup(getAdvanceBuddyView(world,"solo"))`：防衛以外のソロで使う。
- `advanceDownMarkup({stageLabel, elapsed, kills})`：`!SHOW_AD_UI` の時だけ使う。
- `$("pause").innerHTML = pauseButtonMarkup`

### 納品ファイル（SHA256先頭12桁）
- `src/client/advance-pause-ui.ts`（`11D091AE4C5F`）。次の4つをexportする。
  - `advanceBuddyMarkup(buddy)`：契約どおり。
  - `advancePauseMarkup(buddy)`：追加の補助関数。バディ情報と既存3操作の本文をまとめて返す。
  - `advanceDownMarkup(stats)`：契約どおり。
  - `pauseButtonMarkup`：契約どおり。
  - 型 `AdvanceBuddyMarkupView` は主担当の `AdvanceBuddyView` と同じ形。`AdvanceDownStats` も export する。
- `src/client/advance-pause-ui.css`（`013D1769088F`）。接頭辞は `.ap-`。既存の要素へ当てる規則は次の4つに限定した。
  - `.menu-dialog:has(.ap-pause)`
  - `.pt-screen .ap-down`
  - `#settings-save .ap-pause`
  - `#pause:not([hidden]):has(> .ap-pause-bars)`
- `design/advance-pause-ui/`
  - `check.mjs`（検査器）
  - `before/`（変更前9枚）
  - `shots/`（代表22枚と `results.json`）

### 設計
- **停止**：既存 menu-dialog のヘッダー（SWARM FRONT / 一時停止 / 閉じる×）をそのまま使う。本文は2列。
  - 左はバディ情報。右は操作の縦並びで、上から再開（`.primary`、主操作・最大）、設定・操作、リタイア。
  - 既存のid（`pt-resume` / `pt-pause-layout` / `pt-retire`）と文言はそのまま。出撃中の編成変更は置かない。
- **バディ情報**：上から次の順に並べる。
  1. 見出し「同行バディ」
  2. 名前・Lv・属性。属性は字形と文字で示し、色だけに頼らない。
  3. 固有スキル名と再使用秒数
  4. 説明（3行まで。低い画面では2行）
  5. 再開後の状態行
  6. 注記「停止中は時間が止まり、スキルは使えません。」
- **状態行の出し分け**：
  - activeRemaining>0：効果中・残りN秒
  - remaining>0：再使用まで N秒と進行バー
  - remaining=0：再開後に使用可能
  - unavailable の文字がある時：今は使えません＋理由
  - 停止中の操作不可は、状態行とは別の注記にして、再使用待ちと混同しない。
- **欠損と区別**：
  - status=none は「同行なし／この出撃にはバディが同行していません」。
  - unavailable と未知の status は「情報を表示できません／戦闘はそのまま再開できます」で、同行なしとは別の表示。
  - 欠けた値（空文字・undefined・NaN・Infinity）は行ごと省く。スキル名が無い時は「スキル情報なし」。
  - 表示文字はすべてescapeする。
- **設定・操作を開いた時**：既存処理が本文を「メニュー」欄へ移す。その欄では1列にし、説明文と注記を省いて収める。
- **ダウン**：既存 `header('ダウン', body, false)` の本文。画面中央に1かたまりで並べる。
  - 状態：警告の縞と「戦闘不能」「まだ敗北は確定していません」
  - 戦況：作戦・経過・撃破の3枠。無い値は「—」。
  - 次の操作：既存 `pt-defeat`（主操作・最大）と「押すと敗北として結果画面へ進みます。」
  - `pt-ad-note` は残す（空の時は非表示）。
  - 復活・再挑戦・新報酬・保存済の表現はない。
  - 文字と主操作は画面の高さに合わせて大きくなる。620px以下の幅では縦1列。
- **pauseボタン**：太い二本バーと「停止」（どちらも `aria-hidden`）。
  - 既存の id・aria-label「一時停止メニュー」・onclick・layout の inline の寸法と位置は変更なし。`[hidden]` も上書きしない。
  - 背後の操作説明に埋もれないよう、地を少し濃く、枠を少し明るくした。
- 新しい画像・音・演出・依存はなし。

### 検証（Claude側・製品経路の実ブラウザー）
- `npx tsc --noEmit -p .` 成功（主担当の作業中の差分を含む）。2ファイルはPrettier整形済み。
- **製品経路での確認**：
  - 確認用Vite（5194）と隔離Chromeで、主担当の手順どおりに実ソロ進撃を開始した。
  - 開始時のfixtureは主担当と同じ（保存seed・ヨスガ所持、renderer観測、safe=999、強制hp0）。
  - 接続済みの playtest-app.ts はそのまま動かした。変種を描くために、関数を window へ公開する追記を配信時だけ加えた。
- **画面条件**：844×390(PC)、640×360(タッチ)、568×320(タッチ)、844×390(タッチ・安全領域 L44/R34/B21)。
- **284項目すべて成功、ページ例外0**。確認した項目：
  - pauseボタン：寸法が layout の指定どおり44×44（4条件とも）。中身が枠内、中心で押せる、aria を維持。
  - 停止の実値：ヨスガ Lv1・風・自己回復・「今は使えません HPが満タンです」。
  - 停止の変種：再使用待ち、効果中、使えない理由、火炎、値の欠損、escape・長文、同行なし、取得不可。どの変種でも次を確認した。
    - ダイアログが画面内
    - 再開がスクロールなしで押せる
    - 操作が44px以上
    - undefined/NaN/null の文字なし
  - 実値では、停止ダイアログ本文のスクロールが全条件で0。
  - 設定・操作：本文が「メニュー」欄に収まる。
  - ダウン（実値：前哨掃討・0:02〜0:03・0体）：敗北を確定が押せて52px以上、画面内でスクロールなし、`pt-ad-note` を維持、保存済・復活・再挑戦の文字なし。
  - ダウンの変種：欠損は「—」が3つ、長い作戦名は省略記号。
  - 既存のbindが付いた実要素の `pt-defeat` を押すと、結果画面へ進む（4条件とも）。
- 変種は表示データを差し替えた描画だけで、押下の確認はしていない。押下は実値の画面で確認した。
- 確認用Viteと検査ブラウザーは終了済み。

### 主担当への確認事項（未変更）
- ダウンの撃破には `world.solo.plannedKills` が入っている（FOUNDRY発生分を除く計画敵の撃破数）。「撃破」の意味として良いかは主担当の判断。
- 未検証（主担当の範囲）：実スマートフォン、協力戦・防衛、`SHOW_AD_UI=true` 経路、公開build、本人の元添付との見比べ。
