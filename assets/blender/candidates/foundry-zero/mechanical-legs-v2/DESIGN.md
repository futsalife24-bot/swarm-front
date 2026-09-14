# FOUNDRY ZERO 支持脚 v2

2026-09-12、ユーザーの「脚が人間のようで気持ち悪さが勝るから変えて」に対応。対象は添付画像の連結炉形態。自己検証後にゲームへ反映する修正であり、新たな基準モデルの見た目承認ではない。

- 太もも・ふくらはぎに見える中央の膨らみ、足首への強い絞り、前へ伸びる靴状の足先を除く。
- 上部は一定断面の角材、下部は露出した支柱と角型アクチュエータ。関節は軸の見える円盤、接地部は前後対称の小型パッド。
- 元の素材5種を使用。頭1＋胴7、34脚、7接続部、レーザー器官、胴体・頭部の形状を保つ。
- 支持脚の付け根・折れ点・接地点と剛体パーツの分割を固定。既存の距離同期・接地IKを利用する。
- sharedの戦闘仕様は変更しない。通常4.2m/s、分離後6.3m/s、節間3.2m、レーザー予告0.8秒・間隔3.2秒・威力10・弾速60m/s・射程100m、発射原点は src/shared/foundry-defs.ts のまま。HP・当たり判定・抽選・生成・報酬も変更しない。
- seedなし。segmented-v1の生成器・補助コードを候補内へコピーし、別Blenderプロセスから再生成。旧モデル・元生成器は保全。
- 暫定予算は旧36,628tri、5素材、34脚。素材やランタイムバッチを増やさず、形状の整理による負荷を測る。

開始branch `codex/home-armory`、base/HEAD `4186f25f7c9695f95ea897ad182db5f85fac3091`。既存の未コミット差分あり。開始時コピー・ハッシュ・Git状態は `dist-validation/foundry-mechanical-legs/`。

再生成（gameルート、インストール済みBlender）:

```powershell
& 'C:/Users/futsa/AppData/Local/Programs/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --python-exit-code 1 --python assets/blender/candidates/foundry-zero/mechanical-legs-v2/build_candidate.py
& 'C:/Users/futsa/AppData/Local/Programs/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --python-exit-code 1 --python assets/blender/candidates/foundry-zero/mechanical-legs-v2/verify_saved.py
```

標準GLTFLoader・保存済み屈曲プレビューのAnimationMixer検査、現行ゲームの実描画・歩行/分離・足滑り・砲口検査、同じカメラ条件での新旧比較を行う。スマートフォン実機の性能は別の未検証項目。
