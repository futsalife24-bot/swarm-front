# HARROW 二脚モーション v12

モデル・UV・ウェイト・材質は `../charakuru-20261011/harrow.blend` を維持し、動作だけを作り直す候補。本人の攻撃指定と参照映像の観察は [仕様記録](../../../../../docs/HARROW-BIPED-ATTACKS.md) を参照。

## 再生成

Blender 5.2.1 LTS を使用。リポジトリルートで以下を実行する。

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --disable-autoexec --python-exit-code 1 --python assets/blender/candidates/harrow/biped-v12/build_motion.py
node assets/blender/candidates/harrow/biped-v12/verify_asset.mjs
```

`build_motion.py` は元原本を開き、動作を再構築して別の `harrow.blend` / `harrow.glb` へ保存する。元原本は上書きしない。39骨、Blender上20メッシュオブジェクト、GLB上22材質プリミティブ、18クリップ。ゲーム描画時は同材質を結合し3バッチを使う。Root移動・旋回は権威サーバーが担当する。

## 実物の検証

- `verify_asset.mjs`：v11と頂点・法線・UV・ウェイト・インデックスの完全一致、18クリップの長さ、有限値、Root固定、選定姿勢の床貫通、翼爪先端座標。
- `review/inspect_blend.py`：保存した `.blend` を別プロセスで開き直し、骨・メッシュ・18動作・画像の内包を検査する。原本は保存し直さない。
- `review/check-gait-boundaries.mjs`：実GLBを60Hzで評価し、権威の前進を合成した接地足のずれと、クリップ端点の骨位置差を記録する。
- `scripts/check-harrow-asset.mjs` / `check-harrow-launchers.mjs`：配信用v12と実翼爪・戦闘側発射元を照合する。旧v6専用検査は `check-harrow-v6-*.mjs` に保持する。
- `scripts/check-harrow-network.mjs`：ローカルWorkerと2つの実WebSocketを使う。通信をモックへ置換しない。

ブラウザのモデル単体確認は `preview.html`、実ゲーム描画は `scripts/harrow-preview.html`。後者は `node scripts/harrow-encounter-server.mjs` で起動する既存5200番のローカル録画サーバーへ画像・動画を保存できる。今回のファイル名は `ui-v12-*` とし旧記録を上書きしない。録画サーバーは公開ビルドへ含まれない。

## 制作上の判断

歩行は支持脚を固定して胴体を左右へ乗せ、首と尾を遅れて動かす。回転は低い伏せ姿勢から一回転し、両翼の床接触を検査する。直射では翼爪を前へ向けて発射中の姿勢を保持する。離陸は4通りの左右非同期の羽ばたきを権威側の乱数で選び、予備動作中は地面から離れない。爆撃は移動する実翼爪から左右5発ずつを出す。急降下は二脚を前へ出し、着地へ収束する。

検証JSONの数値は自己検証の証拠であり、本人の見た目の承認や独立監査の合格を意味しない。端点差はブレンド前の値で、実表示の補間も別途確認する。実スマートフォンの性能・長時間GPU使用は未確認。
