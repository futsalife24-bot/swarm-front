# HARROWの羽ばたき・着地候補を現行mainへ移植

2026-11-10。専用worktree `task-resume-harrow-20261110`、branch `codex/resume-harrow-20261110`、基点 `3f2c429c442c44d54bf4a8132cc791f30534ae9d`（当時の `origin/main`）。この文書は候補の検証記録であり、main反映・公開の記録ではない。

## 統合した内容

- 2026-11-05の未公開候補 `023ec937cf643fb4369fda0af25d7824370847f4` から、HARROWの連続した上下羽ばたき、肩から羽先への遅れ、通常降下と地上着地を区別した表示時計を現行mainへ移した。現行mainには元候補の `harrow-motion-polish.ts` がなかったため、読込時の翼加工と戦闘・図鑑の接続も移した。
- 図鑑のカメラプロファイルは現行の実GLBと今回の飛行加工から再生成した。元GLB、39骨、戦闘判定、発射位置・時刻、通信、保存、`src/shared/game.ts`、serverは変更していない。全身GPUパレットは12,240,384バイト。
- rootに残る立体予告の未コミット差分は、[PR219の公開記録](HARROW-BEACON-RELEASE-20261026.md)と現行mainの実ファイルに照らして既に反映済みと判定し、再度移植していない。rootと元のモーション作業場所は変更していない。
- 今回は既存モデルの動作調整なので、新規参照画像やClaude UIの制作工程は追加していない。元候補の比較動画と数値（ローカルbranch `codex/harrow-continuous-wingbeat-20261105` の `docs/evidence/harrow-continuous-wingbeat-20261105/README.md`）を参照し、現行mainでの実描画を再検証した。

## 確認結果

- `npm run typecheck`、`node scripts/generate-harrow-report-profile.mjs --check`、`npm run build`、変更9ファイルのPrettier確認、`git diff --check` 成功。ビルドには既存の500kB超チャンク警告がある。
- HARROW実GLBの全頂点と翼トラックを含む `tests/harrow-model.test.ts` は8件成功。`structure-motion`、立体予告、エネミーレポートは32件成功・1件失敗。さらに `harrow`、武器、`hound-motion`、攻撃予告、HARROW効果の116件成功。計156件成功・1件失敗。
- 失敗は `tests/enemy-report-motion.test.ts` の表示子要素数の旧期待値7個に対し実際8個となる1件。今回変更した同ファイルの箇所は着地の `reportPose` と新しい検査であり、子要素を組み立てる `ReportEffects` は変更していない。元の2026-11-05候補の検証記録（ローカルbranch `codex/harrow-motion-polish-20261105` の `docs/evidence/harrow-motion-polish-20261105/README.md`）にも、無変更mainで同じ失敗が記録されている。今回の候補による新規失敗として扱わない。全テスト成功とも記さない。
- 既存の本番Renderer検査を同じローカルURL・同じコマンドで実行。最初のsandbox実行は `net::ERR_NETWORK_ACCESS_DENIED` で停止した。正式な権限申請後はChrome / Intel Iris Xe D3D11で成功。Flight 1体を30/60fps設定×画質1/0.65の4条件で描画し、4/8フレーム、GPUパレット容量、素材エラー0、ページ例外0を確認した。[検査結果](evidence/harrow-resume-20261110/scene-checks.json)、[60fps画質1の実画像](evidence/harrow-resume-20261110/scene-60-1.png)、[30fps画質0.65の実画像](evidence/harrow-resume-20261110/scene-30-0.65.png)。画像を実視して明白な欠損・翼の切れを認めなかった。この設定値は実機のFPS測定ではない。

## 段階と残件

通常の独立Chat監査は2026-10-15方針により追加していない。過去のHARROW v12/v13の個別監査holdは各PRの再監査・公開記録で解消済み。今回候補の本人による連続再生時の好み、実スマホの性能・発熱、長時間・多人数の実通信は未確認。今回の作業ではpush、main反映、Worker公開をしていない。採用・公開は主担当が他の再開作業と差分を照合して判断する。

主担当へ渡す追記案: 「HARROWの11/5未公開モーション候補を現行mainへ移植。型・build・関連156件成功、既存期待値1件失敗、実Renderer4条件成功。本人見た目評価と実機負荷は未確認。詳細 `docs/HARROW-RESUME-20261110.md`。専用branchからのmain反映・公開は未実施。」

作業担当の実モデルID・推論設定は取得できず未確認。サブエージェントの再委任なし。
