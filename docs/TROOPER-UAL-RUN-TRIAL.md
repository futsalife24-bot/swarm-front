# UAL 走り移植・比較試作（2026-09-13）

正式採用前の比較用。通常プレイの既定GLBは `standard_trooper_v7.glb` のまま。公開・commit・push・mergeなし。

## 現物と保護

- Windows上の `game/` が今回の実物。クラウドの別コピーではない。
- ブランチ `codex/home-armory`、開始HEAD `4186f25f7c9695f95ea897ad182db5f85fac3091`。開始時から多数の未コミット変更あり。
- Blender実測版: 5.2.1 LTS。既存 `stance-v7/trooper_stance_v7.blend` を読んで処理。
- 実行時モデル: 57骨、18クリップ。既存メッシュ、ウェイト、骨の階層・基準姿勢、材質、武器ソケットを保持。
- 元GLBのJSON（meshes/nodes/skins/materials/textures/images）と既存アニメーション、およびバイナリ全体を保持して新規アニメーションを追記。元ファイルには書かない。
- 既存スクリプトのGLBデータ保持方式と `StandardTrooper` の上下半身分離・足着地遷移を再利用。

## 出典と取得

- 作者配布: https://opengameart.org/content/universal-animation-library
- 作者説明: https://quaternius.com/packs/universalanimationlibrary.html
- 配布ページ内で確認した実ZIP: https://opengameart.org/sites/default/files/universal_animation_librarystandard.zip
- 取得日: 2026-09-13（日本時間）。Standard無料版、ログイン・購入・兵士アップロードなし。
- ZIP SHA256: `18ff1a7215f4852b320203e8aaf02a1578b5c8eef9027fbaedfcedc7b85a3ac2`
- Godot版GLB SHA256: `1b7bf67866360665426bb99e4c71bd619f19b408453c24e30f0c3071601eee5c`
- 配布ページと同梱 `License.txt` は CC0 1.0。商用利用・変更・再配布を許容する条件。原素材は今回の方針に従い非公開作業領域に保存。
- ライセンス確認元: https://creativecommons.org/publicdomain/zero/1.0/
- ローカル通信は最初ソケット権限で失敗。正規の権限審査で取得成功。認証回避や非公式ミラーは使用していない。
- 原本ZIP・展開物: `dist-work/run-transfer-20260913/source/`（Git除外）。公開フォルダへコピーしない。
- Godot版GLBを使用。元の骨格と基準姿勢 `A_TPose` も含む。Unity/Unreal用FBXもZIP内にあるが移植には不使用。

実ファイルは45動作＋基準姿勢の46クリップ。120種が無料とは扱わない。

```text
A_TPose, Crouch_Fwd_Loop, Crouch_Idle_Loop, Dance_Loop, Death01,
Driving_Loop, Fixing_Kneeling, Hit_Chest, Hit_Head, Idle_Loop,
Idle_Talking_Loop, Idle_Torch_Loop, Interact, Jog_Fwd_Loop,
Jump_Land, Jump_Loop, Jump_Start, PickUp_Table, Pistol_Aim_Down,
Pistol_Aim_Neutral, Pistol_Aim_Up, Pistol_Idle_Loop, Pistol_Reload,
Pistol_Shoot, Punch_Cross, Punch_Enter, Punch_Jab, Push_Loop,
Roll, Roll_RM, Sitting_Enter, Sitting_Exit, Sitting_Idle_Loop,
Sitting_Talking_Loop, Spell_Simple_Enter, Spell_Simple_Exit,
Spell_Simple_Idle_Loop, Spell_Simple_Shoot, Sprint_Loop,
Swim_Fwd_Loop, Swim_Idle_Loop, Sword_Attack, Sword_Attack_RM,
Sword_Idle, Walk_Formal_Loop, Walk_Loop
```

走りは2候補のみ。Crouchはしゃがみ移動、Walkは歩行なので3種目として水増ししない。無料版にライフル保持専用走りはない。

## 骨格対応と補正

| 兵士側 | 配布側 | 扱い |
|---|---|---|
| Root | root | 兵士の原点を保持、移動はゲーム側 |
| Pelvis | DEF-hips | 周期的な上下・左右動を移植。線形移動を除去、腰回転は照準保護のため抑制 |
| UpperLeg_L/R | DEF-thigh.L/R | 元関節位置を体格補正し2骨IKで兵士の骨長へ適合 |
| LowerLeg_L/R | DEF-shin.L/R | 膝方向を元動作から取得し骨長を維持 |
| Foot_L/R | DEF-foot.L/R | 基準姿勢差を補正した足回転 |
| Toe_L/R | DEF-toe.L/R | 基準姿勢差を補正したつま先回転 |
| Spine以降・腕・指 | 移植しない | 現行の武器保持・照準・射撃を使用 |
| 武器用4ソケット | 対応なし | 現行の名前・位置・向き・親を保持 |

配布側は -Y前方、兵士は +Y前方なのでZ軸180度を補正。脚長比は1.0048966。骨名だけの置換ではなく、関節位置・骨長・基準姿勢差・足裏位置を使って焼き込む。

靴底の実頂点から沈みを測り、必要な分だけ腰を持ち上げる（Jog最大約5.75cm、Sprint約6.56cm）。滞空時の上下動は残す。120分割でサンプリングし、線形補間で保存。ループ端点差はこの素材では0。

歩幅は靴底2cm未満の連続接地区間における足首の後方移動量の中央値から算出。全候補のゲーム移動速度は7m/s。回避は既存17m/s。3.5m/sはアナログ半入力相当の補助検証。

| 対象 | 1周期距離 | 元クリップ周期 | 7m/sでの素材再生倍率 |
|---|---:|---:|---:|
| 現行 | 2.600m | 現行の設定 | 現行距離駆動 |
| A Jog_Fwd_Loop | 4.937m | 0.9333秒 | 1.3232倍 |
| B Sprint_Loop | 5.214m | 0.6667秒 | 0.8951倍 |

上半身は現行クリップの周期に位相を合わせ、候補の下半身は距離で駆動。移動速度自体は変更しない。後退は全候補で現行の専用後退クリップを保持する。

## 起動・操作

`game/` で `npm run dev -- --port 5340`。

- 比較: http://127.0.0.1:5340/scripts/run-transfer-review.html
- 現行ゲーム: http://127.0.0.1:5340/
- Jogで実ゲーム: http://127.0.0.1:5340/?runTrial=jog
- Sprintで実ゲーム: http://127.0.0.1:5340/?runTrial=sprint

比較画面の候補ボタン、側面/背面/ゲーム寄り視点、3武器種、一時停止、0.25倍、実移動/その場を使用。「現行へ戻す」で即座に復帰。開発用ゲームの選択はURLだけで永続設定に残らない。

これらはPC内のローカルURLであり、スマホからのアクセス手段ではない。スマホ向けにはGoogle Driveの比較動画を提出する。

## 再生成・証拠

```powershell
& 'C:/Users/futsa/AppData/Local/Programs/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --python-exit-code 1 --python scripts/build-run-transfer.py -- jog
& 'C:/Users/futsa/AppData/Local/Programs/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --python-exit-code 1 --python scripts/build-run-transfer.py -- sprint
node scripts/qa-run-transfer.mjs
node scripts/check-run-transfer-game.mjs
node scripts/record-run-transfer.mjs
node scripts/encode-run-transfer.mjs '<既存FFmpegの絶対パス>'
```

試作: `assets/blender/candidates/trooper/ual-run-20260913/{jog,sprint}.{blend,glb,json}`。
証拠: `dist-work/run-transfer-20260913/`。`baseline.json`、`rig-inventory.json`、`gait-runtime-qa.json`、`actual-game-qa.json`、`video-capture.json`、最終`evidence.json`を参照。

## 今回の検証結果

- 型チェック成功。関連テスト（兵士・照準）14件成功。ビルド成功、従来の500kBチャンク警告あり。
- 元モデルと正本BLENDの開始時SHA256一致を確認。既存素材の上書きなし。
- 描画用fixture: 現行＋2候補、3武器種、5方向、3.5/7m/sの90ケース。繰り返し停止・再開、照準、射撃状態、装填、切替、回避、被弾状態を実アニメーション制御に通し、有限姿勢を確認。
- 実ゲーム: Jog/Sprint双方で通常のソロ開始と入力操作。前後左右、停止、移動射撃、装填開始、移動中の2丁切替、切替後の射撃、回避と復帰を確認。装填完了前の切替は現行仕様で装填を取り消す。
- 実ゲームの検証画面は800×450のデスクトップChrome。スマホ実機検証ではない。被弾は描画fixtureと既存ロジックテストで確認し、実ソロで故意に被弾する確認は未実施。
- 見た目: 比較動画の側面・背面・ゲーム寄り視点から12標本ずつを確認。大きな手と銃の離れや背面武器の脱落は見られない。全武器・全遷移の貫通を定量的に保証するものではない。
- 動画: 各12秒、1280×720、H264/yuv420p、30fps。1/60秒の実アニメーション更新を2回進めて1フレーム記録。フレーム補間やスロー化は行わず、両MP4の全360フレームをデコード成功。
- MP4化には既存 `references/pps-video-20260911/tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe` を再利用。Blenderの動画変換スクリプトも残しているが提出版は `encode-run-transfer.mjs` の出力。
- 公開ビルドに候補素材URLと開発用ローダーモジュールが入らないことを確認。通常の既定値は現行。

Google Driveへのアップロードは、接続先 `melosalife.24@gmail.com` の専用フォルダへの明示承認後に2本とも成功。メタデータ読み直しでファイル名・バイト数・保存先・所有者限定の非公開状態を確認した。

- [A Jog比較動画](https://drive.google.com/file/d/1_8lE_LPyULTIp8jgGl8kTCboGEz1xvsS/view?usp=drivesdk)
- [B Sprint比較動画](https://drive.google.com/file/d/1zLrp-odgcmE72V4rOdfhGyGwnfM2qj-4/view?usp=drivesdk)
- 共有検証記録: `dist-work/run-transfer-20260913/drive-sharing.json`

## 比較所見と残る範囲

| 候補 | 良い点 | 違和感・修正余地 |
|---|---|---|
| 現行 | 接地速度が安定し、既存の構えへ連続する | 歩数が多く、小刻みな印象 |
| A Jog | 大きな歩幅、前脚の回収が明確。比較の第一候補 | 現行よりゆったりした周期。高速戦闘との好みの確認が必要 |
| B Sprint | 膝の折り畳みと蹴り出しにJogとの差がある | 接地の端の足滑りが多め。元の前傾は照準保護のため抑えた |

接地付近の速度差比（足首速度と地面速度の差）の中央値は現行0.4%、Jog4.8%、Sprint11.3%。最大値は着地・離地を含むためそれぞれ51.9%、36.0%、103.5%。この数値は全場面の足滑りゼロを保証しない。

平面上の実靴底最小高さは候補とも約2mm、ループの足位置差は0.001mm未満。上記は数値検証であり自然さの採用判断とは分ける。

正式採用時はメロニキの選択、特にSprintの接地端の追加調整、必要に応じて坂・段差・低FPS・実機確認、採用用素材への整理と既存の公開/監査手順が必要。今回の試作に本番変更・採用確定は含まない。
