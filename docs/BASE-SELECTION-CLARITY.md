# 基地の選択と編集終了を明確にする（2026-10-08）

## 本人の訂正と変更

「キャンセル／戻る」では編集が残るか分からない、強化項目の「？」は不要で左端に☑を置きたい、という本人の画像付き指示を反映。

- 編集終了は「編集中の変更があります」「編集を続ける／変更を破棄して戻る」。呼び出しも「変更を破棄して呼び出す」と結果を明記。既定フォーカスは編集継続。
- Escがゲームのpause共通処理に奪われていた既存不具合を修正。基地dialog内のkeydownを外へ伝えず、標準の閉じる・フォーカス復帰を維持。
- 強化は左端の20pxチェック枠と選択時の明るい背景・枠で状態を示す。カード全体が押下領域、role=checkbox/aria-checkedを使用。Space/Enterとタッチで切替。未解放は選択不可。
- 一覧の「？」を撤去。ホバー／フォーカス／選択で右の説明を切替。ホバー・フォーカスは選択や保存を変更しない。融合は直接編成する項目ではないためチェック枠を設けず、従来のレシピ閲覧・素材追加を維持。
- 選択は編集中の候補だけを変更。出撃セット・デッキ保存は明示操作のみ。候補数条件・開幕ランダム3択・保存形式・ソロ/協力通信・武器行は変更なし。

## 対象

正本 https://github.com/futsalife24-bot/swarm-front 、作業場所 `C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a`。
base `4f758d908cb22a04717baf6126db91f1cf0d5713`、branch `codex/base-selection-clarity-20261008`。変更はfront-base.ts/.cssと関連UI確認2本。本記録と証拠を同じPRに含める。

## Windows検証

- 型チェック成功。関連単体 `npm run test:front` は12ファイル83件成功。
- 本番build、既存設定のWorker production dry-run成功。Esc修正後に型/buildも再確認。
- `check-front-base.mjs` に左端チェック枠、説明閲覧時不変、Space切替、未解放、編集継続、Esc、フォーカス復帰、破棄後再入場、保存不変の実画面検証を追加。通常/reduced×844×390・640×360・1220×413の6条件すべて成功、page/console errorはすべて0。デッキ保存/呼び出し/反映/再読込、融合素材、協力画面の寸法も成功。844/640の画面と確認ダイアログを目視照合。
- 初回はdev起動直後の読み込みtimeout。Escの実不具合は製品修正。試験補助のclose待機/aria-disabledタップを修正。協力画面が既定8787へ接続して拒否されたため、dev環境だけVITE_SERVER_URLを実Worker8789へ揃えた。通信のモックなし。
- 実行証拠は `docs/evidence/base-selection-20261008/`、一時出力は `dist-validation/base-selection-20261008/`。

既存テーマ・各武器1行・余白/操作段の抑制・入力/通信を演出で待たせない全体共通基準を適用。今回全画面/全敵モデルを再監査・再検証したとは主張しない。実スマホ・スクリーンリーダー実機・長期GPU負荷は未確認。戦闘演出/PR137は保留。モデルID/推論設定は未確認。

## 独立監査と公開

repo skill `docs/skills/swarm-front-audit-release/SKILL.md` の固定経路で、対象commitのソース/差分/画像/検証/manifestを通常新規Chatへ添付し判定を待つ。合格後の通常merge・既存Worker公開・配信/health/公開UIの結果は追記する。

[PR150](https://github.com/futsalife24-bot/swarm-front/pull/150)。対象 `1b564377370cb3782f8cd8b44aed6ef58739966b`（製品 `4fba4310437762b07dca74edfdb498aa0efdc896`）は [通常新規Chat](https://chatgpt.com/c/6ac6ad7b-f114-83ee-ae9a-c776bd638728) で合格、P0/P1/P2すべて0。監査後の製品修正なし。任意R1はスクリーンリーダー実機の読み上げ順で、公開阻止ではない。[回答全文](evidence/base-selection-20261008/audit-final.md)。監査側はZIP/manifest全242件・差分/関連コード・画像/ログを照合し、Chrome/83単体/build/Worker通信は独立再実行していない。

ZIP `dist-validation/base-selection-20261008/audit-1b56437.zip`（22,498,421 bytes）、SHA256 `64089770518c2336d5f28a7ad41852aaa402ebd66bf166cf960a7485cc81fa4d`。対象以後の追加は監査・公開記録だけ。
