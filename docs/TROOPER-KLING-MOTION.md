# Kling動作参照による兵士改善（2026-09-16）

## 状態と保全

歩行・走行・AR/SG構えをローカル実装・検証。当初はローカル限定。2026-09-16の「公開までやって」でcommit / push / merge / deployを承認済み。PR #10のHEAD `21283f21e3abbbd6de22dab26f8ea7033e6b5322` に独立監査合格・必須修正なしを受領し、main反映・既存Worker公開済み。ローリング動画は取得・閲覧・使用していない。既存回避の制作・調整は対象外。

- origin: `https://github.com/futsalife24-bot/swarm-front.git`
- branch: `codex/trooper-kling-motion`
- base/main/HEAD: `51773683b1a28af03ecc2e78b9cbf70fc5d3b6e6`。開始時GitHub main一致・clean。この開始点から今回成果をcommitしてPRへ提出する。対象HEADはPRで確認。
- バックアップ: 親フォルダー `trooper-motion-backup-20260915/main-5177368.zip`、開始時の全追跡ファイル477667025 bytes。
- ZIP SHA256: `5c5c8431469633bb3deaf57ac4edaf28d5518ec6bb1c569cff4a9de4bc6c5a04`
- v10 GLB SHA256: `60a9e694a19c510c7c8f6b4007600fd8e283a699c422dd143b3a860b3cfb0ec4`。public / dist / dist-pages一致。
- v10 blend SHA256: `25f3810900c2d53590b0b036784bedfed020b762cebfe6fe5c5bfb8ddbd797c3`

## 1. 使用動画と区間

Driveのファイル名が依頼と異なる点についてユーザーの「はい」で3本の使用許可を受領し、内容から対応を確認。全363フレーム（各121）を抽出・コンタクトシートで確認した。24fpsを制作FPSに転用していない。

| 動作 | Drive実ファイル        | 採用区間（0始まりフレーム） |
| ---- | ---------------------- | --------------------------- |
| 歩行 | 20260915_130443604.mp4 | 1.792–3.917秒、43–94        |
| 走行 | 20260915_130435858.mp4 | 2.208–3.875秒、53–93        |
| 構え | 20260915_132538754.mp4 | 1.500–2.625秒、36–63        |

[解析表・元動画ハッシュ](../assets/blender/references/trooper-kling-reference-analysis.md)。接地、歩幅、骨盤、肩、腕、膝、足首、頭、重心、保持位置、テンポを定性的に分析。単眼動画から正確な3D角度や重心を測定したものではない。変形・足滑り・後半の残像をモーションへコピーしていない。

## 2. Bone / Curveと制作方法

v9の57骨・メッシュ・スキン・ソケットと既存19アニメーションを保全し、60fpsで曲線を再構築。Rootの前進なし。Pelvis上下・小さな左右移動/回旋、Chestの前傾と逆回旋、鎖骨・上腕・前腕・両手の連動、Headの構え追従、左右の腿・脛・足・つま先の接地/離地を調整した。

制作は `scripts/build-trooper-kling.mjs` の解析的な二関節IKと曲線生成。完成GLBを `assets/blender/scripts/save_trooper_kling.py` でBlenderへ読み込み、編集可能なActionとして `assets/blender/source/standard_trooper_v10.blend` に保存した。Blender UIで手作業のキー編集を行ったものではない。既存骨長・階層を変えず、Helper Bone追加もない。

## 3. Animation Clip

追加8本（既存19本は保持）:

- Combat_Walk / Combat_Walk_Rocket: 1.00秒
- Combat_Run / Combat_Run_Rocket: 0.64秒
- Low_Ready_Rifle / Low_Ready_Shotgun: 3.00秒
- Aim_Raise_Rifle / Aim_Raise_Shotgun: 0.55秒

AR/SGは同じ動作設計で、それぞれの既存グリップ姿勢を使用。RLは専用上半身を維持。既存Fire/Reload/Switchおよび後退クリップを保持。

## 4. 移動・遷移

ゲームコード移動＋In-place。移動速度・射撃性能・ネットワーク入力は変更なし。実移動距離から位相を進め、Walk/Runの切替でも足の位相を引き継ぐ。歩行への進入2.6m/s未満、走行への復帰3.0m/s以上のヒステリシスを描画側に追加。周期歩幅Walk 1.3m / Run 3.6m。

既存smoothstep/slerp遷移を使用。Idle↔Walk、Walk↔Run、Run→Idle、Idle/Walk↔Aimを確認。構え上げ0.55秒・解除0.40秒。右ボタンまたはタッチの照準操作から描画用構えを渡す。射撃開始を待たせず既存Fireを優先。スコープ時に自キャラを隠す既存挙動も維持。

## 5. Foot Sliding対策

接地区間に前後軌道を直線化し、Heel→Flat→Toeの接地点と靴底形状を考慮。接地中は実行時に世界座標の接地点を保持して二関節IKで補正。遷移用既存IKと定常接地補正を同時適用しない。遊脚・切替・大きな位置差で固定を解除し、足を引きずらない。

平地の検証で固定目標に対する最大誤差 `1.5623e-7m`。これは固定中の数値誤差であり、全地形・全速度で足滑りが皆無という意味ではない。

## 6. 武器保持

右手ソケットと武器の親子関係を保持。両手を同一の武器保持フレームで動かし、遷移後のSupport Handを補正。肩/肘/手首を連動させ、骨長・スケールは固定。リロード/武器切替は専用動作を優先し、固定を強制しない。背面ソケット・収納/取出しタイミングは既存どおり。

検証姿勢に対するSupport Hand最大誤差はAR/SG `0.000017374m`（約0.0174mm）、RL `5.47e-8m`。握り形状自体の精密さをこの数値だけで保証するものではない。

## 7. ゲーム反映ファイル

- `public/assets/characters/standard_trooper_v10.glb` と生成/Blender検証JSON
- `src/client/standard-trooper.ts`: clip選択、歩行/走行位相、構え、接地/保持補正
- `src/client/input.ts`: 描画用aim入力
- `src/client/render.ts`, `src/main.ts`, `src/client/playtest-app.ts`, `src/client/training-app.ts`: aimの受渡し。trainingにはDEV限定の読み取りQA状態を追加
- 上記Blender/生成スクリプト、`assets/blender/preview-trooper-kling/`、3検証/録画スクリプトと動画エンコードスクリプト

## 8. テスト・比較素材

- TypeScript型チェック成功。
- 既存のstandard-trooper / aimテスト14件成功。
- `npm run build` / `npm run build:pages` 成功。既存の大きなchunk警告あり。
- `node scripts/check-trooper-kling.mjs`: AR/SG/RL、ループ、遷移、有限値、骨長、保持、接地、切替装着を検証し成功。ループ端位置差0、回転差はfloat評価で最大約0.04度。
- `node scripts/check-trooper-kling-campaign.mjs`: 実通常出撃を開発版844×390・ビルド版1280×720で操作し、移動・射撃・リロード・SG切替後の弾消費、例外0を確認。
- `node scripts/record-trooper-kling-game.mjs`: 実トレーニングのControls→ゲーム更新→Rendererを操作。A歩行、B走行、C AR/SG構え/解除、D AR歩行→走行→構え、E RL移動、射撃・装填・切替を記録。
- 後方・斜め後方・側面・遠景とスマホ相当844×390を確認。対象サンプルでは大きなガニ股、膝/肩/手首の破綻、目立つ背面武器貫通は見られなかった。精密な全姿勢衝突検査ではない。

[比較動画](evidence/trooper-kling-v10/trooper-before-after.mp4)は実ゲームcanvas録画を左右に並べたもの。左は同じローカルアプリへ保全済みv9 GLBだけを読み込ませた比較、右はv10。旧公開版全体との完全比較ではない。フルUI録画と全スクリーンショットは `dist-validation/trooper-kling/`。

[数値QA](evidence/trooper-kling-v10/runtime.json)、[実操作記録](evidence/trooper-kling-v10/game-recording.json)、[通常出撃QA](evidence/trooper-kling-v10/campaign.json)。

## 9. 改善点

低速時にも走行脚を使っていた状態から独立した歩行へ分離。狭めの足運び、踵からつま先への接地、接地中の固定、肩と骨盤の逆回旋を追加した。走行は適度な前傾と蹴り出しを持たせ、腕を振り回さない戦闘姿勢へ変更。AR/SGはLow Readyから胸・肩・肘・頭が連動して構え、解除も連続的に戻る。RL上半身と既存武器機能を維持した。

## 10. 残る課題・検証限界

実スマホ端末、実マルチプレイ、斜面/段差の接地は未検証。現行平面基準のFoot Lockであり、地形追従IKを新設したわけではない。後退・回避・被弾の全面改修は対象外。Klingのテンポはそのままコピーせず、既存移動速度と体格に合わせて圧縮した。極端な方向転換や遅延のある補間状態は追加のプレイ確認余地がある。独立監査・main反映・公開は後続の公開承認により実施済み。

## 改修前の構造（調査記録）

1. **実行時正本:** `public/assets/characters/standard_trooper_v9.glb`。SHA256 `58c9b3902de4eba2413523f598f7bf5efbda7589a0ff9d4bd6d12095307f79ba`。`src/client/standard-trooper.ts` が読み込む。
2. **Blenderとの関係:** v9は `scripts/build-trooper-design.mjs` がv8 GLBへ形状・待機曲線を適用して生成。v9全体と同一の単独blendは発見していない。旧 `source/standard_trooper_v4.blend` への単純な巻き戻しは不適切。継承元 `assets/blender/candidates/trooper/stance-v7/trooper_stance_v7.blend` をBlender 5.2.1で保存せず読み取り確認した。
3. **リグ:** `STANDARD_TROOPER_RIG`、57骨、継承元blendのpose constraintsは0。Root → Pelvis → Spine / SpineMid / Chest / Neck / Head、左右の鎖骨・上腕・前腕・手・各指3節、左右の腿・脛・足・つま先、4ソケット。GLBも57 joint。
4. **FPS/export:** 継承元blendは60fps。既存exportはNLA_TRACKS、force sampling、Y-up GLB。v9はGLBの必要部分を直接更新するため、Blenderから全体を書き出してv9形状を失わせない設計が必要。
5. **クリップ:** GLBに19本。Trial_接頭辞のIdle、Weapon_Idle_Rifle/Shotgun/Rocket、Run、Run_Backward、Run_Rocket、Run_Backward_Rocket、Fire_Rifle/Shotgun/Rocket、Reload_Rifle/Shotgun/Rocket、Switch_1_to_2、Switch_2_to_1、Dodge_Roll、Hit_Heavy、およびUAL_sprint。独立Walk / Aim開始clipはない。既存回避は今回の制作対象外。
6. **実行時合成:** Three AnimationMixer。Trial_を除去し、Root/Pelvis/脚とそれ以外へLower_/Upper_を分割。前進のLower_RunはUAL_sprintを元Runの時間長へ合わせて差し替え。後退は既存Run_Backward。サンプル後に保存姿勢とのsmoothstep + quaternion slerpを行う。上半身0.08秒、移動開始0.10秒、停止0.18秒が基本。
7. **移動:** `src/shared/game.ts` が入力強度とMOVE_SPEEDから座標を更新。通常は単一の移動速度定数とアナログ入力、回避は別速度。描画座標の移動距離からclip位相を進めるIn-place方式。現在のstrideは前進Sprint 5.21351158618927m/周期、旧Run/後退2.6m/周期。歩行/走行の選択は未分離。ゲーム速度を変更せず描画で扱う。
8. **武器保持:** RightHandWeaponSocketはHand_R、LeftHandSupportSocketはHand_L、背面2ソケットはChest系。装備は進行武器モデルまたはrealism-v2。手持ちは右手ソケットの子、非選択slotは対応背面ソケットの子。装着時に武器GLBの座標変換を補正。左手への継続的runtime IKはなく、焼き込み姿勢で保持している。
9. **武器切替:** swapCdとswapDurationに連動し、切替時間の45%で収納、60%で取り出し。回避中の停止も権威状態に従う。既存Switch / Fire / Reload、ソケット座標と親子構造を保護する。
10. **武器姿勢差:** AR/SGは共通の移動上半身を使い、待機・射撃・装填は武器別。RLには専用Run上半身とIdle下半身があり、重火器姿勢を維持する。v9生成記録の待機幅はAR/SG 0.432m・前後差0.19m・つま先7度、RL 0.47m・前後差0.26m・10度。
11. **Foot IK:** settleFeetは下半身遷移中の足首軌道を補間して二関節を解き、靴底を地面から約2mmへ補正する。定常移動の接地足を世界座標に固定する処理ではない。新しい接地補正と二重適用しない設計が必要。
12. **構え入力:** scopeはクライアント状態、scope中はローカル兵士を非表示。Player状態に独立したaimフラグはない。射撃はcool増加で検出。Aim接続は既存の入力/描画の意味を確認して実装し、射撃性能や通信仕様を無断で変更しない。

## 公開結果（2026-09-16）

[独立監査Chat](https://chatgpt.com/c/6aa96936-4cb8-83ee-b892-e090274ccedd)はコードと添付バイナリを独立確認し合格。Blender GUI再生は監査環境に実行ファイルがなく未実施だが、SDNA直接解析で60fps・57骨・27 Actionを確認。Runは0.64秒39キーなので厳密なキー間隔は約59.375Hz。「60fps」は制作シーン設定であり、全クリップの完全な1/60秒間隔という意味ではない。これは非ブロッキングの注記。

公開ソース `8f6f150f02957eec02b8c84fde8f30d826db20d3` は監査HEADとtree差分0。Worker Version `37bf836b-09f9-4973-bb55-35c11fb5ff37`、URL https://swarm-front.melosalife-24.workers.dev 。公開前dry-run成功、変更11ファイル＋sw.jsの配信SHA256一致、health成功。公開版844×390・1280×720で通常出撃・移動・射撃・装填・SG切替後の弾消費を確認しpageerror 0。記録は `dist-validation/trooper-kling-release/`（delivery.json、campaign.json、画面画像、再現スクリプト）。
