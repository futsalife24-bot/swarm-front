# 生存カードの絵と枠（2026-11-04）

本人が採用した[4枚の見本](reference-approved.png)を、文字なしの実装素材へ分けた初回4枚。内蔵 `image_gen` で参照画像から6回個別に生成した。外部API/CLI生成、新規依存の追加はしていない。

## 素材と表示

| カード | 制作した絵 | 生成PNG原本 |
| --- | --- | --- |
| 火炎弾 | 斜めに飛ぶ単発の焼夷弾、立方体の炎の尾 | [fire-rounds-v1.png](source/fire-rounds-v1.png) |
| 氷結弾 | 正面の氷塊に閉じ込められた機械敵 | [frost-rounds-v1.png](source/frost-rounds-v1.png) |
| 連鎖雷 | 俯瞰の3体をZ字につなぐ電撃 | [chain-lightning-v1.png](source/chain-lightning-v1.png) |
| ヒートリアクター | 重厚な反応炉、白熱する金色のコアと炎 | [fusion-reactor-v1.png](source/fusion-reactor-v1.png) |
| 通常枠 | 黒鉄・銀の面取り装甲と細い青い光、中央は透明 | [frame-normal-v1.png](source/frame-normal-v1.png) |
| 融合枠 | 二重の金レール、金具、燃えるような輝き、中央は透明 | [frame-fusion-v1.png](source/frame-fusion-v1.png) |

全原本は1254×1254。プロンプト全文と参照画像の役割は[prompts.json](prompts.json)。見本の文字は参照用で、生成した6素材にはカード名・効果・数値・段階・状態を含めていない。

配信用は `public/rebuild/card-art/` のWebP10点、合計 **303,552 bytes**。[大きさ・容量・透明度](encoding.json)。イラスト本体640px、一覧/HUD用128px、枠512px。図柄は変えず解像度と形式を変換した。原本を本番へ配信しない。

枠はCSSの9分割で四隅を保って伸ばす。通常の武器強化は青、能力強化は同じ金属枠の光を緑へ変え、同じレア度を維持する。融合は金枠。基地の非選択融合は動きを止め、選択中と3択では既存の炎のきらめきを残す。OS/ゲームの動き軽減は両方尊重する。24pxのHUDには装飾枠画像を載せず既存の分類枠・融合印・段階を維持する。

## 次のカードを追加する手順

1. 通常は落ち着いたボクセル絵、融合は豪華な完成形。属性は色に加え形・視点・構図を変える。中央に主役を収め、枠や文字は描かない。
2. 生成原本を `source/<id>-vN.png` へ保存し、プロンプトを残す。
3. リポジトリのルートで `node design/survival-card-art/encode.mjs` を実行する。既存のPlaywrightとChromeでWebPへ変換し、枠の中央アルファ0も確認する。依存パッケージの追加は不要。
4. `src/client/survival-card-art.ts` のIDと素材パスを追加する。640pxを3択/基地の詳細に、128pxを一覧/HUD/素材表示に使う。一括保存の索引もこの表を読む。
5. 名前・分類・効果・段階は既存のUI部品で表示する。今回の3属性の数値は `src/shared/front-elements.ts` の戦闘用定義を表示にも使用する。残りの既存カードの効果式は今回変更していない。
6. [検証記録](../../docs/evidence/survival-card-art-20261104/README.md)の表示検査を実施する。旧素材を削除しない。

既存34枚中、イラストを更新したのはこの4枚。残り30枚は既存絵と共通の新枠を使用する。素材の制作・採用を順に進められる状態。

リポジトリ: https://github.com/futsalife24-bot/swarm-front

作業場所: `C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a/task-survival-build`。実装branch: `codex/survival-card-art-20261104`。
