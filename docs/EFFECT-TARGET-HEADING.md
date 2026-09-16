# 効果説明の対象武器を見出しへ（2026-09-17）

ユーザー依頼により、特殊効果dialogの効果名の横へ小さく「（対象武器：...）」を追加。貫通=アサルトライフル、残弾装填（一覧の残数装填）=全武器、撃退散弾=ショットガン、誘爆弾頭=ロケット。説明本文から対象武器の重複文言だけを除去。説明の効果量/制約は維持。武器種ヘルプには対象武器表示を追加しない。極端な狭幅では見出し内の折返しを許容する。

base a2d3eb41a1b11a98a0b51485628cbbf59cde8b95、branch codex/effect-target-heading。
変更: src/client/weapon-help.ts、src/mobile-ui.css、scripts/check-gear-effect-help.mjs。武器一覧の4文字表示・行構造・保存・戦闘ロジックは変更なし。

検証: typecheck成功。既存check-gear-effect-help.mjsを拡張し、844/640幅×通常/整理×7種=28条件成功。全4効果で対象武器表記の正しさ・見出しと同じ行・横はみ出しなし・本文の重複削除・タップ/Enter・閉じる/Escape・フォーカス復帰・装備/整理選択/保存不変・pageerror 0。貫通/残弾装填/長文誘爆の画像を目視。証拠 dist-validation/effect-target-heading/。実スマホ未確認。
独立Chat監査・main反映・公開準備中。

## 保存・独立監査

[PR #31](https://github.com/futsalife24-bot/swarm-front/pull/31)、対象b4493ffd1e01718cd8d0fa04fa35086466b73be7。通常/Pages build・production dry-run成功。[監査Chat](https://chatgpt.com/c/6aab12af-b96c-83ee-9540-b1486e7f3566)へeffect-target-audit.zip（対象差分・必要ソース・20画像・結果）を送信済み。監査結果確認中。

## 独立監査合格

対象b4493ffd1e01718cd8d0fa04fa35086466b73be7は合格・必須指摘なし。4種対応/本文数値と制約維持/20画像を確認。後続e990b98は監査記録文書のみ。任意提案の武器種help UIテスト追加は未実施（コード分岐は確認済み）。監査側ではbuild再実行/実スマホ未確認。main反映・公開へ進む。

## main反映・公開完了

PR #31通常merge。公開ソースa5073b0836b45f2b45fe00be40e4c6d9e486ae86、Worker Version 54284dd6-4541-4096-b9fd-d0356021a24f。merge後build/dry-run成功、配信12ファイルSHA-256一致・health ok。公開iabタイトル→出撃準備成功・errorログ0。公開保存は初期武器のみのため効果dialogはローカル合成保存で確認、実スマホ未確認。[操作結果](evidence/effect-target-heading/results.json)・[配信照合](evidence/effect-target-heading/published.json)。後続は公開記録のみ。
