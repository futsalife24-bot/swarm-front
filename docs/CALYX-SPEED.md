# CALYX 移動・回転3倍

2026-09-21。base `9d201a7675f4a45a32724353ce422ec9b0ab05a5`、branch `codex/calyx-speed-three`。

移動0.65→1.95m/s。ゲームの距離駆動は既存の0.65m/clip秒を維持するため回転も3倍（6→2秒/周）。レポートの移動表示も3倍。待機・打撃・花粉発射の時刻、攻撃判定は維持。移動後の位置からターゲットへの向きを更新。

根の中間制御を外へ0.30m、浮遊中の先端を最大0.45m広げ、接地前後で滑らかに戻す。実物理ではなく遠心力を思わせる造形済み動作。接地先端の軌道と連続曲線ウェイトを維持する。GLB・Blender原本・生成器を更新し、モデルURLの版も更新。

検証: client/Worker型チェック、CALYX/structure-motionの22テスト成功。Blender別プロセスで原本を開きGLB再読込、全authored 30fpsの有限値・床・ループ・接地・根制御骨相対回転、花弁/根の交差検査成功。公称0.65m/sの素材時刻で接地ずれ4e-7m未満、同じ距離駆動を3倍速で使う。実IABで16骨/4クリップ読込、29.35秒時点の周回距離14.009m、エラー0。実ローカルWorker2接続で敵/雲/HP一致、9996HP。証拠 `evidence/calyx-speed/`。

GLB SHA256 `d1a7573d5976e28492be14e8fbe25c880ea93ed96946c7859c8c3f558089d9ad`。13,990三角形/16骨/5材質/629,024bytes、旧版と同じ負荷規模。

限界: 衝突検査は離散フレーム。曲線周回による接地ずれ・実スマホ性能・長時間プレイは未測定。会敵動画は待機動作のみのため今回変更なし。Judgeは正規game入口で固定needs_context/live not_run（新規対象なし）、API0。別worktree変更の承認とは扱わない。

独立監査・main反映・公開は未完了。

PR64 / 対象53669a9489dfd8da8fde24f2f74988e0be76b8f5のbuild/dry-run成功。実IABの追加GPU遷移549ケース成功（gpu-transitions.json）。[独立監査](https://chatgpt.com/c/6ab08a55-d3cc-83ee-adb8-ce3fe2524355)へCALYX-53669a9-audit.zip送信済み。SHA256 3F6522828B8B88F7EBC90337306DEFE1369929F61923CCCA812D57EE54E6F401。判定待ち。

独立監査53669a9は合格・必須0。監査側16項目/GLB454フレーム独立計算成功。任意: 根同士の交差検査追加（交差検出ではない）。Free契約を実IABで確認、9/21 DO使用量43 requests/0.757GB-s/SQL read369 write34。後続7161d7d以降は記録のみ。

## 公開結果
PR64通常merge。公開source 91a2d379636d6d0e24897641c9c5b754936ad985、Worker Version 18ae92fc-b370-4294-99b5-bb934e0de0a8。main build/dry-run成功、公開14ファイルのSHA一致・health成功（release-verification.json）。公開IABは保存保護画面のため操作未確認。保護解除/データ変更は行っていない。ローカル実描画は検証済み。後続は記録のみ。
