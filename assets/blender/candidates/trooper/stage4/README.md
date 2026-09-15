# 兵士・第4段階 最終試作

**公開後追記：全4段階が監査合格し、本体v5への適用・装填モーション接続・既存Worker公開・公開後確認まで完了。** 最新の統合/公開結果は `game/docs/TROOPER-V5.md`、進捗は `../PROGRESS-LATEST.md`。以下の隔離検証時点の「本体未実装/未検証」記述は、その段階の範囲を示す。後続の本体検証では逆順装備、切替中の被弾、復帰、再開始も確認した。

## 成果物

- `trooper_stage4_candidate.blend`：人体・服・装甲・57骨、元15Actionと試作18Actionを保持。
- `trooper_stage4_candidate.glb`：試作18クリップ、57骨、48,384三角形。候補のみを書き出し。
- `index.html` / `serve_preview.py`：ゲーム本体から隔離したThree.js検証画面。正面／背面、縮小表示、動作選択、通常速度録画。
- `normal-speed-showcase.mp4`：実ブラウザの通常速度収録。静止レンダーをつないだ代替動画ではない。
- `motion-manifest.json` / `saved-candidate-validation.json` / `browser-validation.json`：保存・出力・再生検証。

## モーション

元の人体移動・脚・反動を利用し、改善した武器保持の上半身へ適合した試作。待機4、移動4、射撃3、往復持ち替え2、ローリング1、吹っ飛び／復帰1、装填3の計18本。元15本はカーブ・ハンドル・補間を含めて保持。

装填は左手が給弾／エネルギー供給部を操作するSF向けジェスチャー。個別の弾薬・排莢・マガジン交換の物理再現は含まない。ゲーム本体に装填アニメーション選択は未実装で、本試作の検証画面だけで再生する。

## 接続条件

BlenderはZ上・Y前、GLBはY上・Z負方向が前、単位m。身長上端Z=1.866500m、接地Z=0.000500m、全高1.866000m。ゲームのスケール・当たり判定は変更していない。

代表編成はスロット0=ライフル／ショットガン、スロット1=ロケット。持ち替えは元の1秒クリップを0.5秒で再生し、45%で格納、60%で取り出す。武器GLBの軸補正はX=90度。通常遷移80ms、ローリング即時・0.32秒、吹っ飛び1.2秒。

段階2からの承認済み追加変更は背面2ソケットと固定具、脇周辺ウェイト。ライフルは後方65mm・銃身軸反転、ロケットは外側100mm。残る55骨レストを保持。身体の頂点座標・面を保持し、脇の誤った腰ウェイトだけ復元・平滑化。

## 今回の完了基準と残る範囲

ユーザーの明示方針と監査役の更新基準に従い、通常速度・ゲーム表示サイズで目立つ重大な破綻を確認する。一瞬の手首・武器・服の干渉をゼロにする検証は要求しない。持ち替えの中間姿勢には微細な食い込みや速い腕回転が残り得る。

本体のネットワーク対戦、任意の逆順装備、持ち替えと吹っ飛びの同時レイヤー合成、全てのゲーム状況は未検証。移動はその場のクリップで、実際の移動量はゲーム側の責務。フルゲームへの適用や公開は今回の範囲外。

## 再現

リポジトリの `game/` から、Blender 5.2.1で順番に実行する。

```powershell
& $blender -b --python assets/blender/candidates/trooper/stage3/build_switch.py -- --rocket-x .325 --out experiments/rocket_x_0325_route3
& $blender -b --python assets/blender/candidates/trooper/stage3/build_remaining_motions.py
& $blender -b --python assets/blender/candidates/trooper/stage4/verify_saved_candidate.py
& $python assets/blender/candidates/trooper/stage4/serve_preview.py
```

`$blender` と `$python` はローカルの実行ファイルパス。`http://127.0.0.1:8768/` を開き「通常速度で全動作を確認・録画」を押す。既存の `game/node_modules/three` とコピー済みの武器3ファイルを使う。公開サーバーや外部APIは使用しない。

第1・2段階の提出物と再現手順はそれぞれ `../stage1/README.md`、`../stage2/README.md` に保存。以前の試作・提出物は保持。
