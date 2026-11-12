# 旧サーバーの融合後の外観：元装備の観測範囲

2026-11-12。旧基点 `d7d1399` と現行クライアントのコード、および既存の検査記録を読み取りで照合した。製品コードは変更していない。

- 出撃前のロビーでは、旧 Worker は各参加者の `members[].weapons` に元の武器 ID・レア度・形式を含める。出撃時には保存済みの装備が `createFrontRun` に渡され、融合後の投影も武器 ID を保持する。このため、各プレイヤーの出撃直前の装備を確実に観測し、出撃と対応付けて保持できた場合に限り、元の表示等級を使える可能性がある。最終装備の観測と開始の順序を含む実通信での保証は確認していない。
- 進行中の新規参加は旧 Worker が拒否する。一方、既存参加者の再接続は可能で、戦闘中の `members` には武器が含まれない。既に融合後の投影しか受け取れない場合は、元の `format` を取得できない。新形式 N と旧形式 R が同一の投影になる反例があり、投影だけでは区別できない。
- 現行の `EquipmentCache` は接続ごとに作り直され、受け取った通信装備の省略復元に使うもので、元装備の履歴ではない。現行クライアントは `members` を受信状態で上書きする。ページ再読込後の復帰用セッションにも元装備は保存されない。現在の自分の保存装備を読み直せても、それが出撃時の装備と同一とは限らず、他人の元装備の証明にはならない。
- 武器 ID の重複検査は各保存内および1人の装備2件にあるが、プレイヤー・保存・出撃をまたぐ一意性は保証されない。ロビー履歴の利用を検討する場合も、接続先・ルーム・出撃・プレイヤー・武器・準備状態の対応が必要であり、再接続後に元情報を観測できないケースを解決しない。

したがって、旧サーバー由来の N〜SSR の外観ずれは未解決のままとする。基点の旧融合コードは Node 内で検査済みだが、旧 Worker と新クライアント間の実通信・実ブラウザーは未確認。既存の実ローカル通信検査は新 Worker を対象とする。

参照：旧 `server/worker.ts` の `equip`・`broadcast`・出撃処理、`src/client/front-network.ts`、`src/shared/state-wire.ts`、`src/client/front-app.ts`、`src/client/progression-save.ts`、`src/shared/progression.ts`、`docs/evidence/weapon-models-20261111/front-tier-projection.md`、`docs/evidence/weapon-models-20261111/fusion-old-server-fallback.md`、`docs/evidence/weapon-models-20261111/fusion-tier-live-network.json`。
