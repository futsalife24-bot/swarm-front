# 武器モデル量産の手順書（Codex 向け、2026-11-11）

決まりの理由は [DESIGN.md](DESIGN.md)。ここは残り8丁（SMG-3、SG-7、RL-9、SR-1、GL-6、ST-3、KB-6、MD-4）を同じ決まりで作るための作業手順。

2026-11-12追記: 本人提供の[9点の参考画像](concepts/user-reference-9.png)を素材・装甲・機構の方向に使い、新規9丁を仕上げ直す。画像は非武装の小道具なので、握り・先端・武器ごとの目印は設計書を優先。上限・自動検査の基準は変えず、1丁ごとに生成→検査合格→画像目視の順で確認する。

## 置き場所

```
design/weapon-models-20261111/
  DESIGN.md / PRODUCTION.md
  blender/
    weapon_kit.py        共通キット（材質表、部品、書き出し）
    build_weapon.py      生成の入口
    check_weapon.py      読み直し検査
    weapons/<kind>.py    1丁ぶんの形
  render/
    render_weapon.mjs    画像出力
    viewer.html          多面・札サイズの画面
  silhouettes/
    silhouettes.html     12丁の目標形（座標つきの元データ）
    silhouettes.png
  out/<kind>/            <kind>_0〜4.glb、report.json、check.json、views.png
  source/<kind>.blend    編集元
```

今回の成果物は worktree `.claude/worktrees/weapon-models-20261111/`（branch `worktree-weapon-models-20261111`、基点 `d7d1399`）の中にあり、未コミット。元の作業フォルダの `design/` には入っていない。

## 命名

- `<kind>` は `src/shared/defs.ts` の武器ID: `smg` `slug` `heavy` `sniper` `laser` `grenade` `sticky` `kick` `medic`。
- 形のファイル: `blender/weapons/<kind>.py`。`SPEC['kind']` と一致させる（一致しないと生成が止まる）。
- 出力: `out/<kind>/<kind>_<レア度0〜4>.glb`。現行の `<形>_<レア度>.glb` と同じ並び。
- GLB 内のメッシュ名: `Weapon_<kind>_v1`。識別インレイの材質名は現行と同じ `Rarity identification`。

## 1丁を作る手順

repo のルートで実行する。Blender は 5.2.1 で確認した。

```powershell
$b = "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe"
$d = "design/weapon-models-20261111"
& $b --background --python-exit-code 1 --python "$d/blender/build_weapon.py" -- <kind>
& $b --background --python-exit-code 1 --python "$d/blender/check_weapon.py" -- <kind>
node "$d/render/render_weapon.mjs" <kind>
```

1. `silhouettes/silhouettes.html` の該当武器の `shapes`（前・上の座標）を見て、`blender/weapons/laser.py` を写して `weapons/<kind>.py` を作る。
2. `SPEC` を埋める。
   - `bore_z`: 銃身軸の高さ。先端の形の上下の中心。
   - `inlay`: 識別インレイの位置（X半幅, Y, Z）。本体側面の平らな所に、表面から 1mm 出るように置く。
   - `neon_profile`: ネオン縁取り用の外形 `[前, 上, 半幅]`。後ろ上から時計回りに一周。ねじや細い突起はなぞらず、大きな輪郭だけ。
3. `build(k)` に部品を並べる。使える部品は `k.profile`（側面形の押し出し。輪郭の主役）、`k.box`、`k.rod`、`k.ring`、`k.guard`。材質は PALETTE のキーで渡す。
4. 生成 → 検査 → 画像の順に回す。検査が `WEAPON_CHECK PASS` になるまで直す。
5. `out/<kind>/views.png` を見て、目で見る項目（下）を確かめる。

`render_weapon.mjs` は `node_modules`（three と @playwright/test）を上の階層から探す。`npm ci` 済みの repo の中で実行すること。GPU で WebGL を作れなかったときはソフトウェア描画で自動的にやり直し、どちらで描いたかを最後の行に出す。

シルエット表を直したとき: `node "$d/render/render_weapon.mjs" --silhouettes`

## 形を作るときの決まり（検査で落ちやすい順）

1. **先端は対称に。** 前端から全長の3%以内は、銃身軸に対して上下左右対称な形だけにする。棘・照星・片側のケーブルは、前端より全長の3%以上後ろで終わらせる。SG-7 の棘は前端 0.66 に対して 0.615 で終える設計。
2. **前を長く。** 前端 ≧ 後端の長さ + 0.10。KB-6 は後ろにも噴射口があるが、後ろを前より短くする（前 0.52、後ろ −0.36）。
3. **材質は6つまで。** 識別インレイで1つ使うので、自分で選べるのは5つ。LZ-2 は最初7つで不合格になり、黒い凹みを polymer に寄せて6つにした。
4. **握りと支え。** 握りは前 −0.08〜+0.03・上 −0.15〜−0.03、左手の支えは前 +0.18〜+0.40・上 −0.05〜+0.03 に形を置く。
5. **枠。** 前後 −0.40〜+0.70、上下 −0.25〜+0.21、半幅 0.115 以下。
6. **重さ。** 三角形 9,000 以下が目標。円柱の分割数（`rod` の `n`）と面取りが効く。LZ-2 は円環機構の追加後 8,788。

そのほか:

- 型番の数字を目印の個数に合わせる（DESIGN.md の表）。
- 発光は銃口・内部・容器の小面積だけ。輪郭をなぞらない。
- シルエットは設計図を基準とし、装甲の段差・機構・締結具などを作り込む。単色で平滑な面だけにしない。
- LZ-2 の発光は狙撃系射撃線 `0xc2faff` に合わせた淡い水色。SR の水色ネオンと並べて実画面で識別を確認する。
- 後ろから見える面（三人称視点）に、大きな明るい板を作らない。LZ-2 の放熱フィンは最初本体より幅広で、後ろから白い板に見えたので狭めた。
- 新しい色は PALETTE に足す。武器ファイルで直接色を作らない。
- 他作品の武器の形を写さない。

## 検査項目

自動（`check_weapon.py`、結果は `out/<kind>/check.json`）:

| 項目 | 合格基準 |
|---|---|
| 三角形数 | 12,060 以下（9,000 超は警告） |
| 材質数 | 6 以下 |
| ファイルサイズ | 800KB 以下（500KB 超は警告） |
| 構成 | 1メッシュ、ノード変換なし、テクスチャ・透過・アニメーションなし |
| 寸法 | 上の枠の中、前端 ≧ 後端の長さ + 0.10 |
| 銃口の自動算出 | 最長軸が前後、前端が選ばれる、左右のずれ 2mm 以内、高さが `bore_z` から 4mm 以内 |
| 握り・支え | 決まった範囲に頂点があり、半幅が握れる太さ |
| ネオン外形 | 全点が本体の範囲内 |
| レア度5本 | 頂点と三角形の接続が同一、インレイの色が `GRADE_COLORS` と一致 |
| 読み直し | Blender へ読み込んで、三角形数・寸法・材質名が `report.json` と一致 |
| インレイの遮蔽 | 読み直したGLBを左右から直交方向に各9点検査し、全点で識別材質が最初に見える |

加えて `node scripts/check-weapon-rarity-invariants.mjs` は新規9種の5レア度について、識別材質のRGB以外のglTF設定とバイナリが同一であることを比較する。未完成時だけ `--available` で生成済み分を確認できるが、完成時は引数なしで全種を通す。ネオンは製品側で別に生成されるため、この比較に含まれない。

目で見る（`out/<kind>/views.png`）:

- 札サイズ（96×36 等倍）で目印が読める。
- 「今との比較」で、今借りている形と別物に見える。
- 同じ系統のもう1丁と、輪郭だけで区別できる（シルエット表の最下段と見比べる）。
- 後ろ・前から見て、不自然な板・穴・浮いた部品がない。
- ネオン縁取りが輪郭から大きく離れていない。

## 8丁の作業メモ

| kind | 型番 | 構え | 銃身軸の高さ | 気を付ける点 |
|---|---|---|---|---|
| smg | SMG-3 ワスプ | rifle | 0.095 | 太い３区画と短い枠形銃床。針の先端だけが前端3%に入るようにする。太い胴と手・体の干渉を確認 |
| slug | SG-7 スパイク | shotgun | 0.080 | 棘は前端より手前で終える。太い７本の真鍮帯と上部輪、下の棘・レバー輪でSG-4と輪郭を区別。握りと左手位置を確認 |
| heavy | RL-9 メテオ | rocket | 0.13 | 短筒は上端が枠（0.21）に近い。取っ手の太さを含め、前端面は軸に対称に。射撃時の弾体との交差を実画面で確認 |
| sniper | SR-1 ソーン | rifle | 0.046 | 前端 0.70 は枠いっぱい。銃口の返しは前端より手前。スコープの対物側を太く |
| grenade | GL-6 ホロウ | rocket | 0.053 | 担ぐ構えに合わせて後部を短くまとめ、6連弾倉と照尺を残す。兵士との接触を確認 |
| sticky | ST-3 リンバー | rocket | 0.045 | 担ぐ構えに合わせた筒形。3本の大きな薬液槽を枠と配管で囲む。発光の黄緑を R のネオンと並べて確認 |
| kick | KB-6 ケストレル | shotgun | 0.0475 | 後ろの噴射口を前より短く。翼は半幅 0.115 以内 |
| medic | MD-4 ブルーム | rifle | 0.045 | 花弁4枚を軸に対称に。丸い胴は `rod` の分割数で三角形が増えやすい |

銃身軸の高さはシルエット表の先端形から読んだ目安。作るときに先端の上下の中心へ合わせ直す。

## 組み込み（進行中）

- `public/assets/weapons/` の下に新しいフォルダを作って GLB を置く。現行の `realism-v2/` は消さない。
- `ModelKind` / `MODEL_OF` を12種へ広げる。体の構え（rifle / shotgun / rocket）は別の対応表に分ける。
- `weapon-rarity-glow.ts` の `PROFILES` に、各 `out/<kind>/report.json` の `neon_profile` を足す。
- `loadStandardTrooper`、`progression-weapons.ts`、`weapon-sharing.ts` の読み込み先。
- 配信ファイル一覧・キャッシュ、既存の `scripts/check-weapon-*`、実画面での手持ち・背負い・装填・銃口エフェクトの位置確認。

## 設計・初回試作段階で確かめたこと・確かめていないこと

確かめた:

- LZ-2 の生成、5本の GLB 書き出し、読み直し検査（38項目すべて合格）。
- three.js での表示（多面、札サイズ、詳細プレビューと同じ構図）。最終の画像はソフトウェア描画。

確かめていない:

- ゲーム本体での表示、手持ち・背負い・装填・銃口エフェクトの位置。
- スマホ実機、音。
- 製品の `weaponBore` そのものでの実行（同じ計算を Python で書き直して確認した）。
- LZ-2 以外の8丁の3D。
