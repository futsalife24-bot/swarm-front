# B走りの暫定採用（2026-09-13）

ユーザー「Bで暫定採用するから公開までやって」により、比較済み Quaternius Standard `Sprint_Loop` の下半身移植版を通常ロードへ接続。正式採用ではなく暫定採用。

## 変更と保護

- `src/client/standard-trooper.ts`: 新しい `standard_trooper_sprint_v8.glb` をロードし、比較時と同じ距離連動周期で再生。歩幅5.21351158618927m。後退は従来の2.6m/周期。
- `public/assets/characters/standard_trooper_sprint_v8.glb` / `.json`: 比較済みBの別名コピーと出典・調整値。SHA256 `5621035c7405bad7b0fa1ea20231ce036a7b70fd07def7554de2a6ba70c96896`。
- `src/client/changelog.ts`: 暫定採用を追記。
- `scripts/run-transfer-review.html`: 比較左側は旧18クリップを使い、引き続き従来走りを表示。
- `scripts/prepare-sprint-adoption.mjs`: 保護検証付き再生成。既存モデルのnodes/meshes/skins/materials/textures/images、18クリップ、既存バイナリ領域を維持。元v7を上書きしない。
- `scripts/check-sprint-adoption.mjs` / `check-sprint-distribution.mjs` / `check-sprint-publish-baseline.mjs`: 採用一致・配布操作・公開基準の検証。

出典・骨格対応・移植は [試作記録](TROOPER-UAL-RUN-TRIAL.md)、方向と遷移は [方向比較記録](TROOPER-UAL-DIRECTIONS-REVIEW.md)。元素材ZIPは非公開のGit除外領域に保持。

## 検証

- 型チェック、関連14テスト、client/Pages build、production Worker dry-run成功。既存のbundleサイズ警告あり。
- 540フレーム、3武器、8方向/停止切替にわたって、既定Bと明示選択Bの骨行列が一致。
- ローカル配布版844×390で前/横/斜め/後退、射撃、切替後の射撃、回避。JS・兵士・3武器の配信ハッシュ一致、開発診断非露出。
- 静止画で兵士・背中武器の表示を確認。動きの評価は前工程の通常速度・方向比較動画に基づく。
- 変更前のローカル配布JSと公開JSが完全一致（SHA256 `32ba70865065e7456c8385bd23ebdce3b4aa655a55ec3c74e3f574c2982a7575`）。既存未コミット作業を巻き戻さず今回分を追加。
- Cloudflare既存アカウントの管理画面でFree / $0 / Current planを当日確認。ホームの過去24時間は全体1.25k requests、Worker呼出23、Worker errors0、CPU P90 1ms。契約変更なし。CLIの契約APIは403のため画面で確認した。

証拠: `dist-validation/trooper-sprint-adoption/`（preservation、default-equals-selected-b、distribution-validation、published-baseline、deploy.log）。

## 残課題

比較時の足滑りと開始/停止・後退への切替の滑らかさは未解消。Bは比較済みの動きそのままで、今回新しい遷移補正は追加していない。実スマホ機体での操作は未検証。正式採用時はこれらの実プレイ評価を元に追加調整する。

Git: `codex/home-armory` / HEAD `4186f25f7c9695f95ea897ad182db5f85fac3091`。既存を含む未コミット・未追跡変更あり。commit/push/mergeは実施しない。

## 公開

既存Workerへ `npx wrangler deploy --config wrangler.production.jsonc` 成功。Version `b3978663-7e39-41ac-9350-b3a2fed2198f`。更新アップロードはindex.html、client JS、Sprint v8 GLB/JSONの4ファイル。

URL: https://swarm-front.melosalife-24.workers.dev

公開後も844×390で移動・射撃・武器切替中の射撃抑止/切替後射撃・回避が成功。JS、CSS、兵士、3武器、採用JSONがローカルとハッシュ一致。モデル4件ロード、描画例外0、開発診断非露出、`/api/health` 200/ok:true。結果は `published-validation.json` / `published-metadata.json`、画面は `published-844-*.png`。
