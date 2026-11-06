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
