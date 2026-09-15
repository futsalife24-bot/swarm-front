# 正式分類とレポート表示 — 2026-09-14

ユーザー指示: 生物型・異構型・機構型を正式分類とし、エネミーレポートへ型だけを表示する。ボスは別の区分。

- `src/client/bestiary.ts`: 既存の分類欄を3型へ置換し、型定義でも3値に制限。一覧・詳細で共通の値を使う。PLEAT/RAY=生物型、HOUNDのVOLLEY/LEAPER・PRISM=異構型、FOUNDRY ZEROの通常/連結炉=機構型。戦闘役割やボス表記を分類欄へ併記しない。観察本文・形態切替・モーション・会敵ムービー・遭遇制限は保持。
- `docs/STRUCTURE-ANOMALY-v2.md`: 第1節を正式分類の正本として更新。外観に基づく基準・現行割り当て・ボスとの独立・旧分類見出しの扱いを記録。世界観の正体や起源は確定しない。

branch `codex/home-armory` / base=head `4186f25f7c9695f95ea897ad182db5f85fac3091`。未コミット差分あり。既存変更を保持、commit/mergeなし。

## 検証

型チェック、通常build、Pages build、Worker production dry-run成功。既存の500KB bundle警告あり。表示文字列のみの変更であり、戦闘テストの追加なし。

ローカル配布版の全7形態×844×390/1280×720で一覧/詳細の型名・文字の収まり・本文2節・ムービーボタン・モデル読込を確認。14画像保存。初回保存がない場合のロック確認は、検証側が新規進行の確認ダイアログを閉じず時間切れ。コードで原因を特定し、検証に確認操作を追加した。本体修正は不要。

ロック部分を単独で再実行し、全6エントリで未遭遇表示を維持、11配信ファイルSHA256一致を確認（`local.json`）。全形態の表示部分は成功済みの14画像を証拠とし、この再実行では重複しない。

## 公開

既存Workerへの公開成功。Version `0db7a5b5-f593-4f8c-afe6-6bf4b6f1d96f`、更新6ファイル。公開先 https://swarm-front.melosalife-24.workers.dev/?playtest=1 。

公開版も全7形態×2寸法の型名・収まり・本文・ムービー・モデル読込、全6エントリの未遭遇ロック、11ファイルSHA256一致、`/api/health` ok成功。ブラウザ例外なし。`published.json` と公開14画像を保存。

証拠は `dist-validation/enemy-types/`。`changes.patch` に今回差分、`bestiary.before.ts` / `structure.before.md` に変更前を保存。再現は `scripts/check-enemy-types.mjs`。実スマホの実機確認は未実施。
