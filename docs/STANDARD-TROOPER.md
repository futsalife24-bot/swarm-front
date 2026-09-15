# Standard Trooper 制作・組込記録

2026-09-10。ユーザーが武器切替・大型被弾連動を承認し、公開を依頼。標準兵士を既存Workerへ導入。Version `aa1a33b7-2ec9-48d6-bd24-1ad723b7524b`。commit、push、mergeなし。

## 着手時の既存仕様

- 対象 `game/`、Three.js 0.185.1 / WebGL、TypeScript + Vite。戦闘計算は `src/shared/game.ts`、権威サーバーは Workers。描画専用処理は `src/client`。
- branch `codex/home-armory`、base/head `2be699f160c83d641fb68bb1304e4da8059920dc`。多数の既存未コミット・未追跡差分があるため、それらを保持して追加。
- 1 unit = 1m、足元原点、Three.js Y-up / −Z前方。Blender Z-up / +Y前方からglTF標準変換。既存のプレイヤーは約1.8mの簡易図形で、Humanoid skeleton・既存プレイヤーGLB・再利用可能なクリップはない。
- コントローラーはWASD＋マウス、Space回避、Q切替。プレイヤージャンプなし。回避0.32秒、移動方向に回転。位置・当たり判定・無敵は共有計算が担当。
- 2スロット。現在のカテゴリは `rifle`（AR-9）、`shotgun`（SG-4）、`rocket`（RL-2）。初期装備はライフル＋ショットガン。Heavy専用カテゴリなし。
- `fire()`はライフル／散弾のヒットスキャン、ロケットの投射体。射撃起点Y=1.5は維持。
- 現行Qはslotを即変更し、再切替CD0.4秒。切替時の射撃制限なし。
- `hurtPlayer()`はHP、hurt=0.2、ダウンを処理。大型被弾専用フラグ、プレイヤー物理ノックバック、操作不能時間なし。
- アセット既存例に合わせ、Blender source・再生成script・public/assets以下のGLBを分離。新しいエンジンや独立した戦闘基盤は導入していない。

## 制作物

|項目|内容|
|---|---|
|モデル|Standard Trooper、全高1.865m、9つの編集用メッシュ|
|三角形|本体20,176。武器は別GLB。最新値は `dist-validation/standard-trooper/blender-validation.json`|
|編集部品|Body、Helmet、ChestArmor、ShoulderArmor、ArmArmor、LegArmor、Backpack、UtilityGear、Boots|
|材質|Armor / Cloth / Rubber / Metal / Visor / Orange。PBR base color・roughness画像、metallic係数、UV normal画像をGLBへ内包|
|リグ|24 bones。Root→Pelvis→Spine→Chest→Neck→Head、左右Clavicle→UpperArm→LowerArm→Hand、UpperLeg→LowerLeg→Foot、4ソケット|
|ウェイト|装甲は単一ボーンで剛体保持。布は肩・肘・手首・股・膝・足首周辺で隣接ボーンへブレンド|
|左右制作|共通寸法パラメーターから対称生成。左右を個別に手作業複製する構造ではない|
|描画|GLBの論理部品を残し、実行時だけ同一マテリアル・同一bindのskinを統合。本体6 draws|

元画像はBlenderに `DESIGN_AUTHORITY_STANDARD_TROOPER` としてパック。衣装・装甲配置・配色を参照し、ゲーム用の簡略化を含む。概念画の細かな印刷文字・全傷の転写ではない。

## Animation / Socket契約

60fps。Idle、Weapon_Idle_Rifle、Weapon_Idle_Shotgun、Weapon_Idle_Rocket、Run、Fire_Rifle、Fire_Shotgun、Fire_Rocket、Switch_1_to_2、Switch_2_to_1、Dodge_Roll、Hit_Heavy。

- Rifleは短い連射クリップ、Shotgunは強い反動、Rocketは低い重心と大きい反動。ランタイムでは下半身の移動と上半身の武器profileを分離。照準pitchは上半身全体に適用し、両手の関係を維持。
- Rootの水平移動は焼き込まない。移動・回避の位置更新はゲームの既存処理。Hit_Heavyは局所的な上体・腰の変位と浮上・着地・復帰を含み、プレイヤーの世界座標は変更しない。
- Dodge_Rollは20/60秒で一回転するクリップを既存0.32秒へ時間変換。左右・後方への実際の移動は、回避開始時に捕捉した軸で同じクリップを向ける。途中の照準旋回で軸を変えない。
- RightHandWeaponSocket、LeftHandSupportSocket、BackWeaponSocket、BackWeaponSocket_2。背面は右腕で届くラック2本。スロット0が前者、1が後者。
- 切替1秒、Holster **27F / 0.45秒**、Draw **36F / 0.60秒**。指定時点で手と該当ラックのworld matrixが一致するようキーフレームをベイク。
- 武器は別GLBをsocketへ接続。Blenderのsocket座標と独立GLBの二重座標変換を接続rootで補正。
- 回避割り込みでは切替進行を一時停止し、保持先を保存。復帰姿勢のブレンド後に再開。
- NLAはクリップごとに名前付きtrack。Blenderで確認する際は目的のtrackだけmuteを解除する。すべて同時再生しない。

## 保存場所・再実行

- `assets/blender/source/standard_trooper_v1.blend`
- `assets/blender/scripts/build_standard_trooper.py`
- `public/assets/characters/standard_trooper_v1.glb`
- `public/assets/characters/standard_{rifle,shotgun,rocket}_v1.glb`
- `public/assets/characters/standard_trooper_v1.json`
- 実装 `src/client/standard-trooper.ts`、既存 `render.ts` から読込。読込に失敗した場合は旧図形モデルを残し、開発診断にerrorを示す。
- 確認用ビュー `assets/blender/preview-trooper/index.html`。ゲーム本体と同じGLBLoader・AnimationMixer・socket処理を利用する隔離ビュー。

```powershell
& 'C:/Users/futsa/AppData/Local/Programs/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --python-exit-code 1 --python assets/blender/scripts/build_standard_trooper.py
npm run dev -- --port 5314 --strictPort
node scripts/check-standard-trooper.mjs
node scripts/measure-standard-trooper.mjs
node scripts/check-standard-trooper-game.mjs
```

生成scriptはこの兵士の出力のみ上書きする。人間による追加編集は別バージョン保存してから再生成する。

## 検証と未完了範囲

Blender GLB再読込で1 armature、24 bones、12 clipsと6つのnormal付き材質を検証。ブラウザ確認・受け渡し誤差・接地値・実入力結果は `dist-validation/standard-trooper/` のJSONとPNGを正とする。

実ソロ入力のPC1280×720・横画面844×390で、読込、移動、初期2丁の射撃、往復切替、方向付き回避・復帰を確認。スマホviewportはAndroid実機確認ではない。実ローカルWorkerと独立2ブラウザでも両者の24ボーンモデルを表示し、切替中の弾数維持、射撃再開、boss範囲攻撃のHeavy発火、回避側のHP160維持、同時刻の状態一致を確認。敵の初期位置と予兆だけ隔離fixtureで設定し、ダメージ・回避・入力・WebSocketは実処理を使用した。

型チェック・build・production Worker dry-run成功。全14ファイル175テスト成功（追加4件含む）。buildの500KB超チャンク警告あり。外部監査を実施したという意味ではない。

最終候補の数値検証は各クリップ31時点で全skin頂点を検査。Dodge_Rollの最小接地高は約+0.5mm、武器は約+56mm。Runで約0.4mm、Hit_Heavy着地で約2.5mmの足先の沈みが残る。切替両方向の27F/36Fは手とラックの位置誤差0.001mm未満。独立2体のskeleton非共有も確認。正面・背面・側面、Run、3系統Fire、切替、Roll、HeavyのPNGを目視確認。これらは抽出時点の検査であり、全武器組合せ・全補間時刻の交差判定を網羅したものではない。

保存済み `.blend` を再度開き、参照画像のパック、12 actions、24 bones、14個の名前付きobject、不要なCube/Camera/Lightがないことを確認。参照画像が0-userとして落ちた初回保存は修正済み。

今回だけのテキスト差分は `dist-validation/standard-trooper/task.patch`、変更前後SHA256と検証結果は `checks.json`。既存未コミット差分を含むHEAD全体との差分とは区別する。

### 承認後に実装した仕様

1. 切替中1秒は射撃と次の切替を待つ。回避割り込み中は切替時間も一時停止する。即slot変更自体は維持してHUD表示を保つ。`swapCd`を用いて共有計算・表示を同期し、射撃条件へ切替中判定を追加する。
2. bossの範囲強攻撃で実際にHPが減ったとき、任意の`heavyHit`残秒を1.2に設定してクライアントのHit_Heavyへ連動。無敵回避・通常小攻撃では発火しない。水平ノックバック物理や操作不能は追加しない。

上記2項目を共有コードへ適用済み。切替残秒は権威状態から描画へ反映し、回避終了後の0.08秒の姿勢復帰も同期する。切替とHeavyが重なった場合は下半身・腰のHeavyと上半身の持ち替えを合成し、武器の接続順序を維持する。被弾の世界座標・通常移動・射撃可能状態は変更しない。

## 公開

- URL: https://swarm-front.melosalife-24.workers.dev
- Version: `aa1a33b7-2ec9-48d6-bd24-1ad723b7524b`。直前: `5396d9a2-fa2e-4f0b-9fda-035e6eedbe89`。
- 配信JS: `/assets/index-CFYPc7Ub.js`。兵士＋武器3種GLBとJSONを追加。
- 公開確認成功。結果・配信SHA256は `dist-validation/standard-trooper/published-validation.json`。公開JS・4つのGLBがローカルと一致。1280×720 / 844×390でソロ入力、切替中の射撃待ち、2系統の射撃、回避、開発診断の非公開、API health 200/ok:trueを検証。読込完了後の標準兵士の公開画面も目視確認済み。
- 通信試験の初回は検証ページに本体の`#damage`要素がなく、命中表示で停止した。検証ページを本体と同じDOMに修正し、初回shader準備後に測定して成功。テスト都合で本体の保護を無効にしていない。
- 未確認: Android/iPhone実機、インターネット経由の協力操作、全装備組合せの全時刻での交差。微小な着地沈みは上記の通り。
