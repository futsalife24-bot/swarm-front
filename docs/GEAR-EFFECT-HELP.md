# 特殊効果の短縮表示とタップ説明（2026-09-17）

出撃準備・共通武器一覧の効果欄を既存effectHelpへ接続。通常行と装備固定行を4文字以内（貫通×3・残数装填・撃退散弾・誘爆弾頭）にし、効果タップで既存の説明dialogを開く。残数装填は既存「残弾装填」の短縮表示。効果なし・旧quick・ショットガン標準貫通は従来どおり「ー」。保存値・戦闘計算に変更なし。

base: b070a10ba2c035d648d2833b991f65cb679cbbb9、branch: codex/effect-help。
変更: src/client/gear-weapon-list.ts/css、src/client/weapon-help.ts、scripts/check-gear-effect-help.mjs。

検証: typecheck成功。check-gear-ui-baseline.mjsは1280/915/844/640幅×通常/整理で成功。844以上は横スクロールなし、640は既存補助スクロール。check-gear-effect-help.mjsは844/640幅×通常/整理×7種=28条件成功。4文字以内・説明本文・タップ/Enter・閉じる/Escape・フォーカス復帰・固定行・保存不変・整理チェック不変・pageerror 0。画像目視で一覧と説明dialogの収まり確認。実スマートフォンは未確認。
テストは先にcheck-gear-ui-baseline.mjsで生成する合成fixtureを使用。初期試行は不正なレア度fixtureと非同期close待ち不足で失敗し、テスト側を修正後に成功。
証拠: dist-validation/gear-effect-help/、dist-validation/gear-pinned/。
独立監査・main反映・既存Worker公開は準備中。

## 保存・独立監査

[PR #30](https://github.com/futsalife24-bot/swarm-front/pull/30)、対象2091b9a26f3ed3a3d356823a7637c808315a2075。通常/Pages build・production dry-run成功（dry-run初回はsandbox権限で失敗、昇格再実行成功）。[独立監査Chat](https://chatgpt.com/c/6aab056e-2750-83ee-af1a-84e43782cc1e)へgear-effect-audit.zip（差分・必要ソース・操作結果・画面証拠）を送信済み。結果確認中。
