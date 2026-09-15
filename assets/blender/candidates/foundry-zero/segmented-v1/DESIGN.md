# FOUNDRY ZERO / segmented-v1 候補設計票

状態：2026-09-12、ユーザーが統合初版案へ「オッケー」、公開も許可。候補から正式接続用の仕上げへ進んだ。低い脚姿勢・機械外装の区別・各unitの可動照準器を追加。公開結果と実ゲーム検証は統合担当が記録する。AAAという自己採点で完成品質を保証しない。

正本は `game/docs/FOUNDRY-ZERO-CONCEPT.md`。Photo 2は造形参考であり、画像中のPHASE順序・PRISM固定生成・未指定行動は採用しない。適用規約の機械型外見に関する相違はユーザーの個体指定を優先する。

|項目|今回の内容|
|---|---|
|開始状態|branch `codex/home-armory` / HEAD `4186f25f7c9695f95ea897ad182db5f85fac3091`。作業開始時に他作業の追跡差分・未追跡物あり。`start-state.json` に記録。所有範囲は本フォルダだけ。|
|対象|互換ID `boss/worm` に対応する連結機械体の候補。旧通常型への置換は行わない。|
|構成|頭部1＋胴体7。直接の独立unit root 8個、独立前方connector 7個、脚34本（頭6、各胴4）。各脚のHIP/UPPER/LOWER/FOOTを別meshとして保持。頭部には6個の可動レーザーアームと中央投射器。|
|輪郭|低く長い節列、広がる頭部の光学器官、黒いジャバラ。前候補で直立していた脚は後方へ膝を折り、足先を外へ広げた。腹部に低い機械外装を置き、胴下の空間を減らした。|
|模倣|ミミズの屈曲とムカデの節・多脚の一部。体の連なりと独立照準器官の複数方向性を主役とし、起源や製造者は設定しない。|
|素材|暗い機械部、金属外殻・縁、シアン発光、少量の識別色。乾いた硬質表面。画像テクスチャなし、BlenderとglTFの標準PBR素材5個。|
|寸法|メートル、unit pitch 3.2m、全長25.9369m、最大幅5.5m、頭部最大高4.29m。各unit原点は足元。native scale 1。|
|座標|Blender Z-up / +Y前方。glTF Y-up / -Z前方。独立rootはGLB上でHEAD `[0,0,0]`、BODY_i `[0,0,3.2*i]`。|
|接続|BODY_i_CONNECTOR pivot `[0,1.65,-1.04]`、前unitの後方socket `[0,1.65,1.05]`。local -Z方向に基準長1.11m。ゲームで切断先頭となる胴のconnectorを非表示にできる。胴を新しい頭へ置換しない。|
|動作|main GLBは中立のrigid hierarchyでアニメーションなし。別preview GLBとblendには4秒の `ArticulationPreview`。節の横屈曲・接続方向変更・脚の接地保持・レーザーアームの小さな可動を確認する。地図移動・ゲーム速度・攻撃時刻を規定しない。|
|破壊表現|部位の非表示・独立配置による構造確認。流血・肉・粘液なし。頭部破壊時の生成回数や処理は実装していない。|
|照準と発射器|頭の中央開口・各胴の背面器官前側にレーザー開口を造形。砲口位置そのものをpivotにして、照準回転しても発射原点が動かない。HEAD local `[0,1.65,-1.66]`、BODY local `[0,2.68,-.62]`。|
|採用判断|統合初版案と公開をユーザーが承認。実歩行・射撃は別担当のshared/renderへ接続し、その検証を経て公開する。|

## 現行仕様との境界

開始時の `src/shared/worm.ts` には、節中心の追従距離3.2m、旧速度 `ENEMIES.boss.speed * 3 * (fractured ? 2 : 1)`（boss speed 1.4）、旧上下移動、節ごとの放物線弾がある。`src/shared/game.ts` は頭＋7節、各節初期HPを全体maxHp/8へ配分する。頭の簡易hit centerは原点y+3・半径4、胴はy+2・半径2.2。これらは開始時の実装記録であり、新コンセプトへの承認値ではない。

候補作業ではHP、人数・stage補正、移動AI、速度、高度、射程、弾速、重力、ダメージ、発射数、攻撃予兆、wave、報酬、通信、当たり判定を変更していない。モデル内muzzleは視覚器官の接続点であり、実弾発射座標・時刻へ接続済みとは扱わない。

上記は候補開始時の境界。後続の統合初版承認では地上移動4.2m/s、分離後6.3m/s、各生存unitからのレーザーが採用された。生成・分離・抽選などの最新の確定仕様と公開範囲は、統合担当が更新する `FOUNDRY-ZERO-CONCEPT.md` およびshared実装を正とする。モデル生成器自体にはゲーム速度・攻撃時刻・生成処理を埋め込まない。

## 予算と読込

仕上げmain GLBは36,628tri / 20,102元頂点 / 165物理mesh / 5素材 / 0骨 / 約1.58MB。初期33,516triから3,112tri（9.3%）増えた理由は、低い腹部外装と承認された各胴の可動レーザー光学部。素材数5は維持し、別担当の5材質バッチへの対応を維持する。既存の通常FOUNDRY ZERO固定loader（5 SkinnedMesh・21骨・3clips）へ骨数だけを合わせず、専用のrigid描画経路を使う。

細部を独立した編集部品として残したGLBを、`foundry-worm.ts` が5素材の描画バッチへ変換する。実行結果は親側 `integration-preview/` の検証記録を参照する。モバイル実機FPS・発熱は未測定。

## 生成・検証・証拠

- `build_candidate.py`：既存 `phase1_common.py` の候補内コピーを再利用した決定的生成器。seedなし。既存source/publicへ保存しない。
- 実行環境：Blender 5.2.1 LTS / build `9e2066aef7ef`。`--background --factory-startup --python-exit-code 1 --python assets/blender/candidates/foundry-zero/segmented-v1/build_candidate.py` をgameディレクトリから専用プロセスで実行。
- `.blend`：独立部品とNLAの屈曲クリップを編集できる。静止配布物は `foundry_zero_segmented_v1.glb`、構造確認クリップは `foundry_zero_articulation_preview.glb`。
- 自動検証：`blender-validation.json`（生成）、`reimport-validation.json`（fresh Blender再読込）、`browser-validation.json`（GLTFLoader再読込・60Hzで足先/関節/地面/有限値・静止構造）。
- 目視・動作：`index.html`、`review/oblique.png`、`review/front.png`、`review/side.png`、`review/articulation.mp4`。保存動画の再読込・複数時点デコードは `video-validation.json`。
- 制作素材の出典：ユーザー添付Photo 2を参照。再配布画像・外部テクスチャなし。全meshは本生成器の手続き形状。

## 監査から残した造形課題

初回監査では脚の直立支持・広い胴下空間・簡素な素材情報を課題とした。統合初版の仕上げでは、低く後方へ折る膝、広い足先、低い腹部外装で姿勢を修正。粗い黒い機械部と、金属殻・明るい縁のroughness/metallicを分け、シアン光の白飛びを抑えた。参考画像の密度をそのまま達成したと主張せず、ゲーム距離での節と器官の判別を優先した。

検査中に検出した足先0.3449mの差は、プレビューUIが非表示のanimated rootを中立へ書き戻してAnimationMixerのキャッシュと干渉したことが原因。非表示previewへ直接変換を書き込まない修正で解消。Blenderフレーム1開始に起因した4.0333秒クリップはフレーム0から120へ修正し、意図した4秒へ揃えた。失敗記録と修正後の結果を区別し、単に許容値を緩めて合格とはしていない。

