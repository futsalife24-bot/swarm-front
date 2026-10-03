# 従来HUD継承版の公開記録（2026-10-03）

[改装版](https://swarm-front.melosalife-24.workers.dev/front)に、従来の出撃中UI/HUDを反映済み。HPバー・残弾/装填・照準/被弾・ダウン/蘇生・味方/大型HP・ミニマップを既存の共通部品へ戻した。操作ボタンと共通スタイルは従来の配置を使用。改装版の経験値/強化/進化だけを短い補助表示にまとめた。

## ソースと独立監査

- 作業branch `codex/front-combat-hud-20261003`、base `4f289fef938300dbdd6dbba6a3e7b453a058051d`。
- 実装 `75f0a02df2e992d26dfd37337b1683bc03bbb326`、固定監査対象 `9117cc35c958035abf01d1b38740af937ca7f279`、PR最終head `2bb40bc2ab166e2e1dd143408ae019866311c1ec`。
- [PR119](https://github.com/futsalife24-bot/swarm-front/pull/119)を通常merge。公開ソースmain `a0e8f7c5d5f4b77f5788f7fc0f22c45db6f97569`。
- [通常Chat](https://chatgpt.com/c/6ac0ae95-daa4-83ee-9305-b65677985716)の同SHA限定再監査は合格、必須P0/P1/P2なし。[完結した判定本文](evidence/front-hud-20261003/audit-final.txt)を保存。
- 監査UIの通信エラーが併記されたためChat側の永続保存は未確認。本文の全出力とコピー/再生成操作、停止操作の消失を確認し、完結した独立判定をGit証拠へ保持した。判定後の変更は記録のみ。
- 監査側はソース/差分/主要blob/比較画像/寸法/ログを独立照合。依存取得を行わず型/単体/実UI/buildは再実行していない。自己検証と分けて記録。

## 検証と公開

型、共通HUD/救助単体14件、横844×390/640×360の旧版と改装版の実UI比較2件、実Worker2人協力UI1件成功。旧セーブ文字列不変、ページエラー0。10部品のスタイルと、文言依存の中央幅以外の配置が一致。保存ソースと公開mainのbuild/Worker dry-run成功。

既存設定 `wrangler.production.jsonc` で公開。Worker Version `0aa3a0f1-0046-4e12-b901-1e60e6b81a44`。health 200/ok true、配信37ファイルのSHA256全一致。[配信照合](evidence/front-hud-20261003/delivery.json)。

公開ブラウザで3択中ミニマップ非表示→強化選択→従来HUD/ミニマップ表示→一時停止→設定→同じ戦闘再開→終了時ミニマップ非表示→出撃メニューへ復帰を確認。公開HUDと設定の画像を保存、実行エラー0。確認時は無操作のため17秒で部隊全員ダウンして終了した。

[公開画面](evidence/front-hud-20261003/public-battle.png)・[設定画面](evidence/front-hud-20261003/public-settings.png)・[変更と自己検証](FRONT-COMBAT-HUD.md)。旧版入口、保護ブランチ、既存セーブ、敵4倍/通常HP半分・空中XP回収・戦闘中設定・3択画像/アニメーションを維持。物理Android/ジャイロ/97体FPSは未確認。主担当1体、実モデル/effort未確認、切替なし。

公開後の記録は文書/証拠だけの通常PRでmainへ保存する。コード変更・再公開は不要。
