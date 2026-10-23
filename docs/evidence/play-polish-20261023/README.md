# ローカル改善の検証証拠

以下は元作業時点の証拠。2026-10-23の公開依頼以降の検証・反映状況は [公開記録](../../PLAY-POLISH-RELEASE-20261023.md) を参照する。公開用manifestから私用保管庫のメタデータだけを除外し、元ファイルは元worktreeに保持する。

対象: `claude/motion-toggle-balance-20261019`、base/head `a3d8f076935620b2c264825bb3b849c544e2842f` に対する未コミット差分。公開版の検証ではない。詳細と承認境界は [点検記録](../../PLAY-POLISH-20261023.md)。独立監査は未実施。

- `weapons/results.json`: 固定seed2個、固定標的88＋移動入力48条件。被ダメの定義、試行数と解釈の制約は点検記録を参照。
- `minimap-before.log` / `minimap-after.log`: 再現失敗と修正後成功。
- その他の単体ログ: 対象ごとの成功結果。全体テストの成功を意味しない。
- `save-unit-summary.json`: 保存関連10ファイル147件を各プロセスで実行した結果。
- `save-safety-final.json` / `save-fixtures-final.json` / `save-receipts-final.json` / `save-checkpoint-final.json`: 4本の個別ブラウザ検証が成功。安全性7、fixture10、受取履歴3、checkpoint3回復帰＋合成勝利の報酬検証。単一runnerの一括成功とは区別する。
- `source-manifest.json` / `changes.patch`: 今回のコード/検証スクリプトの最終ハッシュと追跡ファイルの差分。新規テスト/検証スクリプトはmanifest記載の実ファイルを参照する。
- `typecheck-final.log` / `build.log`: 型とビルド。大きいchunkの警告は残存。
- `input-browser/results.json` / `controls.png`: 実Chrome上の隔離ControlsとCDPタッチ。実スマホではない。
- `harrow/results.json` / `spin-*.png`: 既存プレビューの実GLB、同じ地上カメラでSpinの3時刻。全攻撃・全視点を保証しない。
- `effects/before.json` / `after.json`: 同PC/同条件の描画部品比較。フレーム時間改善は示さず、毎フレームの配列置換削減を確認。heapの丸め値からリークを判断しない。
- `dense-incomplete.log`: 実Renderer追加比較の未完了。最初の修正前試行が180秒で完了せず、修正後の比較値はない。

テスト準備中の失敗ログと全生ログはローカルの `dist-validation/play-polish-20261022/` に保持する。本人の実セーブ、認証情報は使用していない。

## 追加検証（2026-10-23、優先1・2）

前回のmanifest/patch/成功結果はそのまま残す。以下は同じbase/headに対する継続作業で、製品の追加修正は `Controls.read()` の非表示/非フォーカス時resetだけ。未コミット・未公開・独立監査なし。

- `dense-native-final.json`、`dense-before.png` / `dense-after.png`：実Renderer97体、準備180＋標本360、前・後・後・前の4試行。Intel Iris Xe、p95 17.0/16.9/16.9/17.0ms、50ms超/longtaskは全て0。描画数・モデル資産数は前後同じ。速度向上を示す結果ではない。heapはGCを含む端点であり削減量・リークを保証しない。
- `dense-swiftshader-incomplete.json`：進捗30フレーム約11.7秒、60標本が25秒未完了。前回180秒の厳密な停止位置は分からない。
- `dense-software-no-draw.json`：最終GPU描画だけ除いたCPU更新の診断。敵数/品質を減らした改善試験ではなく、製品性能の値へ流用しない。
- `mobile-focus-before.json`：実フォーカスなしなのに保持入力が残る修正前の状態とタイムアウト。Playwrightの初期フォーカス模擬の失敗は別の生ログへ保存。
- `mobile-final.json`、`mobile-568x320.png` / `mobile-844x390.png`：製品HTML/CSS/Controls/Layoutの隔離ページ20条件、三点操作・画面外capture・個別解放/取消、実フォーカス喪失/復帰。安全領域は合成CSS値、実スマホと戦闘HUD全体は対象外。
- `focus-unit-before.log`：通知欠落の追加2件が失敗し、既存8件は成功。`focus-unit-after.log`：入力10＋network-input3の13件成功。コマンドに存在しない `front-layout.test.ts` も指定していたが対象へ入らないため、正しい `layout.test.ts` を別実行した `layout-followup.log` の7件と区別する。今回計20件。
- `typecheck-followup.log` / `build-followup.log`：入力修正後の型・ビルド成功。既存の大きいchunk警告を保持。
- `source-manifest-followup.json` / `input-followup.patch`：追加範囲のハッシュと、前回の入力ソースからの追加3行。前回版へ戻した仮想ソースのSHA256が旧manifestと一致することを確認してから差分を生成。前回分を含む全製品差分は旧patchと本patchで照合できる。追加のテスト/計測器はmanifest記載の実ファイルが正本。

再現：`node scripts/check-play-polish-dense.mjs --gpu=native`、`node scripts/check-play-polish-mobile.mjs`。ブラウザ試験は既存Chromeを隔離起動し、localhostのみ使う。生ログは `dist-validation/play-polish-20261023/` と `dist-validation/play-polish-*.log` / `dense-*.log`。元の3フレームsmoke、短縮試行、フォーカス模擬とseq比較の準備失敗も残す。成功済みの保存・武器・HARROWの再実行はしていない。

残件：HARROW全攻撃/端/密集、音の実聴、後半/協力武器比較、本人の実機。訓練場拡張・未承認数値/報酬・別候補採用は承認後。外部送信、stage/commit/push/merge/デプロイは未実施。
