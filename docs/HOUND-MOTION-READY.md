# HOUND v3 — Motion Ready / 実装用成果物

2026-09-10。ユーザーから「3モーションの制作検証などはもちろん、そのモンスターを実装可能な完成と言われるレベルまで」と追加指示を受け、可動リグ・3クリップ・ゲームdebug連携・複数体描画・監査用MP4まで制作。通常プレイの正式置換、commit / push / merge / 公開 / production反映は未実施。監査はユーザー本人が行う。

## 完成したもの

|項目|内容|
|---|---|
|造形|合格済みv3の形を基礎に、後脚装甲を関節位置で剛体分割。頭なし・長い前脚2＋短い後脚3・偏心リング・浮遊板3枚を維持|
|リグ|20 bones。胴体1、各脚の上節・下節・接地部×5、リング1、浮遊板3|
|Idle|4秒ループ。小さな姿勢補正、リング安定化、浮遊板の位相差。動物の呼吸ではなく機械的な調整|
|Locomotion|0.8秒ループ。前脚2本の引き込み、後脚3本の支持と送り。距離ベースで再生位相を進める|
|Lunge|1.2秒。現行0.45秒予兆へ同期、リングが78%へ収縮、胴体の送り、衝撃と復帰|
|ゲーム連携|描画側が既存のmoving / wind / cool / 移動距離だけを読む。攻撃中断、スナップショット飛び、削除、null World、Current切替を処理|
|同時描画|各個体で別クリップ・別位相・0.12秒の遷移補間。1/10/40体すべてHOUND本体4 draw calls|
|納品|標準skinned GLB、Blenderソース、再生成Python、独立preview、ゲームdebug、動画・画像、検証結果、実装用ZIP|

## ファイル

- `assets/blender/scripts/build_hound_motion.py`: 既存 `build_hound_v3.py` の静止結合直前までを再利用。可動版だけを別出力する。実行には両スクリプトが必要。
- `assets/blender/source/hound_motion_v1.blend`: 20ボーンと3つのNLAクリップ。初期表示はニュートラル。Blenderで再生する場合は該当NLAトラックのmuteを解除し、他のトラックはmuteのままにする。
- `public/assets/enemies/hound_motion_v1.glb`: 標準GLB。Three.js標準AnimationMixerでも3クリップを再生可能。独自シェーダーがないと開けない形式ではない。
- `src/client/hound-motion.ts`: GLB読込、ボーン行列の事前サンプリング、4 InstancedMesh、個体別状態制御、dispose。
- `src/client/hound-glb-debug.ts`: motion版のロード・Current fallback・描画同期。
- `src/client/render.ts`: motion queryと表示用スカラー入力の受け渡しのみ。
- `assets/blender/preview-motion/index.html`: タッチ回転/拡大、待機/移動/攻撃/連続、再生速度、正面/斜め/側面/背面/遠景、1/10/40体。
- `tests/hound-motion.test.ts` / `vitest.config.ts`: 状態遷移の4検証と既定テストへの登録。
- `assets/blender/scripts/check_hound_motion.mjs`: 実GLB・GPU用行列・実Renderer・表示数・同期・fallback検証。
- `assets/blender/scripts/check_hound_motion_solo.mjs`: 本物の通常/debugタイトルからソロ出撃。
- `assets/blender/scripts/record_hound_motion.mjs`: 全402フレームを決定的に描画し、WebCodecs H.264 + MP4へ保存・再読込検証。動画用のエンコード機能はゲーム本体に含まれない。
- `docs/HOUND-MOTION-READY.md`: 本書。

## 最終予算・座標

|項目|数値|
|---|---:|
|Triangles|5,128（静止v3 4,960から+168。後脚の関節分割と閉じた断面のため）|
|Materials / draw batches|4 / 4|
|Bones / clips|20 / 3|
|GLB|605,876 bytes（約591.7 KiB）|
|画像テクスチャ|0|
|実行時の動作行列テクスチャ|464,640 bytes（約453.8 KiB）、全個体で共有|
|40体のtriangles|205,120|
|forward / ground / scale|-Z / Y=0 / 1|
|負スケール / root motion|なし / なし|

通常のゲーム位置と当たり判定をroot motionで二重に動かさない。リングの収縮はリング専用ボーンの正のスケールで行う。元のv1/v2/v3 .blend/GLBは上書きしない。

Locomotionは1周期0.72mを基準に、描画された移動距離から時間を更新する。直進での接地中の足送り速度を前脚/後脚とも一致させた。方向転換や状態ブレンド時まで世界座標に足を固定する地形IKは含まない。現行HOUNDの地上追跡向けで、任意の崖・階段・壁への適応を保証するものではない。

## 表示方法

Vite開発サーバーがない場合はgameフォルダで `npm run dev -- --port 5198`。

- ゲームdebug: `http://127.0.0.1:5198/?debugHoundGlb=motion`。通常どおりソロ出撃し、右上でmotion / Currentを切替。
- 独立preview: `http://127.0.0.1:5198/assets/blender/preview-motion/index.html`。
- 静止v3: `?debugHoundGlb=v3`。v2の `=v2` / `=1` も継続。
- 通常URLでは既存モデル。読み込み失敗時も既存表示。

これらのlocalhost URLは外出先から直接開けない。ユーザー監査用にはGoogle DriveのMP4・PNGを渡す。Driveの通常の非公開ファイルとして保存し、一般公開リンクの権限追加はしない。

## 実装する際の契約

標準GLBのクリップ名は `Idle` / `Locomotion` / `Lunge`。ゲーム側GPU再生は以下の流れ。

```ts
const asset = await loadHoundMotion(); // 1回ロードして共有
const batch = new HoundMotionBatch(asset, 80);
scene.add(batch.group);
batch.setPose(slot, 'Locomotion', clipTime); // 秒。個体別
batch.setTransform(slot, worldMatrix, color);
batch.finish(count);
// 不要になった描画バッチを破棄する場合: batch.dispose()
```

`HoundMotionController` はゲームWorldを受け取らず、ID・moving・wind・cool・distanceのコピーだけを受け取る。wind中は `Lunge time = 0.45 - wind`。wind終了とcoolの更新で衝撃フレーム0.45秒へ合わせる。coolが飛んだsnapshotも補助検出する。予兆中断時はIdle/Locomotionへ戻す。新規生成時のcoolは攻撃終了と決めつけない（既存spawnは初期coolを持つため）。

描画だけの変更であり、HP、攻撃力、衝撃波半径、0.45秒という判定時刻、移動速度、wave、AI、サーバー権威、通信形式は変更しない。通常playへの正式採用は別操作として残す。

## 検証結果

- Blender 5.2.1 LTSで生成・.blend保存・GLB export/import成功。20ボーン、4材料、3クリップを実ファイルで検査。
- 各60fpsキーのIK足先目標誤差は最大約0.00000023m。接地状態の誤差は約0.00000013m。
- 出力したGLBの実スキニング後の全頂点を30fps刻みで計測。3クリップとも地面潜りは最大約0.00000086m（浮動小数点誤差）。異常座標なし。
- 各クリップの始点/終点の行列差は最大0.00000036未満。Idle・移動はループ可能、Lungeも中立姿勢に復帰。
- GPUパレットとThree.js標準スキニングを別GLB読込で比較し、頂点誤差は最大約0.000000052m。
- 1/10/40体: 全4バッチのinstance count一致。独立previewは各6 draw calls（床・グリッド込み）、実ゲーム検証シーンは各51 draw calls。HOUND部分は各4。
- Current往復、通常URLでGLB要求0、GLB読込失敗fallback、World消去時の全instance数0・状態辞書削除に成功。
- 描画前後のWorld JSON一致。見た目が戦闘状態へ書き込まないことを検証。
- 既存の `game.step` で12秒分の実AIを進めたテスト: Idle/Locomotion/Lungeすべて観測、衝撃波3回、プレイヤーHP160→130、描画によるWorld変化なし。wave追加を止めた検証用配置であり、本番変更ではない。
- 通常/debugの本物のタイトル→ソロ出撃成功、GLB要求0/1、JS例外0。
- `npm run typecheck`: 成功。
- `npm test -- tests/render.test.ts tests/structure-v2.test.ts`: 関連28件成功。
- `npm test -- tests/hound-motion.test.ts`: 新規4件成功。予兆同期、中断、snapshot飛び、距離再生、停止、ID入替・削除を検証。
- `npm run build`: 成功。従来と同種の500kB超チャンク警告あり。

数値計測はWindows Chrome / ANGLE SwiftShader。Android/iPhone実機のFPS・GPU時間・発熱・長時間耐久は未測定。30fpsの確認動画はオフライン描画の再生速度であり、スマホで30fpsを達成した証拠ではない。

## 監査用画像・動画

`dist-validation/hound-motion/review/`:

- `hound_motion_oblique.mp4`: 斜め、13.4秒、960×540、30fps、402フレーム。待機→移動→攻撃3回。
- `hound_motion_side.mp4`: 同じ動作の側面。
- `hound_motion_front.png` / `hound_motion_idle.png`: 正面の移動姿勢・斜めの待機。
- `hound_motion_charge.png` / `hound_motion_impact.png`: 予兆中と衝撃直後の比較。
- `hound_motion_mobile.png`: 844×390。
- MP4のposter画像: 保存MP4を読み戻して抽出。メタデータだけでなく複数時刻へのシークと異なる画像の復号を確認。

動画はスマホで再生・一時停止して、次を監査してほしい。

1. 前脚の引き込みが「圧力をかけてくるHOUND」に見えるか。
2. 後脚3本が支持脚として働き、普通の犬走り/蜘蛛歩きに戻っていないか。
3. 0.45秒予兆、リング収縮、胴体の送り、復帰が理解できるか。
4. 浮遊板とリングが独立した機械部品に見えるか。
5. スマホ幅で装甲・五脚の読みやすさが許容できるか。

## Gitと差分の境界

Repository: `game`。Branch: `codex/home-armory`。開始/終了HEADは `2be699f160c83d641fb68bb1304e4da8059920dc`。
開始から多数の未コミット/未追跡変更あり。今回の既存編集は `render.ts` / `hound-glb-debug.ts` / `vitest.config.ts`。それ以外は上記の新規ファイルと監査証拠。reset / stash / checkout / commit / push / mergeを実行していない。

`dist-validation/hound-motion/` に変更前コピー、今回だけのpatch、git status、各検証JSON、保護対象のハッシュ比較、成果物のハッシュ一覧を保存。元v3造形とshared/serverは変更前ハッシュとの一致で確認する。

## 完了と残る判断

実装用のアセット・再生制御・debug連携・自己検証まで完了。正式採用はユーザーの画像/動画監査後。未確認なのは実スマホでの性能・見た目の採否であり、これを合格扱いにはしない。

public配下の試作GLBは通常buildのdistにコピーされる従来仕様。現時点で公開していない。正式採用/公開の際には採用するGLBと不要な旧試作アセットを選別する。今回勝手に削除・正式置換・公開しない。
