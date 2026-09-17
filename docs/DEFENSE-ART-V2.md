# 日替わり防衛の平坦な広場・Blender武器庫

2026-09-17。ユーザー指示「既存のデザインの雰囲気」「地面は水平な広場」「デザインを調べたうえでBlenderで作り直す」に対応。

## デザインと素材

- [Armagの移動式武器庫](https://www.armagcorp.com/)のモジュール式外観・武器受け渡し窓と、[米空軍の武器庫紹介](https://www.jble.af.mil/News/Article-Display/Article/3597062/armorys-vital-duty-vigilant-arms/)の格子付き窓を参照。画像の転載・素材流用はせず、オリジナルの小型1室式モデルをBlender 5.2.1で制作。
- 本体2.1×1.9m、高さ約3m。補強扉・ヒンジ・錠・受け渡しカウンター・側面ルーバー・屋根排気口・識別文字・5灯の状態表示。4枚の損傷オーバーレイと独立した破壊後の残骸を持つ。既存の小型拠点としての戦闘範囲を維持し、兵士の中心侵入防止距離を1.95mに調整。
- 既存の6マップのGLBと自作PBRテクスチャを使用。市街地/倉庫/工場の建築、草原/雪原の自然物を外周に残す。中央にかかる構造は接続成分全体を除去し、UV分割頂点は事前に再接続。洞窟は石灰岩素材の連続した岩壁で広場を囲む。
- 操作可能な内側94×94mは高さ0の平面。起伏は外側の景観だけ。外周壁は従来の当たり判定（高さ4m）と寸法一致。通常の6マップの原本・素材・プレイ地形は変更なし。

## 再生成と組み込み

`assets/blender/scripts/build_defense_assets.py` をBlender backgroundで実行。参照入力は `public/assets/maps/map_0_v1.glb` ～ `map_5_v1.glb`、既存遠景 `distant_0_v1.glb` ～ `distant_4_v1.glb` と `assets/blender/textures/maps/`。既存遠景を0.6倍で広場の外側に配置し、倉庫の撤去跡からも背景の倉庫群・クレーンが見える構成。

- 編集原本: `assets/blender/source/defense/armory_v2.blend`、`defense_0_v2.blend` ～ `defense_5_v2.blend`（画像をpack済み）。
- 配信: `public/assets/maps/armory_v2.glb`、`defense_0_v2.glb` ～ `defense_5_v2.glb`。
- 描画: `defense-visual.ts` / `map-assets.ts`。旧 `defense-yard.ts` の仮景観は削除。
- `prepareBattle` でモデル・広場を読み終えてから入場可能。武器庫ダウンロード失敗からの再試行を実通信で検証。広場のエラー状態も再試行時に解除する。

## 検証と限界

- 型チェック、playtest系51件成功。標準・Pagesビルド成功（既存のbundleサイズ警告あり）。
- `scripts/check-defense-environments.mjs`: 実配信GLBをMapAssetsでロード。6環境×49地点の下向きrayで地面高0を検証し、損傷5/4/3/2/1/破壊状態を撮影。
- `scripts/check-daily-defense.mjs`: 実ローカルWorkerを使用。武器庫GLBだけ故意に通信失敗→参加権未消費→再試行→入場→保証武器保持→再読込時の中断処理成功。APIはモックに置換していない。
- `dist-validation/defense-environments/` に6画像、`dist-validation/daily-defense/blender-armory-battle.png` に戦闘画面。保存用証拠は `docs/evidence/defense-art-v2/`。
- 実スマホの描画性能、全3分のバランス、独立Chat監査・main反映・公開は未確認/未実施。以前の監査ZIP送信とCloudflare再ログインの自動承認拒否は解消していない。
