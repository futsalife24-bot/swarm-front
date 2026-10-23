# 遊びの改善の公開準備（2026-10-23）

## 承認と対象

本人の「公開して」により、今回の改善のcommit・既存GitHubへのpush・通常PR merge・既存Worker公開を進める。新規認証・契約・課金・権限設定変更、別担当の変更の公開は含まない。通常作業の独立Chat監査は最新方針で不要、自己検証・CI・保護は維持する。

- 公開branch: `codex/play-polish-release-20261023`。
- 公開base: `d460f896f6c16980d14fb4f783f61c260c34c476`（最新main）。
- 元作業: `claude/motion-toggle-balance-20261019` / `a3d8f076935620b2c264825bb3b849c544e2842f`。元worktreeの差分・素材・入口文書はそのまま保持する。
- Windowsの長いパスによる新規展開失敗後、短い `dist-r/` に公開用worktreeを作成。元HEADの設定スイッチ変更 `a3d8f07` は今回に含めない。
- 製品変更は入力の同時押し・解放・取消・フォーカス喪失保護、ミニマップの範囲外の味方表示、演出配列の順序保持再利用。戦闘数値・判定・報酬・通信権威・モデル資産は無変更。
- 試験・計測器・記録は [点検記録](PLAY-POLISH-20261023.md) と [証拠](evidence/play-polish-20261023/README.md)。以前のログは元branch上の結果であり、公開版の結果とは区別する。
- 公開用manifestから私用保管庫のパス・ハッシュを除外した。元manifestは保持する。

## 公開ゲート

公開用worktreeで影響範囲の単体・型・production build・Worker dry-run、製品3ファイルの同一性、差分と対象外ファイルの不混入を確認する。main反映、Worker反映、配信照合は別々に記録する。

公開用の関連単体24件（入力・ミニマップ・演出・network-inputの17件、配置7件）、client/worker型チェックが成功。製品と試験スクリプト18件は元manifestとSHA256一致。元HEADだけにある設定2ファイルは未変更。証拠の秘密形式検査は検出0。ソース・文書のdiffチェックを行い、生ログの末尾空行・Vite出力の空白警告とは区別する。生ログは証拠保持のため加工しない。

Cloudflare CLIは通常実行・既存作業環境読込後とも未認証。標準保存先3か所に認証ファイルなし、該当環境変数もprocess/user両方で未設定。新規ログイン・一時アカウントは実行していない。既存GitHubコネクターは利用可能。Cloudflareプラグイン候補は見つからなかった。ブラウザDashboardはsnapshotが2回とも `Preview automation snapshot timed out after 15000ms.` で、既存ログインの有無は未確認。

GitHub rulesetsは0件。branch protection詳細は既存接続の403により閲覧不可で、保護なしとは判断しない。通常PR mergeでサーバー側の保護を守り、バイパスしない。

## 未確認・対象外

実スマホ、HARROW全攻撃/画面端/密集の視認性、音の実聴、後半・協力人数の武器比較、独立監査は未実施。訓練場本体・新数値・報酬変更・別worktree候補は含めない。フレーム時間・メモリの改善を保証しない。
