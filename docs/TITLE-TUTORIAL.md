# タイトルのチュートリアル（2026-09-16）

base: 83e005012e43271d9f3c640ca3263dafb67f62d1
branch: codex/title-tutorial

タイトルの補助メニューにだけ「チュートリアル」を追加。既存モーダル/テーマを継承し、「各ページ」「システム」「進め方」の3タブで基本説明を表示。本文だけスクロールしタブ/閉じるは固定。左右キー/Home/End、Escape、閉じた後の入口へのフォーカス復元に対応。進行開始前でも閲覧でき、保存/戦闘/通信処理の変更なし。

検証: typecheck、通常build成功。check-title-tutorial.mjsで1280×582/844×390/667×375の全3タブ、画面内表示・横溢れなし、キーボード操作、閉じる/再表示、タイトル以外で入口なし、初期/既存進行の保存不変、pageerror 0を確認。667タイトル・844本文を目視確認。check-gear-ui-baseline.mjsの4幅通常/整理/操作検証成功。証拠: dist-validation/title-tutorial/、dist-validation/gear-pinned/built.json。実スマホ未確認。独立監査・main反映・公開は準備中。
