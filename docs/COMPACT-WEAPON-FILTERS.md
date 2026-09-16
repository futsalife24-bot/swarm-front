# 武器一覧のソート・絞り込み統合（2026-09-16）

base: c98c0fa328140ebcfb9ded7b2a3694a7d5c076a5
branch: codex/compact-weapon-filters

「ソート・絞り込み」1ボタンから幅280pxの整理パネル風UIを開く。並び順8項目、武器種、レア度、お気に入りのみを同じパネルで操作。お気に入りは既存shared-armoryと同様にlocksに対応し、新しい保存項目は追加しない。お気に入り順はロックを先頭、同順位は入手順。

変更対象は共通武器一覧（武器庫・出撃準備・結果）。条件変更時はパネルとフォーカスを保持。閉じる/Escape対応、低い画面はパネル内スクロール。一括操作と排他表示。絞り込み変更時は解体選択解除、一括選択は表示条件と既存保護条件を両方適用。お気に入り解除後は即時再表示。

基地への名称変更・施設構成は今回未実装。今回の依頼範囲は武器一覧操作。

検証: 型チェック、通常build、UI基準4幅（1280/915/844/640）成功。既存一覧/整理/解体の合成fixture検証に加え、お気に入りソート、絞り込み、解除時再表示、LR絞り込み、パネル画面内、Escapeを確認。絞り込みに合致しない武器の一括選択除外、パネル排他開閉、選択解除も成功。iab配布版844×390でパネル、0件絞り込み、手動開閉を目視確認。実スマホ未確認。

証拠: dist-validation/gear-pinned/local.json と各幅のスクリーンショット。独立監査・main反映・公開は未完了。

## 保存・公開状況

[PR #23](https://github.com/futsalife24-bot/swarm-front/pull/23)。実装SHA `2fe1e96f9a7146b4093ea0ff53d994c0492cf924`。commit後通常/Pages buildとproduction Worker dry-runも成功。初回dry-runはsandbox参照権限で失敗、承認済み通常権限で成功。

監査ZIPはdist-validation/compact-filters/compact-filters-audit.zip（対象SHAのソース、差分、4幅UI証拠、検証記録）。iab新規通常ChatへのZIP添付は自動承認レビュー拒否で未送信。「具体的payloadの送信承認がない」が理由。今回ZIPのChatGPT送信の明示承認を待つ。独立監査・main反映・公開は未実施。

## 独立監査合格

2026-09-16ユーザー「聞かずに監査に送って」を受け、同ZIPの通常新規Chat送信成功。前回送信拒否は解消。[監査Chat](https://chatgpt.com/c/6aaa5029-3db4-83ee-ae54-08d28735dbc8)で実装SHA `2fe1e96f9a7146b4093ea0ff53d994c0492cf924` は合格・必須指摘0件。

監査側はGitHub実差分、添付ソースの正規化Git blob一致、12枚UI証拠、locks対応、選択解除/表示条件/保護条件、Chromiumで同DOMパターンのdetails排他・フォーカス復元/Escapeを独立確認。任意提案: 一括選択除外はレア度上限と表示条件を分離したfixture、選択解除は先に複数選択して検証する。コード自体は明示的条件があり必須指摘とせず。検証限界: 監査環境で依存取得不可によりtypecheck/build/Pages/dry-run再実行不可、実スマホ・武器庫/戦果の監査側実画面なし。実装担当のiab武器庫確認は前記。
