# 兵士の走り v6（2026-09-11）

参照：[モーション工房「走りアニメーションの作り方」](https://www.youtube.com/watch?v=lK6iiZBxJuk)。字幕と代表姿勢を確認し、接地後の沈み込み、片脚の蹴り出し、空中姿勢、腰と胸の逆回転を本作の両手武器保持へ適用した。裸手の大きな腕振りは採用していない。

## 変更・再現

- `assets/blender/scripts/build_trooper_run_v6.py`：承認済みstage4のblendから走り4クリップだけ再制作。元のblendは保持。
- `assets/blender/candidates/trooper/run-v6/trooper_run_v6.blend`：編集可能な新原本。旧RunはPreviousV5名で保存。
- `public/assets/characters/standard_trooper_v6.glb`：前進・後退と各Rocket版。新アニメーションを旧GLBへ移植し、形状・材質・骨格・残る14クリップは保持。
- `src/client/standard-trooper.ts`：v6読込、移動距離に対する1周期を4.2mから2.6mへ。ゲームの移動速度7m/sと戦闘ルールは変更していない。
- 制作クリップは0.8秒。実プレイでは移動距離に同期し、7m/s時は約0.371秒/周期。映像の通常速度もこれに合わせる。

再生成はgameを作業ディレクトリにして、インストール済みBlender 5.2で `--background --python-exit-code 1 --python assets/blender/scripts/build_trooper_run_v6.py`。

## 自己検証

型チェックと関連9単体テスト、production client build、Worker dry-run成功。初回dry-runはsandboxのログ/読取制約で失敗し、通常権限で成功。既存500KB超チャンク警告あり。

実ブラウザ・実StandardTrooperで4走り各48姿勢を計測。足裏の最低値は約+2mm、両足が15mm以上浮く標本は前進16/48、後退18/48。腰の上下幅は約11.8cm（旧約5.4cm）。ループ端点の原本行列差0。

接地中の位相0.105→0.19で、Foot_Rのワールド移動と実移動距離を合成した滑りは旧約21.5cm→新約0.09mm。これは平坦面・同区間の計測で、全接地期間や坂道での完全固定を意味しない。離地後に脚長を越す最大約34mmの目標をIKで脚長へ制限。接地標本の浮き・貫通は上記の実スキンで検証。

実stepと本体クラスで5方向の走り、装填・切替・回避の有限姿勢を確認。`browser-checks.json` のruntime.distanceは原点からの距離であり、移動距離の合否指標には用いない。配布版の出撃・兵士表示・Q切替をブラウザ確認。実スマホ・インターネット協力は未確認。独立Chat監査は今回実施していない。

## 比較動画

[Google Driveの動画](https://drive.google.com/file/d/1EGo9kquS10WCTxw2Gn101c0H_h2yb3Gh/view?usp=drivesdk)

左v5／右v6、同一移動速度、横→正面→ゲームに近い後方角度とRocket→横0.5倍速。実ブラウザの連続描画を録画。1280×720、23.967秒、30fpsのMP4、719フレームを全デコード。フレームレート変換には録画遅延分の重複フレームが含まれ、実機30fps性能証明ではない。Driveのファイル名・MIME・5,241,355bytes・保存先をreadback確認。

比較画面は `assets/blender/candidates/trooper/run-v6/compare.html`。Vite 5326、`node scripts/serve-trooper-recording.mjs` 5327で録画と検証を保存。録画専用の初回開始時刻エラーは修正後に再収録し、納品MP4は正常な後者。証拠は `dist-validation/trooper-run-v6/`。

## 差分・状態

branch `codex/home-armory`、base/head `2be699f160c83d641fb68bb1304e4da8059920dc`。既存の未コミット・未追跡差分を保持、commit/mergeなし。今回の前後TS・更新履歴・状態文書は同証拠フォルダのbeforeに保存。走り生成スクリプト、新GLB/blend、比較ページ、録画受信スクリプト、更新履歴・状態文書が今回の対象。詳細のハッシュと差分はchecks.json/task.patch。

既存Workerへ公開済み。Version `bc5d9aa7-598b-4773-8fa7-1cb9b602348f`。公開先 https://swarm-front.melosalife-24.workers.dev 。公開JS/CSS/新兵士GLB/既存契約JSON/武器3点の7ファイルがdistとSHA-256一致、API healthは200/ok。新GLBのSHA-256は `85d1ddc6e19fc67690309db916d14660bd34b6ea6fc6587de605a0d255239405`。

公開版の出撃と新兵士表示を確認。別件の所見として、ローカル配布版を放置中に、今回未変更の敵標的処理（src/shared/game.ts:910、t.id）でundefined例外を1件記録した。走り差分には同処理の変更なし。敵AI例外の修正・再現条件特定は今回未実施。
