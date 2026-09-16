# 効果説明の対象武器を見出しへ（2026-09-17）

ユーザー依頼により、特殊効果dialogの効果名の横へ小さく「（対象武器：...）」を追加。貫通=アサルトライフル、残弾装填（一覧の残数装填）=全武器、撃退散弾=ショットガン、誘爆弾頭=ロケット。説明本文から対象武器の重複文言だけを除去。説明の効果量/制約は維持。武器種ヘルプには対象武器表示を追加しない。極端な狭幅では見出し内の折返しを許容する。

base a2d3eb41a1b11a98a0b51485628cbbf59cde8b95、branch codex/effect-target-heading。
変更: src/client/weapon-help.ts、src/mobile-ui.css、scripts/check-gear-effect-help.mjs。武器一覧の4文字表示・行構造・保存・戦闘ロジックは変更なし。

検証: typecheck成功。既存check-gear-effect-help.mjsを拡張し、844/640幅×通常/整理×7種=28条件成功。全4効果で対象武器表記の正しさ・見出しと同じ行・横はみ出しなし・本文の重複削除・タップ/Enter・閉じる/Escape・フォーカス復帰・装備/整理選択/保存不変・pageerror 0。貫通/残弾装填/長文誘爆の画像を目視。証拠 dist-validation/effect-target-heading/。実スマホ未確認。
独立Chat監査・main反映・公開準備中。