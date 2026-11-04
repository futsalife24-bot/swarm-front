# 主担当への引き継ぎ：生存カードのデザイン試作（2026-11-04、Claude Code）

## 渡すもの

- リポジトリ：https://github.com/futsalife24-bot/swarm-front
- 作業場所：`C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a/task-survival-card-design`（専用worktree）
- branch：`claude/survival-card-design-20261104`
- 基点：main `24cbbae65568c9a034214a421e13627abfd886f9`
- 変更ファイル：`design/survival-card-preview/` 以下だけ。`src/`・`public/`・共有CSS・カード定義・設定・依存関係は変更していない。
- mainへのmerge、実ゲームUIの置換、Worker公開はしていない（依頼どおり）。
- 起動方法・方針・部品構成・データ項目・仮の仕様：[README.md](README.md)
- 撮影画像と検査結果：`shots/`（`report.txt` は126項目すべてOK）

## 組み込みの順番の提案（主担当の判断用）

1. 正式な表示分類と、各カードの分類の割当を決める（`kind`）。属性・射撃方式を入れる場合は、その一覧を決める（`affinity`・`shot`）。
2. `card.css` と `card.js` の描画関数を、ゲーム側のモジュールへ移す。`.sc-` 接頭辞のまま共有CSSに入れても、既存のクラスとは衝突しない。
3. 3択（`frontUpgradeCardMarkup`）を `render.L` に置き換える。既存の `data-card`・`is-picked`・`is-dismissed` の流れは、そのまま `state` に対応する。
4. HUD（`frontUpgradeStrip`）と取得一覧（`frontUpgradeDetails` の `li`）を `render.S` と `render.row` に置き換える。
5. 基地（`front-base.ts` の `.base-tile`）を `render.M` に置き換える。
   - `data-pool`・`data-inspect`・`role="checkbox"` は維持してある。
   - 検証器 `scripts/check-front-base.mjs` の、チェック枠を20×20pxとする判定は見直しが必要。この案では見た目の四角が20px、当たり判定は右端の全高×36〜40px。
6. 現行の融合カードの常時発光（`front-fusion-glow`）は、この案では使っていない。置き換え時に外すかどうかを判断する。

## 現行画面で気づいたこと（デザインの範囲外。未修正）

- 開幕の3択（ソロ生存、出撃直後）で、中央の作戦演出「出撃 DEPLOY」が3枚のカードに重なって表示された。844×390・640×360の両方で確認（開発サーバー上、隔離した新規状態）。
  - 演出が消えるまでの約2秒間、中央のカードの名前・効果が読みにくい。
  - 2026-11-03の「作戦演出を画面中央に表示」との関係は未調査。

## 共有記録への追記案（直接は編集していない）

### docs/STATE.md 先頭への追記案

```
# 生存カードのデザイン試作（2026-11-04、Claude Code、未merge）

生存カードを見分けやすく選びたくなるカードにするため、独立したプレビューを branch `claude/survival-card-design-20261104`（基点 `24cbbae`）の `design/survival-card-preview/` に作った。
- 構成：表示分類（仮）＝枠の形＋文字、系統・属性＝紋章＋絵柄、射撃方式＝矢印チップ、段階＝丸。基地（M）・3択（L）・取得一覧（row）・HUD（S）で同じ部品を使う。
- 確認：844×390・640×360 × 動きの通常／軽減で126項目合格。
- 変更範囲：実ゲームのコード・CSS・カード定義は不変。
- 仮置き：分類の割当、属性、射撃方式、仮例カード。カードのゲーム仕様は主担当が決める。
- 未確認：実スマホ、実ゲームへの組み込み。
- 詳細：design/survival-card-preview/README.md・HANDOFF.md
```

### MainVault（10_プロジェクト/swarm-front.md）への追記案

```
## 生存カードのデザイン試作（2026-11-04、Claude Code、未merge）
- branch claude/survival-card-design-20261104 の design/survival-card-preview/。HTMLを直接開くか、node design/survival-card-preview/serve.mjs で表示する。
- 方針：分類（仮）は枠の形と文字ラベル、属性は紋章と絵柄、射撃方式は矢印、段階は丸。候補（デッキ）は四角いチェックで、作戦中の取得とは別の記号にする。常時の発光はなし。
- 検査：2サイズ × 動きの通常／軽減で126項目合格。実スマホは未確認。
- 次の作業：主担当が分類・属性・カード仕様を決めて組み込む。開幕3択に「出撃」演出が重なる件を申し送った。
```
