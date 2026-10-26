# HARROWの立体予告・公開記録（2026-10-26）

本人の比較画像への「はい」で採用・本体実装を承認、その後「公開して、次の作業ある？」で既存Workerへの公開を承認。

## 対象と保護

- 公開準備base: main `e455c2473e575f5d4782311b91bb9ffc70ceb548`。作業branch `codex/harrow-beacon-release-20261026`、元worktree内の無視対象 `dist-h/` に隔離。
- 元branch `claude/motion-toggle-balance-20261019` / `a3d8f076935620b2c264825bb3b849c544e2842f` の未コミット成果と他担当差分を保持。元branchの未公開設定変更は含めない。
- 最新mainの既存改善、PWAアイコン、生存難易度調整を保持。別worktreeの武器・BASTION・Ω候補は取り込まない。

## 変更

密集で隠れる地面予告の位置を知らせるため、Dashの実予告両端と爆撃の着弾地点に6mの細い赤い目印を表示する。高さは攻撃範囲を表さない。既存予告期間に同期し、着弾・攻撃開始・世界解除で消える。壁の深度判定は維持。

`harrow-warning-beacons.ts` は最大42本のInstancedMeshと行列を再利用する。透明描画キューへ置くが不透明度は1。最初の試行では不透明キューで地形に上書きされる問題を検出し、修正後に画像を再検証した。戦闘数値・判定・時刻・敵数・通信・保存・報酬は無変更。

## 検証

- 元worktree: 関連62件、型、build成功。7攻撃条件×4視点の88画面、例外・資産エラー0。Dash/爆撃の24画面を目視、対象外5条件の目印数0。密集の赤画素はDash 0.75秒410、爆撃2.2秒266。壁6画面は赤画素0。描画呼出し増分は最大1。詳細は同日ローカル証拠を保持。
- 最新mainへの移植後: 関連4ファイル62件、client/worker型成功。最初のsandbox実行はWindows SSR一時ファイルENOENTで3スイート読込失敗、通常ローカル環境の同一コマンドで62件成功。期待値変更やテスト削除なし。
- 公開前のDash/爆撃24画面、build、Worker dry-run、公開後の配信照合は下記へ追記する。
- コマンド: `node ../node_modules/vitest/vitest.mjs run tests/front-harrow-beacons.test.ts tests/harrow-effects.test.ts tests/attack-telegraph.test.ts tests/harrow.test.ts`、TypeScriptの両config、`node scripts/check-play-polish-harrow-matrix.mjs --modes=dash,bomb --views=ground,edge,dense,wall --out=dist-validation/harrow-release/matrix`。

## 公開状態

現段階は準備中。main反映、Worker Version、配信SHA、health、実ブラウザ結果は確認後に追記する。GitHub branch情報はprotected=false、rulesets空、詳細protection取得は連携権限403。通常PR mergeを使い、保護設定は変更しない。

## 未確認・次の作業

実スマホでの同時操作・安全領域・継続プレイ、命中/撃破/耐性音の実聴、動く密集戦での長時間性能を残す。静止fixtureの画像や描画呼出し差を、実機性能・全画角の視認性合格とは扱わない。全体テスト既存失敗は今回の関連62件とは別で、再検証していない。新数値・報酬変更・訓練場本体・別候補採用は別承認。独立監査は未実施。主担当のモデルID/推論設定は未確認、子なし。

## 最新main上の表示再確認

Dash/爆撃の4視点24画面取得成功。資産・実行時エラー0。密集Dash、密集爆撃、壁爆撃の3画面を再目視し、密集で上部の目印が見え、壁は貫通しないことを確認。証拠: [検証情報](evidence/harrow-beacon-release-20261026/verification.json)、[表示状態](evidence/harrow-beacon-release-20261026/results.json)。

