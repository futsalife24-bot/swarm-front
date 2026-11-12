# 背負い武器・兵士・床の隔離計測

2026-11-12。製品へ変更せず、既存SG-4・新SR-1をそれぞれ背負い左右に持たせ、直接 `StandardTrooper.update` を60fps固定入力で実行した。回避10時点とダウン8時点の計18時点／武器・背負い位置で、`y=0` を平らな床として比較。ゲーム実操作やRendererの移動補間ではない。

再現（作業worktreeのルートで実行）:

```powershell
node scripts/floor-body-probe.mjs
python -X utf8 scripts/floor-clip-probe.py
```

前者は `dist-validation/floor-body-probe/report.json`、後者は `dist-validation/floor-body-probe/clip-report.json` に出力する。保存した今回の結果は `ground-body-probe-report.json` と `ground-clip-probe-report.json`。前者は隔離ブラウザーとローカルサーバーを使う。生成済みSR-1と既存SG-4を使う。

頂点は、ワールド行列を更新してから武器の全メッシュ頂点を変換し、ネオンの2メッシュだけ除外。兵士は `visible=true` の `SkinnedMesh` ごとに `getVertexPosition` で実際のボーン・ウェイトとバインド行列を適用し、`matrixWorld` でワールド座標へ変換した。各条件で計69,024頂点を処理し、兵士の最下点と床下1mm未満の頂点数を記録。親階層の不可視状態までは判定していないため、非表示の子メッシュが含まれる可能性がある。

この選択時点では兵士頂点の最小高さは2.2mm、床下1mm未満は0個。一方、武器の最下点はSG-4で最大310.6mm、SR-1で最大337.1mm床下。全身が同じ量だけ沈んだことでは説明できない。三角形内の接触、ネオン、身体と武器の交差、タイムステップ間、高低差、実地形、実通信、スマホは未検証。

後者は製品の `EVADE_DURATION=0.32` と `SOLDIER_ROLL_ROTATION_END=0.9` を読み、GLBの `Trial_Dodge_Roll` のtranslationとrotationをSTEP/LINEARで補間して比較。GLBのsceneには `soldierReferenceVersion` がある。回避の0.150→0.1667秒は元クリップ0.421875→0.46875秒に相当（約2.8125倍速）。同区間でPelvisのローカルYは約0.732→0.601mと連続的に下降し、回転も変わる一方、左右BackWeaponSocketのローカル平行移動・回転のキーは一定。既存全身動作を短い回避時間に圧縮したことが急速な接近に関係することと整合するが、実ゲームの移動や体表・武器の接触の原因をこれだけで断定しない。

従来の固定位置、垂直押し上げ、動的回転、将来姿勢を使う先読みの案は別の記録どおり自然さの根拠が不足。今回の計測も、床・体・武器を同時に満たす自然な修正を証明していない。
