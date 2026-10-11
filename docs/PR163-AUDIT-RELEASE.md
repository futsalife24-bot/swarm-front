# PR163 照準中心・弾形状の引継ぎ監査（2026-10-11）

- PR: https://github.com/futsalife24-bot/swarm-front/pull/163
- 作業場所: `C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a`
- branch: `ccr-29bae2db-rwyj88`
- base: `9f7f9d592ba021054c0eda28e013c38316b4e0d0`
- 実装: `3bd6ed51ea1ef8bcc41cc416d330bfe4b461bfa9`。以後は検証スクリプト・証拠・記録のみ。
- 引継ぎ開始時clean。重複担当は停止済みとの連絡を受領。他担当の変更なし。既存main worktreeを維持。
- iabの認証済み通常Chatと既存Cloudflare OAuthを確認。whoami/既存Worker deployments list成功。新規登録・認証設定変更なし。

## 変更と検証範囲

`render.ts` はinnerWidth/innerHeightの描画中心をCSS変数へ伝え、visualViewport resizeでも再計算。`style.css` は照準/スコープの中心をその値に統一。`combat-effects.ts` は弾カプセルを細長く変更。射撃権威・速度・バランス・保存・通信は変更なし。

Windows Chromeでnpm ci、型、build、本番設定Worker dry-run成功。`front-hud.spec.ts`（844×390/640×360）と`training-scope.spec.ts`は3件成功。詳細ログ/画像は `evidence/pr163-20261011/`。

追加スクリプト `scripts/check-pr163-aim-center.mjs` は実Renderer/実射撃関数を使用。2画面幅×3距離×3俯仰角×スコープ有無の36条件で投影誤差2px以内（最大約4.2e-13px）。通常HUD・高さ+65pxの人工条件・画面縮小を確認。変更前の人工条件では照準のみ32.5px下へずれ、変更後はcanvas中心と一致。変更前のスコープはfixedなので同じ人工条件でも中心一致。visualViewportイベントは人工発火であり、実Androidのブラウザバー/全画面操作を再現したという意味ではない。

弾geometry実寸は幅約0.08/長さ約0.90、50ms後の移動は6m。見た目の寸法と移動速度を分離して検証。追加fixtureはGLBを読み込まず、実画面継承は別のE2Eで確認。追加fixtureのThree多重import警告、既存Vite hound shader警告を隠していない。追加fixture初回の開発サーバー読込timeout、比較fixtureのscope期待値誤りは検証側で修正して再実行成功。

## 既存失敗と公開判断上の残リスク

全単体は **903成功/4失敗、別に1ファイル読込失敗（計5ファイル失敗）**。同じ失敗をbaseでも対象を絞って再実行。変更前からの失敗だけを根拠に無害とは判定しない。全件合格ではなく、以下を監査の公開可否判断へ渡す。

|対象|今回確認したこと|残リスク|
|---|---|---|
|weapon-stat-marks|DOM依存をNodeでimportしdocument未定義、suite未実行|このsuiteの回帰検証が欠ける。表示機能全体の安全性は未証明|
|aim rocket|期待距離1.25に対し1.875。敵サイズ倍率1.5が実半径へ作用。実Rendererと実射撃の36条件は投影一致|既存期待値と実仕様の整合整理が必要。全武器/全敵/遮蔽を網羅していない|
|render bullet|50msの期待移動7.5mに対し実6m。既存速度120m/sは今回不変。新geometry寸法と移動を別途確認|旧テストが赤のままなので将来の回帰検出力が弱い|
|maps 晶脈|全種を強制spawnする検査でHARROWが30seedとも天井制約に不適合。JSONへ位置保存。通常の晶脈ST10/16の編成はHARROWを含まず、HARROW分岐は草原|任意spawn経路の配置制約問題は残る。通常編成の非該当だけで汎用spawnを安全とは扱わない|
|stages25|規定装備botがseed814で約128.15秒、78撃破後に敗北。shared/server/testsは今回差分なし|難度・bot操作・不具合の原因を未確定。人による適正難度/クリア可能性を未確認|

npm ciの既存依存にもhigh 5件（wrangler/miniflare/sharp/undici/source-map-js）。`npm-audit.json` を添付。ビルド/開発ツール依存が中心だが、用途別の影響を未確定のまま無害とはしない。今回の依存変更なし、自動更新・承認済みでない設定変更は行っていない。

## 未確認と監査依頼

実Android実機、実タッチ/ピンチ・ソフトキーボード・ブラウザバー開閉、長時間GPU負荷、全敵/全武器・遮蔽条件、人のプレイ難度は未確認。デスクトップの人工再現は報告画像の実原因の断定には不十分。独立監査は上記失敗と限界を含めて対象commitの通常merge/既存Worker公開の可否を判断する。必須修正があれば同じChatで修正SHAを再監査する。

[監査Chat](https://chatgpt.com/c/6acb22bc-2420-83e8-9e86-4b81e687245a): 対象956017d87972a3b3e3b15df9e515664d3a9647fd、必須新規P0/P1/P2各0。既存失敗・High5件を未解消で追跡する条件付き合格。追加確認で通常merge/既存Worker公開可と判定。製品修正要求なし。公開前後のSHA/build/dry-run/配信/実UI確認が残条件。判定全文audit-initial.txt/audit-final.txt。main統合/今回公開: 未実施。主担当の実モデルID/推論設定は未確認、サブエージェント不使用。

補足: dry-run初回は処理自体exit0だがsandbox外ログ書込にEPERM。既存設定のまま通常権限で再実行しexit0・ログ書込成功（dry-run-confirmed.txt）。認証/設定変更はなし。

公開範囲の判断: 既存失敗5ファイルとHigh5件を未解消と認識したうえで、検証された照準修正を公開する。汎用spawn・ST25の品質とDOM suiteの検証欠落、ツールチェーン依存の改善を追跡項目として維持。Worker成果物/server/srcに対象依存名参照は見つからないが、Wranglerにはundiciが含まれデプロイ経路の悪用可能性を否定していない。実Androidで症状が解消したとは報告しない。監査側のGit/依存追加判定は担当報告に基づき独立実行ではない。

公開検査スクリプト scripts/check-pr163-published.mjs を本番previewで確認。844×390/640×360の実ソロ/スコープ操作、人工HUD高さ差、縮小後中心一致、console/page error0。previewサーバーは検査終了時に閉じた。公開版で同じ検査を再実施する。
