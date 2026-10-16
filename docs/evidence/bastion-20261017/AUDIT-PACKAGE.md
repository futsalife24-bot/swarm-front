# BASTION（仮称）独立監査用の資料

通常Chatでの独立監査に渡すための資料。**送信はしていない**（本人依頼の範囲はローカル候補まで）。添付する場合は、下記のZIPを本人の確認後に送る。

## 監査対象

- リポジトリ: https://github.com/futsalife24-bot/swarm-front （ブランチは未push。ローカルのみ）
- branch: `codex/bastion-hardening-20261016`
- base: `da41b38774b22a8aac4ce7ec8d2bcd18de6fb008`（開始時の origin/main）
- 実装 commit: `4a75d3a0dc175e8aa687dd7477b204c76916e00b`
- 添付ZIP（ローカル）: `dist-validation/bastion/audit/bastion-audit-4a75d3a.zip`。中身は base..実装 の差分パッチ、変更後の全ソース（変更・追加ファイル）、GLB、master/ゲーム版 .blend、生成器、証拠フォルダ一式。SHA-256 は ZIP と同じ場所の `bastion-audit-4a75d3a.sha256.txt`。

## 依頼文（そのまま使える形）

新敵 BASTION（仮称）のローカル候補を独立に監査してください。合格／要修正、必須指摘（P0/P1/P2）の箇所・再現条件、任意指摘、監査側で実行できなかった検証の範囲を示してください。仕様と仮値は `docs/BASTION.md`、比較と動画は `docs/evidence/bastion-20261017/review.html`。

重点的に見てほしい点:

1. `src/shared/bastion.ts` の `bastionDamage`: 同じtickの被弾（散弾・貫通・爆風・前線の副次効果・協力の同時射撃）が1回の被弾になり、加算が0.1秒に1回を超えないか。最初の被弾が起点だけになるか。0ダメージの扱い。
2. 反撃: 予備動作→赤予告→発射の時刻、赤予告の開始で弾数・向き・原点が確定し実弾と一致するか（`bastionLanes` の共有）、死亡・再生成・ポーズでの発射や持ち越しがないか、開放と再反撃の制限。
3. `hurtEnemy` への接続（`src/shared/game.ts`）が既存の全ダメージ経路で1回だけ通るか、他の敵種に影響しないか。被弾イベントの `guard`。
4. 協力同期: 状態が `Enemy.bastion` に入り既存の配信で届くこと、丸めの影響（`turn`）、`server/testing.ts` のフィクスチャと `scripts/check-bastion-network.mjs` の妥当性。
5. 描画 `src/client/bastion-view.ts`: 権威状態を書き換えないこと、個体ごとの材質複製と破棄（メモリ）、予告帯・火花の上限、`render.ts` への組込み（読込前の代替表示、作戦切替時の破棄、弾の表示枠160）。
6. レポート対象外の扱い（`REPORTLESS_ENEMIES`）で、遭遇記録・声・会敵演出・開発者モードに仮の素材が出ないこと。
7. 造形: コンセプトとの差（`review.html` の表）、実ゲーム視点での状態の読み取りやすさ、GLBの負荷（17,636三角形、1体約30描画呼び出し）。
8. 仮値のバランス（`docs/BASTION.md` の撃破時間表）と、試作案への判断・代案の妥当性。

## 実装担当が実行した検証（自己検証。独立監査ではない）

- `npm run typecheck`（クライアント・Worker）成功。
- `npx vitest run`: 1118件中1112件合格。失敗6件（照準・BGM復帰2・RAY・地底マップ・描画）は base でも同じく失敗する既存の不具合。`vitest.front.config.ts` 192件合格。`tests/bastion.test.ts` 19件合格。
- `npm run build`、`npm run server:build`（dry-run）成功。
- 実ローカルWorker（`wrangler.test.jsonc`）2クライアント: 硬化100からの 予備動作0.8秒→赤予告0.8秒→12発→開放、両者の同一tickで敵・弾が一致。硬化0から2人の実射撃入力で1.3秒に75以上→2.9秒に12発、共有被弾イベント44件で段階ごとのダメージ 24/19/14/10。結果 `network.json`。
- 実 Renderer（ヘッドレス Chrome、SwiftShader）: 5状態×2距離×2寸法の静止画、固定30fpsの動画10本（全フレームのデコード数を照合）。`capture-log.json`。
- Node の実 `step()` による撃破時間シミュレーション（`docs/BASTION.md`）。

## 監査側で再現する手順

```
npm ci
npm run typecheck
npx vitest run tests/bastion.test.ts
npx wrangler dev --local --config wrangler.test.jsonc --ip 127.0.0.1 --port 8797   # 別端末。.dev.vars に ROOM_CREATION_KEY="<64桁の16進>" を用意
node scripts/check-bastion-network.mjs
npx vite --host 127.0.0.1 --port 5196 --strictPort                                  # 別端末
# ブラウザで http://127.0.0.1:5196/scripts/bastion-preview.html （ボタンで各シナリオ）
```

## 未確認・限界

- Android/iPhone 実機、Safari/Firefox、GPU実機でのフレームレートと負荷は未測定。
- 本人の見た目・数値の承認は未取得。自然出現・レポート・声・会敵動画は未制作。
- 独立レビューは別セッション（Claude Code の別セッション）へ依頼。結果は `independent-review.md`（届いた場合）。これは通常Chatでの独立監査の代わりではない。
