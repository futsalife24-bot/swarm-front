# タイトルのチュートリアル（2026-09-16）

base: 83e005012e43271d9f3c640ca3263dafb67f62d1
branch: codex/title-tutorial

タイトルの補助メニューにだけ「チュートリアル」を追加。既存モーダル/テーマを継承し、「各ページ」「システム」「進め方」の3タブで基本説明を表示。本文だけスクロールしタブ/閉じるは固定。左右キー/Home/End、Escape、閉じた後の入口へのフォーカス復元に対応。進行開始前でも閲覧でき、保存/戦闘/通信処理の変更なし。

検証: typecheck、通常build成功。check-title-tutorial.mjsで1280×582/844×390/667×375の全3タブ、画面内表示・横溢れなし、キーボード操作、閉じる/再表示、タイトル以外で入口なし、初期/既存進行の保存不変、pageerror 0を確認。667タイトル・844本文を目視確認。check-gear-ui-baseline.mjsの4幅通常/整理/操作検証成功。証拠: dist-validation/title-tutorial/、dist-validation/gear-pinned/built.json。実スマホ未確認。独立監査・main反映・公開は準備中。

## 独立監査

[PR #27](https://github.com/futsalife24-bot/swarm-front/pull/27)、[監査Chat](https://chatgpt.com/c/6aaa7ff6-6bc0-83ee-bcbf-15c6ca137ac7)。対象ecf1aec20d9157e72d855a5d4cc47a8b05c38dc6は合格・必須指摘なし。GitHub base/head、変更blobと逆適用旧blob、3幅全タブ画像、タイトル限定・保存無変更・キーボード/フォーカス実装を独立確認。任意: 内容量によるモーダル高さ/位置変化を抑える改善。今回は要件を満たすため維持。監査側の限界: 実スマホ/PWAインストールボタン併存状態未確認、依存導入タイムアウトで全build/typecheck再実行不可。新規TS単体チェック/検証スクリプト構文確認は成功。実装担当のcommit後通常/Pages build・production dry-runは成功。後続変更は記録のみ。
