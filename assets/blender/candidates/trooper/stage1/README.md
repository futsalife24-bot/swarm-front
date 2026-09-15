# プレイヤー兵士 第1段階・人体試作

状態：手袋比率P1-01の修正後、独立視覚監査で第1段階合格。回答全文は `audit-round2-pass.md`。このblendは合格時点の保存版として維持し、第2段階は兄弟ディレクトリー内の別名試作で進行中。

## 正本と保護

この作業の正本は `game/` のv4。GitHub mainやlegacyは使用していない。
branch `codex/home-armory`、base/head `2be699f160c83d641fb68bb1304e4da8059920dc`。着手時から多数の変更・未追跡物あり。`git-status-before.txt` に記録。今回の作成物はこの候補ディレクトリー内のみ。commit/push/削除/本体適用/公開なし。

- 元Blender：`assets/blender/source/standard_trooper_v4.blend`
- 生成：`assets/blender/scripts/build_standard_trooper_v4.py` + `trooper_v4_geometry.py`。v3 detail/AO補助も参照する構成。
- ゲーム用：`public/assets/characters/standard_trooper_v4.glb`
- 読込・リグ契約：`src/client/standard-trooper.ts`、`docs/TROOPER-V4.md`

`protected-hashes-before.json` の5ファイルは変更後もSHA-256一致。候補の保存後再読込で、元の全メッシュの頂点・面、57ボーンの親子・レスト行列、15アクション名の保持を検証。元のメッシュは候補内でも削除せず非表示。制作スクリプトが結合するのは新規生成した形状だけ。

## 実データと画像の区別

`source-inspection.json` は元blendとGLBの実読込調査。骨数は双方57。元Bodyは3482頂点・6588三角形・94連結成分。これは形状の離れを示すが、94個すべてが人体の分断という意味ではなく、細部も含む。元モデルのウェイト合計は正常。

試作は胸郭・腹部・骨盤・僧帽筋・袖・脚の断面を定義し直し、交差部をボクセル再メッシュ化、平滑化・減面して連続した形を制作。ポリゴンの増加そのものを改善根拠にはしていない。指・手・人体全体を一括結合して解決した扱いにもしていない。人体の断面と接続部の形を先に変更した。

画像からの自己所見：首の蛇腹と肩の間の分離、腰の球状部分、腕と脚の筒の端面が目立つ状態は減った。現段階は大きな形の試作で、服の仕立て・肘と膝の変形・武器の握りはまだ完成判定していない。

## 比率と理由

単位m、Blender Z-up/+Y前方、ゲームGLBはY-up/-Z前方。全高1.8665、靴底Z=0.0005、オブジェクトスケール・頭の位置・関節中心・ソケットは維持。ゲーム側スケールと当たり判定の変更なし。

実コードでは `standard-trooper.ts` がv4 GLBを読み、`render.ts` が追加スケールなしでキャラクターrootへ接続する。移動時の衝突半径は `game.ts` の0.55m、射撃の基準高度は1.5m。これらを人体寸法へ合わせて変更していない。v4 JSONのheight_mは公称1.865で、メッシュ最上部の実測1.8665とは1.5mm異なる。

|項目|元形状の設計値|候補の断面設計値と意図|
|---|---|---|
|首から肩|首シールZ1.44–1.60、胴上端1.47付近|首の中心を下げず、Z1.43–1.589に肩から首への断面を配置して露出を覆う|
|胸郭|胴最大半幅約0.255|胸郭半幅0.241、前後半厚0.148。肩パッドを外して胸と肩の形を区別|
|骨盤|中心Z0.91、縦半径0.17の球状部|骨盤半幅0.215、股の中央下端設計Z0.825。下垂する塊を短くし両腿へ連続|
|太腿|股→膝の半径0.106→0.079を補正した筒|近位半幅0.121・前後半厚0.140から膝付近0.072/0.079へ。前後にも身体の厚さを確保|
|腕|肩Z1.43、肘1.155、手首0.895|骨長を調べたうえで保持。袖の肩→肘→手首を連続化し、前腕装甲による短く見える影響を除く|
|掌と親指|掌と各指関節が別形状|掌・母指球・指付け根を連続化、指間を確保。既存指骨へ最大2影響でバインド|

表は再メッシュ前の設計値であり、平滑化後の表面寸法の精密計測値ではない。頭身を変えるために頭を縮めていない。逆V字の脚中心幅（股0.25、膝0.35、足首0.47）も維持。

## 提出物

- `trooper_anatomy_stage1.blend`：別名試作。元装備・元Body/Handsを非表示で保持。
- `comparison_clay.jpg`：4方向、上BEFORE/下AFTER。胴体装甲・腰装備を非表示にした単色。旧Bodyに含まれる小細部は一部残る。ヘルメットと靴は両方に保持。
- `comparison_color.jpg`：元全装備と候補の人体・服の土台。これは装甲を戻した完成比較ではない。
- `comparison_small.jpg`：モデル高さ256/128px相当。実ゲーム画面ではない。
- `before/after_{color/clay}_{front/side/back/oblique}.png`：元解像度600×800の各画像。
- `candidate-validation.json`、`reopen-validation.json`：形状・ウェイト・保護検証。

初回3比較シートは生成後に実際に開いて視覚確認済み。初回提出直前の保存は腕のウェイトのみ修正し、描画済み形状と頂点・面のハッシュ一致を検証した。P1-01修正後は全方向を再出力。全身正面・斜めの `p1_01_fullbody.jpg` と、保存後再読込して直接近接撮影した掌・甲・側面の `p1_01_glove.jpg` を開いて確認し、監査チャットへ送信済み。

候補Bodyは9206三角形、P1-01修正後の手は左右1862/1862。全候補メッシュの非多様体辺0、ウェイト合計誤差0、最大2影響。前腕568頂点に脚ボーンが混入していないことも検証。

P1-01は手首を基準に、手袋の幅1.24倍・厚さ1.22倍・長さ1.32倍。指間も同時に広がるため、単に指を太らせて指間を埋める処理ではない。身体形状のSHA-256は初回と一致。指骨・ソケットは保持しており、拡大後の指形状と骨の曲げ位置の適合は次段階で検証する。初回の候補・生成コード・比較画像は `revision1/` に保存。そこに置いた生成コードは変更前のスナップショットであり、その場所からの実行用ではない。

## 再現

リポジトリー `game/` を作業ディレクトリーにして実行する。

```powershell
$trooperBlender = 'C:/Users/futsa/AppData/Local/Programs/Blender Foundation/Blender 5.2/blender.exe'
& $trooperBlender --background --factory-startup --python-exit-code 1 --python assets/blender/candidates/trooper/stage1/inspect_source.py
& $trooperBlender --background --factory-startup --python-exit-code 1 --python assets/blender/candidates/trooper/stage1/build_candidate.py
& $trooperBlender --background --factory-startup --python-exit-code 1 --python assets/blender/candidates/trooper/stage1/validate_candidate.py
& $trooperBlender --background --factory-startup --python-exit-code 1 --python assets/blender/candidates/trooper/stage1/render_details.py
python assets/blender/candidates/trooper/stage1/make_boards.py
```

Blender 5.2.1 LTS。比較シート作成はPillowを使用。画像はBlenderレンダーの縮小・配置・ラベル追加だけで、画像生成AIや描き足しによる造形の修整なし。外部人体素材は未導入。

## 未検証・次段階の境界

武器の握り、肩/肘/膝の屈曲、15モーションの新メッシュ上での互換性、GLBの書出しと再読込、ゲームカメラ・実機性能は未検証。現在の骨格を保持できたことと新しい身体がすべての動作で成立することは別。全モーションを既存のまま完成扱いしない。

監査チャット「参考画像を生成」へ画像3枚と形状・検証説明を送信。内部パス/Gitメタデータの送信は自動承認レビューで拒否されたため送っていない。安全な代替として画像と造形説明のみを提出し、送信済みUIを確認した。承認の迂回は行っていない。
