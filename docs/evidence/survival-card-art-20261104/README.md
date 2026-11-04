# 生存カードの生成素材組込（2026-11-04）

本人が採用した見本と「文字欄は空欄」の方針に従い、火炎弾・氷結弾・連鎖雷・ヒートリアクターの4枚を文字なし画像へ分離し、基地・3択・取得一覧・HUDに組み込んだ。通常/融合の装甲枠2点も別画像とし、文字・分類・数値・段階・除外状態はUIが描画する。

- 対象repo: https://github.com/futsalife24-bot/swarm-front
- 場所: `C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a/task-survival-build`
- branch: `codex/survival-card-art-20261104`
- base: `548313c9c9a9cbd77f1d4f0d9c0f340bd1f22b76`、開始時clean。
- root・元Claude試作・バディ・他worktreeは未編集。

## 変更

- 4枚の絵を色だけでなく形・視点でも区別。通常は控えめ、融合は豪華な反応炉と炎。生成方法・原本・全文プロンプト・変換手順は[制作記録](../../../design/survival-card-art/README.md)。内蔵画像生成のみ使用。
- WebP10点で合計303,552 bytes。640pxと128pxを使い分け、透明枠は512px。旧PNG/SVGを削除せず、実際の参照素材のみ一括保存へ接続。
- 基地の左は横長・画像/名前/分類のみ。表示件数9/6枚、除外の鎖×を維持。右の4枚の絵を拡大し、除外チェックを詳細スクロールから独立した下端に配置。
- 3択は絵を大きく表示できる縦方向の領域を増やす。未発見融合は引き続き伏せる。基地の非選択融合は静止。OS/ゲームの動き軽減で動きを止める。
- 火炎/氷結/電撃の数値は従来通り戦闘用 `FRONT_ELEMENT_RULES` を参照。戦闘・抽選・解放・保存形式は変更しない。

## 確認済み

- `npm run typecheck` 成功。
- `npx --no-install vitest run --config vitest.front.config.ts tests/front-upgrade-ui.test.ts tests/front-element-catalog.test.ts tests/front-fusion-discovery.test.ts`: 17件成功。
- `npx --no-install vitest run tests/asset-download-manifest.test.ts`: 16件成功。新旧素材の参照と一括保存を照合。
- `ORIGIN=http://127.0.0.1:5186 node scripts/check-survival-cards.mjs dist-validation/survival-card-art/cards`: 844×390・640×360・667×320 × 通常/動き軽減、全6条件成功。各72カード表示、本文/段階/素材の欠けなし、横スクロールなし、ページ例外0。HUDと取得一覧の8画像は128pxを読込。部品fixtureであり実戦を代替したものではない。[結果](cards.json)、[通常3択](choices-elements.png)、[融合を含む3択](choices-fusion.png)。
- `ORIGIN=http://127.0.0.1:5186 node scripts/check-survival-elements-base.mjs dist-validation/survival-card-art/base`: 隔離Chromeの844×390・640×360で成功。進撃3突破/融合発見記録だけ端末内fixtureで用意し、以後は通常のタップとSpaceで除外・保存・再読込・解除を確認。初期一覧は9/6枚完全表示。スクロール前後の除外チェック位置は一致、当たり判定40px以上。未発見融合は絵を伏せ、発見済みヒートリアクターを確認。非選択融合のアニメーション0、ページ例外0。[結果](base.json)、[除外](base-exclusion.png)、[融合](base-fusion.png)。実ユーザーの保存は未使用。
- 撮影画像を目視し、絵柄の差、金枠、文章とチェックの可読性を確認。

- `BASE_ORIGIN=http://127.0.0.1:5186 BASE_OUTPUT=dist-validation/survival-card-art/defense-base node scripts/check-front-base.mjs`: 844×390・640×360・1220×413 × 通常/動き軽減、全6条件成功。防衛の候補チェック・デッキ保存/反映/再読込・融合素材・タッチ判定・画面寸法を維持。[結果](defense-base.json)。
- 書式・`git diff --check` 成功。専用の開発サーバーは検証後に停止。

本番build・dry-run、main反映と配信確認は後続記録で確定する。

## 残件と境界

新しい絵は4枚のみ。残り30枚は既存絵。実スマホ、端末ごとの長時間負荷、公開版の協力、今回の変更後の実戦通しプレイは未確認。戦闘処理を変えたとは扱わない。主担当のみ、実モデルID/推論設定は取得不可。通常方針により独立Chat監査は自動追加しない。
