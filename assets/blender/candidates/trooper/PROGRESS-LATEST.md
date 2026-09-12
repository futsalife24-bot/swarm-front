# 現在地（2026-09-11）

このファイルが今回の段階進行の最新状態。`PROGRESS.md` の古い保留・承認待ち記述は経過記録。

- 第1段階：独立監査合格。`stage1/audit-round2-pass.md`。
- 第2段階：独立監査合格。`stage2/audit-round2-pass.md`。
- 第3段階：18試作モーション制作・保存後再読込・原15Action保持の自己検証完了。独立監査合格。
- 第4段階：GLB、隔離Three.js表示、通常速度の全動作再生・録画完了。独立監査合格。`stage4/audit-final-pass.md`。
- モデル制作100%、全4段階合格。goal完了済み。
- 最終候補：`stage4/trooper_stage4_candidate.blend` / `.glb`。
- 最新動画：`stage4/normal-speed-showcase.mp4`、31.067秒、30fps。VP8の実ブラウザ録画をBlenderでMP4化。最初のVP9変換で時間情報誤読を検出したため再収録・変換し、実画像を確認した。
- 最新ブラウザ計測：Windows Chrome152 / Three.js185、平均59.95FPS。全18クリップ・57骨・ソケット接続を確認。
- ユーザーの基準変更：SFゲームとして通常速度・縮小表示での見え方を優先。一瞬の干渉や微細な不整合は許容。監査役も同意し、`stage3/audit-user-relaxed-criteria.md` に保存。
- ユーザーの追加指示：目標達成後に公開まで進める。本体へv5を適用し、型・関連12テスト・本体接続・実エンジン代表操作・配布版2サイズ・7ファイル一致・Worker dry-runに合格。
- 公開まで100%。Version `d499d59f-d9b4-493b-b61d-0b2949306813`。公開7ファイル一致・API200・PC/横持ちの新兵士表示と出撃/切替を確認。commit/push/mergeは未実施。元v4資産と既存の作業差分を保持。
