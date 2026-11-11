# 武器個別モデルの途中検証

作業中の証拠。全12種類の完成・監査・公開を示すものではない。結果は `docs/STATE.md` の先頭と合わせて読む。

- `grenade-pose-comparison.png`: GL-6 を製品の兵士と2つの既存姿勢に持たせた静止画。ネオン枠は比較用に非表示。`node scripts/probe-grenade-pose.mjs` で再現する。
- `trooper-10.png` / `trooper-10-report.json`: GL-6・ST-3以外の10種類。実兵士の手持ち、背負い、装填3時点と製品の銃口を確認。赤い点・線は計測補助であり、実際の射撃エフェクトではない。`node scripts/check-weapon-trooper-matrix.mjs rifle,smg,shotgun,slug,rocket,heavy,sniper,laser,kick,medic` で再現する。
- `preview-11.png` / `preview-11-report.json`: 生成済み11種類の製品プレビュー関数と共有画像生成。実際の詳細ダイアログや共有送信の検証ではない。`node scripts/check-weapon-preview-sharing-matrix.mjs --available` で再現する。
- `shot-effects-11.png` / `shot-effects-11-report.json`: 銃口のネオン除外と方向修正後、生成済み11種類の実発射イベントと兵士・射撃エフェクトを局所検査。銃口炎と存在する発光弾の開始位置はいずれも製品の銃口に一致。GL-6の短い発光弾と銃身方向の差は、修正前の約7.68度（`shot-effects-11-before`）から約0.011度になった。散弾の各線には仕様上の広がりがある。通信・弾体飛行・実機は未検証。`node scripts/check-weapon-shot-effects-matrix.mjs --available` で再現する。
- `ground-11-summary.json`: 既存地面接触検査をST-3以外へ同じ基準で適用した集計。不合格88条件は既存3種類にもある。`ground-runtime-sg4-sr1.png` / `ground-runtime-sg4-sr1-report.json` は既存SG-4と新規SR-1を実兵士の更新とブレンドで確認した平面上の局所検証。ゲーム内の地形・通信・手操作ではない。
- `ground-renderer-sg4-sr1.png` / `ground-renderer-sg4-sr1-report.json`: 地形を読み込んだ実ゲームRendererの844×390画面で同じ2種類のダウン・回避と両背負い位置を固定入力で比較。床に隠れる場面を確認。実操作・移動・他地形・通信・スマホは未確認。`node scripts/check-weapon-floor-renderer.mjs` で再現する。
- `ground-offset-review.md`: 背負い位置を固定変更する4案の検証結果。いずれも床下の問題を解消できなかった。
- `grenade-projectile-60fps.png` / `grenade-projectile-report.json`: 実Rendererだが `fire()` の後 `step()` の前を人工的に描いた中間状態。通常のゲームプレイで表示されるとは限らない。
- `grenade-projectile-stepped.png` / `grenade-projectile-stepped-report.json`: 通常 `step()` 後の弾体を実Rendererで描いた隔離fixture。実UIや通信の検証ではない。2種類の画像は `node scripts/check-grenade-renderer-shot.mjs` と同コマンドの `--stepped` 付きでそれぞれ再現する。
- `grenade-ui-first-render.png` / `grenade-ui-after.png` / `grenade-ui-report.json`: 隔離ブラウザーの仮保存でGL-6を装備し、実際の出撃画面とPCのマウス入力で発射。描画の計測だけを追加したローカル単独プレイであり、協力通信や実スマホの検証ではない。`node scripts/check-grenade-ui-shot.mjs` で再現する。
- `grenade-ui-after-direction.png` / `grenade-ui-after-direction-report.json`: 発光弾の方向修正後に同じ実ゲームUIで再確認。発射、弾体と銃口炎の存在、ページ例外0を確認した。短い発光弾は初回描画には残っておらず、見た目の方向はこの画像だけでは判定できない。

スマホ実機の表示・負荷・音、ST-3の3D、全種類の実ゲーム画面、連続した装填・体の接触、実通信、独立監査、公開は未完了。
