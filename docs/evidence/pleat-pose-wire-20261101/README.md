# PLEATの能力交渉付き姿勢通信（2026-11-01）

本人の引継ぎ依頼に基づく通信側の実装。PR #245 https://github.com/futsalife24-bot/swarm-front/pull/245 は未merge・未公開で、HEADが引継ぎと一致することを確認した。

- 基点: `51bda91e91829a912e661f8809a8b2070a0e2aac`（PR #245）。その基点mainは `3035376932bbf3e0734e181b7040827bf033b80d`。
- 実装commit: `1dcd5c95455635829f94fe623dc12b61592cf184`、[Draft PR #246](https://github.com/futsalife24-bot/swarm-front/pull/246)（baseはPR #245のbranch、merge禁止のまま）。
- branch: `codex/pleat-pose-wire-20261101`
- worktree: `C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a/task-pleat-wire`
- リポジトリ: https://github.com/futsalife24-bot/swarm-front
- 今回は実装・検証・担当branchのcommit/push・引継ぎまで。本人の承認前にmerge・公開しない。root、dist-h、Claudeのworktreeを編集しない。

## 実装

1. 両クライアントのhelloに `pleatPose:1`。Workerは厳密に数値1の時だけ有効とし、welcomeで応答する。socket attachmentにも保持する。無指定・未知の版は旧形式。
2. 能力対応の受信者には、state直下の `pleatPose:1` マーカーと、crawlerの `pleat:[ux,uy,uz,fx,fy,fz]` を送る。既存の小数2桁処理を使用。JSON/tuplesの両方で同じ6数値、tuples-v1の他の配列配置は維持。
3. 旧受信者にはPR #245と同じ互換feet付き形式。旧版encoder/decoderを基点Gitから読んで、旧形式のbyte一致と復元を検証する。新端末だけの場合は互換feetの生成自体を行わない。送信キャッシュは能力・JSON/tuple・既存互換モードで区別する。
4. 端末は差分復元の後、tuple展開と同時に姿勢を復元する。bodyは `(x,y+0.8*enemySize(e),z)`、scaleはenemySize(e)、forwardはposeForwardの互換別名。feetは生成しない。差分基準には圧縮表現を保持し、描画側の変更が基準へ混入しない。破損した6数値やマーカーを拒否し、途中まで展開した敵配列を残さない。
5. state-delta・ACK・分割・復旧の実装、速度・HP・攻撃・敵数、PLEAT移動/描画/保存の計算は変更していない。ボスを含む他種の通信内容は維持。

## 同条件byte比較

都市stage 1、seed 11、PLEAT96体、同一のサーバー戦況を全方式に使用。20Hzで400tick/20秒、射撃なしの円移動。2tickに1回、合計200状態。既存の40体上限はfixture生成の間だけ96体として元へ戻す（製品設定変更なし）。装備は毎状態全量。UTF-8・圧縮前のアプリデータでありWebSocket/TCP/TLSの全通信量ではない。

| 方式 | 旧受信者 | 新受信者 | 削減 |
| --- | ---: | ---: | ---: |
| 通常JSON・全量200状態の合計 | 13,763,772B | 4,641,040B | 66.28% |
| tuple・全量200状態の合計 | 5,782,357B | 2,419,625B | 58.16% |
| 通常JSON・分割の包み込み | 16,790,424B | 4,641,040B | 72.36% |
| tuple・差分と分割の包み込み | 4,577,098B | 1,189,646B | 74.01% |

最後の状態だけの全量は、JSON 71,216→25,563B、tuple 31,172→14,319B。差分の比較は受信ごとに即ACKする制御条件。実回線のACK間隔・圧縮・欠落・敵構成で結果が変わる。JSONは現行の交渉仕様どおり差分なし。送信数は同じ200で、更新頻度を減らした結果ではない。

復元bodyと権威側bodyの3次元距離の最大は0.00703m。座標を各軸2桁へ丸めるため、各軸の誤差と3次元距離は区別する。戦闘判定にはこの復元値を使用しない。

再現: `PLEAT_WIRE_MEASURE=1` を環境変数で設定し `npx vitest run tests/pleat-pose-wire.test.ts`。[計測JSON](measurements.json)。旧版の読込には基点Gitの履歴が必要。実機・実回線の効果や745msの根因は未確認。

## 検証

- 関連単体135件/8ファイル成功。旧版encoder/decoderとの旧形式一致、能力別キャッシュ、JSON/tuple、新旧serverから両clientへの復元、床/壁/天井・個体サイズ、差分・2状態未ACK・周期全量・分割・再接続、破損拒否、権威World非変更を確認。
- 最初の実通信試行でwelcomeの能力応答まで戦況マーカー検証が弾く不具合を検出し、試験を中断。stateだけで版を検証するよう修正し、welcomeの回帰試験を追加した。中断した実通信・画面試行を合格とは扱わない。
- 実Worker統合21件成功。新旧JSON・新旧tupleの4人混在、未知の能力版2への旧形式fallback、96敵/400弾/160オーブの復元、差分・分割、ACK詰まりからの復帰、同一隊員の再接続で最初の全量受信を確認。
- 最終版のclient/Worker型、production build、production設定のWorker dry-run成功。変更コードのPrettier・diff空白チェック成功。Worker公開はしていない。全件の無関係テストは再実行していない。
- 画面試験の途中で遷移待ち不足と、4人専用の密集fixtureを1人画面へ適用した409があった。製品UIやfixture条件は緩めず、遷移終了待ちを追加し、画面は既存の生存包囲出現fixtureで確認した。96体の通信検証と画面検証の対象を分ける。

- 実画面は24体（PLEAT20体）。能力hello/welcome・新姿勢復元後の描画87回・画面例外0を確認。844×390/640×390の画像を目視確認し、PLEATとHUDの表示を確認。[実画面結果](ui.json)、[844](ui-844.png)、[640](ui-640.png)。FPS/往復3msの表示はローカルPCの値であり実機改善の証明ではない。
- 画面の再現: `npx wrangler dev --config wrangler.test.jsonc --local --ip 127.0.0.1 --port 8795 --inspector-port 9241 --persist-to dist-validation/worker-state --var ALLOWED_ORIGINS:http://127.0.0.1:5187` と `npm run dev -- --port 5187` を起動し `node scripts/check-pleat-pose-local.mjs`。認証値は既存の.gitignore対象`.dev.vars`を使用し、出力・登録しない。
- 統合の再現: `SWARM_TEST_SERVER_URL=http://127.0.0.1:8795` を環境変数で設定し `npx vitest run --config vitest.front-integration.config.ts`。

## 変更ファイル

- `server/worker.ts`: 能力交渉・保持・受信者別の送信指定。
- `src/client/network.ts` / `front-network.ts`: 能力表明。
- `src/shared/state-wire.ts`: 6数値の送信・能力別キャッシュ・互換足生成の遅延化。
- `src/shared/state-tuples.ts` / `pleat-pose-wire.ts`: 版と数値の検証、JSON/tupleから描画用姿勢を復元。
- `tests/pleat-pose-wire.test.ts` / `state-tuples.test.ts` / `front-network.integration.ts`: 基点互換・同条件計測・両client・実通信混在。
- `scripts/check-pleat-pose-local.mjs`: 実画面の再現検証。
- `docs/STATE.md` とこの証拠ディレクトリ: 状態・検証・制約。

## 引継ぎ元の制約

PR #245の薄板大型個体の一時的侵入、縁での攻撃不可時間の差、旧端末の簡易歩行はそのまま。通信改修の確認を、これらの解決や難易度の一致の証明にしない。旧端末の利用割合は未取得であり互換feetを廃止しない。実スマホ・実回線多人数・長時間・本番再起動/hibernationの動的確認・旧端末実画面は未確認。今回の変更に独立監査は追加していない。主担当モデルID/推論設定は未確認、子なし。
