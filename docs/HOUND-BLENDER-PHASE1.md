# HOUND — Blender Phase 1 / Blockout v1

2026-09-10。対象はHOUND（crawler）1体。Blenderソース、再生成、GLB、隔離ビューまで完了。本番置換・戦闘変更・他の敵・commit/push/merge/公開は行っていない。

## 開始条件・既存描画

- repository: `C:/Users/futsa/OneDrive/ドキュメント/ChatGPT/スワフロ/game`
- branch: `codex/home-armory`
- base / HEAD: `2be699f160c83d641fb68bb1304e4da8059920dc`（開始・終了同じ）
- 適用指示: ユーザー提供グローバルAGENTS.mdと `game/AGENTS.md`。後者の通常公開方針に対し、今回のユーザー指示「公開しない」を適用。
- 親ディレクトリのGitはHEAD未作成。実作業のrepositoryは上記game。
- 開始時から多数の変更・未追跡ファイルあり。reset / stash / checkoutなし。開始時に既存ファイルのSHA256を保存し、終了時に全件一致を確認する。
- `src/client/enemy-model.ts`: `enemyGeometry('crawler')` が現行HOUND。すでに五脚＋リングを持つが、細い均等な角材と低い横広がりが虫らしく見える。比較画像はこの実ファイルの静止形状を直接使用（アニメーション状態のキャプチャではない）。
- `src/client/render.ts`: 種別ごとのInstancedMesh、頂点属性を使う変形、`-ya`の回転、地面に対する追加オフセットなし、1倍スケール。今回GLBを接続していない。
- `src/shared/defs.ts`: crawlerのradius=1.25、aim=1.4、HP=75、damage=10、speed=3.5。全て変更なし。
- Three.js 0.185.1、既存node_modules内にGLTFLoaderあり。新依存なし。既存ゲームのロード経路にはGLBローダー未接続。

## 制作・実行

Blender **5.2.1 LTS**、build hash `9e2066aef7ef`。実行ファイル:

```text
C:\Users\futsa\AppData\Local\Programs\Blender Foundation\Blender 5.2\blender.exe
```

全工程をBlender Pythonで生成。GUI操作なし。既存Blenderを使用し、インストールや設定ファイル保存なし。factory-startupから専用バックグラウンドプロセスで実行する。実行に必要だったサンドボックス外アクセスは自動承認レビューを通して実施。

gameディレクトリからPowerShellで再生成:

```powershell
& 'C:\Users\futsa\AppData\Local\Programs\Blender Foundation\Blender 5.2\blender.exe' --background --factory-startup --python-exit-code 1 --python assets/blender/scripts/build_hound_v1.py
```

このコマンドは下記の専用.blendとGLB、Blender検証JSONを上書きする。手動で調整したモデルを保持したい場合は別バージョンへ保存してから実行する。パラメータはスクリプト内のstations・寸法・色・リング分割数に集約。特殊なプラグインやテクスチャは不要。

```powershell
npm run dev -- --port 5197
# 別のターミナルから:
node assets/blender/scripts/check_hound_preview.mjs http://127.0.0.1:5197
```

隔離ビュー: `http://127.0.0.1:5197/assets/blender/preview/index.html`

モデル切替、正面・側面・斜め・ゲームカメラ、シルエット、リング予兆の手動プレビュー、OrbitControlsを利用可能。ゲームからリンク・importされない開発用HTMLで、通常のVite buildのエントリには含まれない。GLB自体はpublicにあるため通常buildでは静的ファイルとしてコピーされる。今回そのbuildを公開していない。

## 成果物・数値

|ファイル|用途|
|---|---|
|`assets/blender/source/hound_blockout_v1.blend`|Blenderソース（120,152 bytes）|
|`assets/blender/scripts/build_hound_v1.py`|再生成・GLB再読込・形状検証|
|`public/assets/enemies/hound_blockout_v1.glb`|ゲーム導入候補（90,592 bytes / 88.47 KiB）|
|`assets/blender/preview/index.html`|隔離Three.jsビュー|
|`assets/blender/scripts/check_hound_preview.mjs`|実GLB検査・Chromeスクリーンショット生成|

- **1,532 triangles**。リング1,024、胴体44、前脚76×2、後脚60×3、脊椎44×3。2,000 trianglesへ水増しせず、必要なシルエットの形状だけを保持。
- **3マテリアル**: `HOUND_shell`、`HOUND_spine`、`HOUND_ring_emission`。画像テクスチャ0、Subdivision0、カメラ0、ライト0、アニメーションクリップ0。
- **10 mesh / 11 node**。HOUND_ROOT直下にbody_core、front_leg_L/R、rear_leg_A/B/C、shoulder_ring、spine_plate_01/02/03。
- GLB SHA256: `782905206b1d450f8d1c57418d051bd4aefdb2c50d3559689eb40d4e0912d6cd`。

## 造形・座標・アニメーション契約

頭を作らず、前方へ流れる長い板状の前脚2本と、後ろの短い支持脚3本で構成。均等な放射配置や昆虫の肘関節を避け、肩リングと空中の三枚の脊椎で分類不能な生物模倣を表す。装飾・眼・口・牙・アンテナなし。

- 1 unit = 1 m。BlenderはZ-up / 前方+Y、GLBはY-up / 前方−Z。Three.jsへの補正回転や追加スケールは不要。
- HOUND_ROOTは(0,0,0)、接地面を通る原点。全五脚の底面がBlender Z=0 / Three.js Y=0。
- ソースのmesh rotation適用済み、scale=(1,1,1)、negative scaleなし。子の原点は脚の取付位置、胴体中心、リング中心、各プレート中心。
- GLB bounds min=(-0.988530, 0, -1.790104)、max=(0.988530, 2.054000, 1.247821)。幅1.9771×高2.0540×奥行3.0379m。
- 現行静止HOUND bounds min=(-1.189339, 0.010045, -1.975042)、max=(1.189339, 1.840000, 1.387991)。新型は少し細く短く、リング上端が約0.214m高い。同じゲーム座標系・同程度の実寸で比較。
- radius=1.25はゲームの衝突半径。現行も新型も前脚はこの円外に張り出す。GLBの外形から衝突半径を再定義していない。aim=1.4は肩リング付近の空洞を通るため、本番統合時に既存論理hitboxとの見え方を確認する。
- shoulder_ringは独立meshかつ独立material。平常Emission Strength=0.65、隔離ビューの予兆では3.0、縦リング面を0.72倍へ収縮。BlenderローカルX/Z、Three.jsローカルX/Yで制御できる。ゲーム連動なし。
- 脚・body・ring・spineは各pivotで剛体パーツとして動かせる。リグ、IK、歩行、攻撃モーションは未制作。胴体移動に伴う脚の追従や足固定は次工程でcontrollerが管理する。

## 検証・画像

`dist-validation/hound-v1/`（既存規則でGit除外）に以下を保存:

- `blender-validation.json`: Blender版・パーツ数・triangle数・material・pivot・bounds・再読込結果。
- `blender-run.log`: 再生成実行ログ。
- `reproducibility.json`: 独立した2回の生成でGLB SHA256が完全一致。
- `three-validation.json`: 実GLBロード、全五脚のY=0、実寸・材料名・triangle数、ブラウザエラー0。
- `baseline.json` / `preservation.json`: 開始時既存ファイルハッシュと終了時保存確認。
- `git-status-before.txt` / `git-status-after.txt`: 未コミット状態の完全記録。
- `current-hound.png` / `blender-hound-oblique.png`: 同じカメラ・同じ縮尺で比較。
- `blender-hound-front.png` / `blender-hound-side.png` / `blender-hound-gameview.png`。
- `current-hound-silhouette.png` / `new-hound-silhouette.png`。
- `blender-hound-ring-cue.png`。
- `blender-hound-mobile.png` / `current-hound-mobile.png`: 844×390、DPR1。

法線・面は閉じたmanifold、正の符号付き体積、面積ゼロなし。GLBでhard normalsのため分割された頂点は、検証用の一時meshだけをweldしてmanifoldを判定する。実ファイルの法線は変更しない。ソース回転適用、正のunit scale、GLBの不要node・texture・camera・clipなし、再読込bounds一致をassert。正面・側面・斜め・ゲーム・シルエット画像を目視確認した。

ゲームカメラ相当は既存FOV65°・高さ2.9m・横オフセット0.8m・pitch0の視線傾斜を使用し、敵まで約10mの条件。実戦マップ・他の敵やVFX・遮蔽を含む最終視認性確認ではない。

`npm run typecheck` と `npm run build` 成功。buildでは既存の500kB超チャンク警告あり。ゲームコードを変更していないため戦闘テスト全件は追加実行していない。

## 自己レビュー A〜H

|項目|判定|所見|
|---|---|---|
|A 犬ロボ化|適合|頭・顔・首・通常の関節骨格なし。脚も連続した板形状。|
|B 昆虫回帰|適合|外へ放射する均等脚・触角・節関節なし。現行より縦長の支持形状。|
|C 犬＋1脚|概ね適合|後方三点支持と空洞肩で通常骨格を崩す。斜めや遠距離では第三後脚が重なるため、五脚の即時判別は限定的。|
|D 長い前脚|適合|側面と斜めで前脚の伸長と前後の高低差が読める。|
|E 前方向|適合|前方へ伸びる2本と肩リングで判別。正面のみでは前後差の情報が減る。|
|F リング・浮遊脊椎|適合|独立した空洞輪と三枚の浮遊板。真横では縦リングが細い発光線に見える。|
|G スマホ|条件付き|約10m・844×390で輪と前脚は読める。脊椎の隙間と後脚3本の数え分けは潰れる。|
|H 大量表示|形状予算適合・実機負荷未測定|1,532tri / 88.47KiB。個別meshのままでは10 draw calls/体なので、量産表示の実装適合は未完。|

造形の作り直しは0回。再実行は再現性検証のため。同一工程内で大きな再設計を追加していない。

## 次工程への制約

1. ユーザーの造形確認後、第三後脚・浮遊板の遠距離分離と側面からの予兆視認性を検討。
2. パーツごとの共有geometry/materialとInstancedMeshなどを設計し、現在の種別単位インスタンシングの効率を保つ。10パーツを敵ごとにcloneするだけの本番置換はしない。
3. その後、接地を守る簡易歩行とリング予兆のcontroller、遮蔽・照準の見た目、実機GPUで同時表示数を検証。

Chrome SwiftShaderで得たプレビュー全体の14 draw callsは、HOUND10＋グリッド/矢印/半径の補助描画4。スマホGPU性能測定の代用ではない。GLBはモデリング用Blockout v1として完成、ゲームへの正式統合はユーザー確認後。
