# HARROW v10 ゲーム採用・公開

2026-09-25。ユーザー指定のドラゴン胴体とコア浮遊・左右独立の不規則翼動作を、ゲームのHARROWへ採用する。制作候補と独立監査の記録は [v10設計](../assets/blender/candidates/harrow/v10/DESIGN.md)・[候補監査](../assets/blender/candidates/harrow/v10/AUDIT.md)。公開工程の判定と配信結果は本書に追記する。

## 変更と互換性

- base main `78616fc83b345ed0a75ca924050d596f1d018a9c`、branch `codex/harrow-v10-release`、作業場所 `../share-image-fix`。別作業中の `game/` は変更しない。
- ゲーム用GLBを `public/assets/enemies/harrow_motion_v10.glb` に追加し、HARROWのloaderだけをv10へ切替。新URLでService Workerの旧キャッシュを避ける。元のv9素材は保持。
- Flightは16.8秒ループ。左7回・右5回の独立した変動周期を保存済みGLBに焼き込み、胴体は翼と独立して高度を保つ。図鑑のFlight区間も同じ16.8秒へ合わせる。毎回新しい乱数を引く動作ではない。
- 空中ミサイルの発射時刻3.5秒では、AirThreatの左右の翼を既存の発射姿勢へ滑らかに寄せる。前後は独立周期の模倣を残す。ミサイルの時刻・位置・威力、戦闘AI、判定、飛行高度は変更しない。
- 再生成した採用GLBとBlender原本を同じv10候補に保存。採用GLB SHA256 `0a0dc30931eaf2461f1b352caba84e094f6eb2c3e00a0a03ca7a44329a387e56`、9,009,104 bytes。旧単体候補の監査GLBとは異なるため、ゲーム採用差分を改めて監査する。

## 自己検証

- 型チェック成功。HARROWモデル・攻撃・図鑑・描画状態の関連Vitest 6ファイル115件成功。特に地上/空中それぞれ10基の弾頭先端と権威側発射原点が一致。
- `verify_change.mjs`: 胴体以外183メッシュと、Flight/AirThreat以外10動作をv9から維持。Flight左右7/5周期・胴体固定を確認。
- Blender 5.2.1 LTSの別プロセスで保存原本と採用GLBを再読込し、全12動作が成功。
- 実配布ビルド・実GPU・独立監査・Worker公開の結果は、実施後に追記する。

## 制約

左右のランダムな速さは16.8秒で繰り返す有限アニメーション。実スマホの初回読込性能と人操作の難度はこの検証からは断定しない。
