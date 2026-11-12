# 補給演出・単発確認の公開記録

[PR #323](https://github.com/futsalife24-bot/swarm-front/pull/323) と [PR #324](https://github.com/futsalife24-bot/swarm-front/pull/324) を通常merge。公開ソース `9c587395e98d932cb870df34d285bbe045291f4e` で本番buildと既存Workerのdry-run成功後、既存Worker Version `73ec3f1e-3bd0-4b4a-8a0f-c5f67507722a` に公開した。

公開先で更新演出・クエリ付きCSS・本体JS/CSS・HTML・SW・manifestを含む36ファイルがHTTP 200かつ公開buildとSHA一致し、healthはHTTP 200・ok=true。[配信照合](published.json)、[照合コード](published-check.mjs)、[ローカル検証](README.md)。

実スマホ・聴感・公開Workerでの認証済み抽選や実X接続は未確認。
