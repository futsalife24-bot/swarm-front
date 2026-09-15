# Image Aによる量産兵デザイン・待機姿勢 v9

2026-09-15。実装・自己検証・Codex内監査済み。**main反映とWorker公開は未実施、READMEのChat独立監査・承認待ち。**

## 1. 現状調査

開始main/base: `0eab85d20dbe480d100e1cca27bc47da301a33cb`。originは既存GitHub `futsalife24-bot/swarm-front`、開始時clean、fetchで一致を確認。作業ブランチ: `codex/trooper-design-refresh`。

- `src/client/standard-trooper.ts` がGLB読込、材質バッチ、57骨の複製、武器装着、上半身/下半身の合成を担当。描画からの接続は `src/client/render.ts`。
- 兵士は `standard_trooper_sprint_v8.glb`。19クリップ（18既存＋暫定採用のUAL Sprint）を持ち、走りは距離連動。手・補助手・背面2か所のソケットを使用。
- 旧v7由来の待機は足首幅54cm。RLはさらに骨盤が低く、横へ踏ん張る印象が強かった。
- ヘルメット/ブーツには細部がある一方、胴・肩・膝・脛は試作シェル中心。滑らかな一体スーツ、球膝、開口した筒状の脛、単調な材質が仮置き感の主因。
- 武器は `assets/weapons/realism-v2`、進行装備は `progression-weapons.ts`。その形状・射撃方向・接続点は保持する。

## 2. 改善方針と実装

[Image A原本](../assets/blender/references/trooper-image-a.jpg)を装備構成・配色・輪郭の主要参考にし、既存骨格のモバイル向け3Dへ翻案。

- 青灰のマット装甲、暗い布/ラバー、緑灰のウェビング、金属、スモークバイザーを区別。識別アクセントは青緑。
- 胸キャリア、3連ポーチ、肩を回るハーネス、腰/腿の収納、薄い縦長膝/脛防具、肩内張り、首の保護、曲面バイザーと頬/顎の縁、通信機・後頭センサー・S-01識別を構成。
- 背面は共通背板から武器レールへ金具をつなぎ、縦の識別ラインを遠景の目印にした。
- AR/SGは同じ制服。SGは小さな追加ホルダー、RLを含むロードアウトは肩・背板・腰の補強。手持ち武器を切り替えても身につけた役割装備は消えない。
- ユーザーの途中指示に対応し、骨盤まわりの素体幅を12%絞り、太腿の横厚と側面ポーチの幅/張り出しを削減。骨格位置や身長は変えず、肩から腰のメリハリをつけた。
- 布の輪郭に低振幅の折れを追加。生成した4領域の素材アトラスと小さな織りnormal、識別ステンシルを共有。原本と[生成方法・最終プロンプト](../assets/blender/source/textures/trooper-material-atlas-v9.md)を保存。

### 待機姿勢

| 項目 | AR / SG | RL |
|---|---:|---:|
| 足首間の幅 | 43.2cm（旧54cmから20%減） | 47cm |
| 前後差 | 19cm | 26cm |
| つま先の設計角 | 外向き7° | 外向き10° |
| 前足側への配分意図 | 55:45 | 60:40 |

膝の曲げ方向を正面寄りにし、肘の向きを下げた。RLは後ろ足を引き、深すぎた腰の落ち込みを抑制。配分は姿勢設計上の意図で、身体質量や足圧をシミュレーションした測定値ではない。

手と武器ソケットのworld位置を保持して待機を作成。旧射撃/装填/切替の上半身と新しい待機下半身を合成する際は、骨盤移動分だけSpineを補正する。v9判定に限定し、走り・被弾・ローリングには追加補正をかけない。

### 再生成と負荷

`node scripts/build-trooper-design.mjs`

入力は保存済みv8 GLB＋生成アトラス。出力は別名 `public/assets/characters/standard_trooper_v9.glb` と検証情報JSON。骨名・親子構造・バインド行列・武器ソケットと、非待機15クリップの数値バイト列を検証して保持。今回変更するのはIdleと武器別Idleの4クリップ。

未使用の旧画像/旧形状/旧アニメ出力領域を除去し、GLBは15,460,672 → **7,343,204 bytes**。表示されるAR制服は **47,596三角形・11 draw calls**。役割装備はSGで1、RLで2 draw追加。全プレイヤーで形状・テクスチャを共有し、骨と材質色はプレイヤーごとに独立。

最終GLB SHA256: `58c9b3902de4eba2413523f598f7bf5efbda7589a0ff9d4bd6d12095307f79ba`。source、通常dist、dist-pagesで一致。

## 3. 検証

| 検証 | 結果 |
|---|---|
| 型チェック | client / Workerとも成功 |
| 関連単体 | `standard-trooper.test.ts` 4件、`aim.test.ts` 10件成功 |
| 生成時の保護 | 57骨、既存15クリップのpayload一致、手・支持点の誤差5e-9m未満 |
| 実ランタイムの合成 | 3武器×待機/射撃/装填/切替2方向×21時点。旧版との手・背面ソケット差最大4.3e-8m |
| 変更対象外モーション | 10種×13時点、全骨位置差0 |
| 待機接地 | 3武器×31時点、左右の靴底約2mm、幅の誤差1e-7m未満 |
| 装備/遷移 | RL→AR→SG→RL→AR、移動/停止/射撃/回避/被弾、4色スキン反復で非有限値/モデル非表示なし |
| 画面 | 旧/新を同カメラ・照明で3武器×正面/背面/斜め、844×390遠景、モーション6静止画＋連続比較動画 |
| 本編の入力 | 開発/配布の両方、844×390・1280×720で移動、射撃、装填、切替後射撃、回避・復帰成功 |
| ビルド | 通常、Pages、production Worker dry-run成功（公開なし） |
| 描画エラー | 最終ランタイム/本編チェックでpageerror、兵士読込失敗、merge失敗0 |

実行用: `scripts/check-trooper-design.mjs`、`scripts/check-trooper-design-game.mjs`、`scripts/capture-trooper-design-review.mjs`。配布確認は `npm run preview -- --port 5367` に対し `node scripts/check-trooper-design-game.mjs http://127.0.0.1:5367`。

結果: [ランタイム数値](evidence/trooper-design-v9/runtime-checks.json)、[配布版操作](evidence/trooper-design-v9/built-game-checks.json)。通信プロトコル・権威戦闘ロジックは変更しておらず、今回の検証を実協力通信の追加検証とは扱わない。

途中の修正: variantをルートへ保存して自己非表示になる問題、材質バッチのjoint型不一致、旧上半身合成時の骨盤差分、比較ビューの小画面でのcanvas見切れを修正。ソフトウェア描画の重い本編検証は一度中断し、D3D11で両サイズを再実行して完了。Worker dry-runの初回はsandboxの親ディレクトリ/ログ書込制限で失敗、権限付きの同じdry-runで成功。失敗を合格へ読み替えていない。

## 4. 比較出力

開発中の操作比較: `http://127.0.0.1:5314/assets/blender/preview-trooper-design/`（AR/SG/RL、視点、7モーションを変更可能）。ゲームの公開UIには追加していない。

- [AR 正面](evidence/trooper-design-v9/rifle-front.jpg) / [斜め](evidence/trooper-design-v9/rifle-oblique.jpg) / [背面](evidence/trooper-design-v9/rifle-back.jpg)
- [SG 斜め](evidence/trooper-design-v9/shotgun-oblique.jpg)
- [RL 正面](evidence/trooper-design-v9/rocket-front.jpg) / [背面](evidence/trooper-design-v9/rocket-back.jpg)
- [844×390 遠景比較](evidence/trooper-design-v9/rifle-far-844.jpg)
- [配布版ゲーム 844×390](evidence/trooper-design-v9/built-844-idle.png) / [1280×720](evidence/trooper-design-v9/built-1280-idle.png)
- [待機・走り・切替・回避・射撃・装填の比較動画](evidence/trooper-design-v9/motion-review.webm)

## 5. 監査・残課題

ユーザーが許可した読み取り専用監査エージェント1体で造形・差分・静止モーション・検証記録を反復確認。最終判定は「確認範囲内の必須修正は解消、追加の必須修正なし」。[監査範囲と指摘対応](TROOPER-DESIGN-V9-REVIEW.md)。これはCodex内レビューであり、独立Chat監査の代替ではない。

- Image Aの装備・配色・シルエットを既存モバイル3Dへ反映した改善。**原画と同等の写実品質・完全再現を達成したという判定ではない。** 布の折れや部位ごとの使用感など、近距離の表面表現には差が残る。
- スマホ実機のGPU負荷/熱/動作、実プレイヤーの受入は未確認。Windows Chromeの確認結果と区別する。
- 暫定Sprintに元からある足滑り、開始停止/後退への切替の滑らかさは今回の修正対象外。
- main反映・Worker公開は、既存のChat独立監査・承認条件を満たしてから行う。ソース・素材・検証画像は作業ブランチ/PRに保管する。
