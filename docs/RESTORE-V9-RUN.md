# 走行だけをv9へ復元（2026-09-16）

ユーザーがDrive比較を見て「前のv9に直して」と指定。対象は走行。歩行・AR/SG構え・既存モデルは維持する。開始mainは `61eed2eba819618169d0d484d9a29f182efd4bf7`、branch `codex/restore-v9-run`。公開まで継続承認済み、独立監査後にmain反映・公開する。

## 変更

- v10 GLBに保全された元Run/Run_Rocket上半身とUAL_sprint下半身を再採用。周期歩幅も元の5.21351158618927へ戻す。
- Combat_Run/Combat_Run_Rocketは素材内に保全するが通常走行では使わない。GLB/Blenderバイナリ変更なし。
- 走行にv10用Foot Lockを掛けない。歩行とLow Ready/Aimはv10を維持。移動速度・武器性能・通信は変更なし。
- 復元後のWalk↔Run位相で露呈した、平らな靴底の同高頂点が浮動小数点誤差で入れ替わる問題を修正。歩行の接地中は選択した靴底ローカル点を保持し、接地固定の位置が横へ飛ばないようにする。

## 検証

`scripts/check-trooper-run-restoration.mjs`で実GLBを読み、v9と復元後のRun/Run_Rocket/Upper_Run/Upper_Run_Rocket/Lower_Runの全track時刻・値・durationを完全比較。AR/SG/RL各240フレームの通常走行姿勢を比較し最大差は約7.22e-8、周期歩幅一致、走行Foot Lockなしを確認。これは照準解除時の定常走行比較。明示Aim/射撃では新しい構え/Fire優先を維持するためv9全挙動の巻き戻しではない。

歩行接地・Idle/Walk/Run/Aim遷移、骨長、保持、武器切替、ループも確認。型、関連14テスト、両build成功。通常出撃の開発844×390/ビルド1280×720で移動・射撃・装填・切替に成功。復元後の実ゲーム録画も取得。実スマホ・実マルチ・斜面は未検証。証拠は `dist-validation/restore-v9-run/`、録画は `dist-validation/restore-v9-run-record/`。
