# 生存戦の状態送信上限：フェーズ1（2026-10-27）

## 対象と方式

基点はmain `7c33c877ff87e4ca18043d902c14bb316d7e3067`。生存戦の96体・オーブ密集で64KiBを超える問題への対処。権威World、敵数・判定・報酬、クライアント受信上限は変更しない。

受信者ごとにJSON全体のUTF-8バイト数を判定し、上限超過なら古い演出、遠い経験値オーブ、遠い敵の順に削る。弾・戦況・装備等は削らない。省略したIDを送信し、新クライアントは直前に見た個体だけ保持する。実際にサーバーから消えればIDも省略一覧から消え、次の受信で表示から外れる。保持中は最後に受信した位置・状態で止まり、初回から省略されて一度も受信していない個体は表示できない。run切替と接続ごとに保持を初期化する。

新クライアントは `stateOmissions: 1` をhelloで通知し、サーバーはWebSocketのattachmentにも能力を保持する。旧クライアントは従来どおり演出だけ省略し、必要情報だけで収まらない時は最終手段の4009切断が残る。旧版ルーム（frontなし）は従来の上限処理を維持。弾など削減対象外だけで上限を超えた場合も4009は残る。既存装備キャッシュの初回・再接続条件は維持。

武器とその入れ子の能力値は従来通り丸めない。その他の送信小数は2桁に丸め、整数は維持する。例外として本人が承認した、旧画面に送るBASTIONの確定斉射角だけは従来精度を維持する。サーバーの期限は変えず、生存戦の送信する帰還時刻と復帰期限だけ同じ10ms精度で整合させる。

## 敵の送信項目

`src/client/` の描画・HUD・ミニマップ・音・警告と、そこから呼ぶ共通関数を検索して決定。送信するのは `id, kind, x, y, z, hp, maxHp, cool, wind, tx, ty, tz, hurt, size, active, heading, targetId, wallYaw, perch, jump, lunge, phase, fabrication, fractured, partHp, pulseAim, acidAt, harrow, harrowAirborne, calyx, bastion, pleat, segments`。`targetId` と `wallYaw` は `render.ts` が向きと壁上姿勢に使うため残す。HARROWは種類・開始・向き・発着点・羽ばたき種・移動進捗、CALYXは攻撃状態、BASTIONは装甲・攻撃段階・その時刻・確定斉射と照準を残す。PLEATは従来通り解決済み身体・姿勢・足接地点を送り、FOUNDRYの節は位置・部位HP・向き・レーザー予告時刻と目標を残す。

**送らない敵項目と理由:** `harrowSwitchAt, harrowAirDamage, pollenReadyAt, defenseAggroUntil, foundryTriggered, foundrySource, navigation, lungeWait, steerUntil, steerAngle, wallCooldown, jumpFrom, jumpWait, flightUntil, flightHeight` は権威側の制御・再出現・移動計画・待ち時間で、上記クライアントの表示/音は直接参照しない。頭と節の `route, trail, trailOwner, trailOffset, groundPath, groundGoal, groundRepathAt, groundChasing` はFOUNDRYの経路履歴で、表示に必要な解決済み位置・向きは別に送る。HARROWの `fired, hitIds` は権威側の発射済み・命中済み管理。BASTIONの `hitAt, gainAt, tickAt, tickReduction, tickChained, readyAt, counters, streak, streakAt, streakTick, shot, guard, aimReadyAt` は権威側の耐性・内部タイマーで、描画に必要な装甲・予告は維持する。PLEATの `anchor, normal, velocity, travel, transfer, settling, switches` や足の制御目標・内部時間は従来から送っていない。これらをWorldから削除する処理ではない。

独立監査では `636dcd48780fb25b20d74b79967e4edc85c8f4e6` を「要修正」と判定。BASTIONの斉射向きの丸めで、赤い予告の外でも被弾するP2と、FOUNDRYの正の部位HPが0に丸められ予告が消えるP2を再現した。監査先: https://chatgpt.com/c/6adfcc01-02f8-83e8-bfb9-c4c7d95f0d56 。監査側の独立実行範囲と未確認は同回答を参照。

正の `hp` / `partHp` が0になる場合は送信値を0.01とし、生存・部位破壊の判定を保つ。BASTIONの `turn` は新画面には通常の2桁値に加えて浮動小数点のビット列を整数2個で送り、受信時に正確な方向を復元する。本人が2026-10-27に旧画面だけの精度例外を承認したため、能力通知のない旧画面には確定斉射の `turn` だけ従来精度で送る。新旧の送信文字列キャッシュは分離する。いずれも権威Worldや弾道は変えない。再現テストは新旧画面の送信順・装備キャッシュ・生存と旧版ルーム・壁際のレーン・部位の連結状態を検査した。修正後の独立再監査は未実施。

修正後、client/worker型・client build・production設定のWorker dry-runが成功。関連単体はファイル別に120件成功。隔離Workerの改装版12件は新旧画面混在の実WebSocketを含め成功、旧版13件も通し直して成功した。固定合成条件のサイズは65,160バイトのまま。Windows上のVitest一括実行2回はSSR一時ファイルENOENTで失敗し、ファイル別に切り替えた。以前の旧版実通信1回は作業中のソース編集でWorkerが再読込され、13件中1件が応答待ちで失敗した。今回の旧版全体の最初の実行も13件中1件が負荷fixtureの応答待ちで失敗し、同じ試験の単独再実行と、受付履歴を分けた新Workerでの13件通し直しは成功した。後者の最初の失敗原因は未確定。基点にも蘇生直後の放置判定はあるが、今回の失敗との因果関係は確認していない。

## 固定条件のサイズ

`scripts/state-wire-fixture.ts`、seed 4520、プレイヤー4人、種類混在96体（うちPLEAT 48体、合成FOUNDRY節あり）、オーブ160、弾180、演出120、未キャッシュ装備、受信者1人。旧版 `7c33c877ff87e4ca18043d902c14bb316d7e3067` と同じfixtureを `scripts/measure-state-wire.test.ts` で比較。固定の合成負荷であり、実戦の発生頻度やスマホFPSではない。

| 条件 | UTF-8バイト |
| --- | ---: |
| 変更前・全演出入り | 133,705 |
| 変更前・演出を削った後 | 116,534 |
| フェーズ1・最終送信 | 65,160 |

フェーズ1では演出120、オーブ160、敵32を省略し、弾180は保持した。ローカルで4人分を準備する同条件の参考計測は、再JSON化の見直し前中央値34.27ms、見直し後14.20ms（各10試行、最大37.08/23.08ms）。別実行では中央値15.79ms。実機・Worker本番の処理時間や描画FPSの比較ではない。

## 検証と未確認

client/worker型とbuild成功。関連単体7ファイル117件成功（混雑・順序・保持・最終手段・種類別状態、PLEAT、HARROW、CALYX、BASTION、既存送信など）。実Workerの指定テストは改装版 `tests/front-network.integration.ts` 11件、旧版 `tests/network.test.ts` 13件成功。改装版では実WebSocket4接続へ96体・オーブ160・弾180の合成状態を送り、いずれも上限内かつ未切断で権威Worldの全個体を保持することを確認。本人の実セーブ・本番サーバーは使用しない。

初回の改装版全体テストは帰還時刻の丸めにより期限が2msずれて1件失敗し、送信する時刻の整合を修正後に11件成功。途中で開発Workerの再読込もあり、初回を成功扱いしない。旧版全体の初回は3件失敗: 現行ゲームが各人3個の報酬を送る一方で古いテストが合計4個と期待していた1件、同じ接続元の受付制限429が2件。基点の `finish` と既存 `front-campaign-weapon-cap.test.ts` を照合し、テストを各人3個・合計6個のIDすべて一意と厳密化。受付制限を解除せず、既存の試験専用Workerが持つテストケース別接続元を使って再実行し13件成功。通常Workerと試験用Workerは区別する。

実Rendererのローカル合成画面で、[省略前](evidence/state-wire-limit-20261027/visual-before.png)、[省略中](evidence/state-wire-limit-20261027/visual-omitted.png)、[サーバーからの消滅後](evidence/state-wire-limit-20261027/visual-removed.png)を目視し、画面エラー0。`scripts/state-wire-visual.html` で再現できる。敵1体の表示と内部オーブ数を確認したもので、オーブ自体の描画、実戦の移動、実スマホは未確認。

実スマホ・実インターネット多人数・長時間の実戦は未確認。機能追加・描画負荷改善・オーブ差分送信・敵の低頻度化は未実装。

フェーズ2案（未着手）: 敵の種類/maxHp/size等の不変値を初回のみ配信、オーブの追加・削除差分、遠方敵の低頻度送信、`render.ts` のVector3再利用と種類分類の1回化、爆炎のスマホ向け大きさ・同時数上限。復帰・欠落・世代交代の整合と視認性を設計してから別途判断する。
