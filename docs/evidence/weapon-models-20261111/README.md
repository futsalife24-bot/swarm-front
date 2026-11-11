# 武器個別モデルの途中検証

作業中の証拠。全12種類の完成・監査・公開を示すものではない。結果は `docs/STATE.md` の先頭と合わせて読む。

- `grenade-pose-comparison.png`: GL-6 を製品の兵士と2つの既存姿勢に持たせた静止画。ネオン枠は比較用に非表示。`node scripts/probe-grenade-pose.mjs` で再現する。
- `trooper-10.png` / `trooper-10-report.json`: GL-6・ST-3以外の10種類。実兵士の手持ち、背負い、装填3時点と製品の銃口を確認。赤い点・線は計測補助であり、実際の射撃エフェクトではない。`node scripts/check-weapon-trooper-matrix.mjs rifle,smg,shotgun,slug,rocket,heavy,sniper,laser,kick,medic` で再現する。
- `preview-11.png` / `preview-11-report.json`: 生成済み11種類の製品プレビュー関数と共有画像生成。実際の詳細ダイアログや共有送信の検証ではない。`node scripts/check-weapon-preview-sharing-matrix.mjs --available` で再現する。
- `ground-11-summary.json`: 既存地面接触検査をST-3以外へ同じ基準で適用した集計。不合格88条件は既存3種類にもある。`ground-runtime-sg4-sr1.png` / `ground-runtime-sg4-sr1-report.json` は既存SG-4と新規SR-1を実兵士の更新とブレンドで確認した平面上の局所検証。ゲーム内の地形・通信・手操作ではない。
- `grenade-projectile-60fps.png` / `grenade-projectile-report.json`: 実Rendererだが `fire()` の後 `step()` の前を人工的に描いた中間状態。通常のゲームプレイで表示されるとは限らない。
- `grenade-projectile-stepped.png` / `grenade-projectile-stepped-report.json`: 通常 `step()` 後の弾体を実Rendererで描いた隔離fixture。実UIや通信の検証ではない。2種類の画像は `node scripts/check-grenade-renderer-shot.mjs` と同コマンドの `--stepped` 付きでそれぞれ再現する。
- `grenade-ui-first-render.png` / `grenade-ui-after.png` / `grenade-ui-report.json`: 隔離ブラウザーの仮保存でGL-6を装備し、実際の出撃画面とPCのマウス入力で発射。描画の計測だけを追加したローカル単独プレイであり、協力通信や実スマホの検証ではない。`node scripts/check-grenade-ui-shot.mjs` で再現する。

スマホ実機の表示・負荷・音、ST-3の3D、全種類の実ゲーム画面、連続した装填・体の接触、実通信、独立監査、公開は未完了。
