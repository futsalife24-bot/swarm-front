# PR32 監査・公開記録

## 2026-09-17 承認と独立監査

- ユーザーが `continuity-audit-6d1ee2a.zip`（44,159,887 bytes、コード・差分・今回のBlender/GLB・画像証拠）を通常監査Chatへ送ることと、既存公開用Cloudflareアカウントへの再ログインを明示承認。
- [監査Chat](https://chatgpt.com/c/6aab6f75-ef70-83ee-b5dc-4bb6fdeda04d)へ添付・送信済み。base `206f000b857844f2fc4d284a02f4bac75e748ead`、head `6d1ee2a21c8435127dc559210c55a50381219047`。監査中、合格未確認。
- GitHub PR32は同じbase/head、draft/open、mergeable、表示上のstatusCheckRollupは空。保護回避なし。
- 現実装の `npm run server:build:production` 成功。212静的ファイル、既存ROOMS/GATE bindingのみ。dry-runは公開ではない。

## Cloudflare契約・既存使用量

Chrome接続はCDP focusコマンドの応答待ちで失敗。アプリ内ブラウザから通常Googleログインで既存アカウントに復帰。端末へのメール/ログイン方法保存は明示uncheckで値0を確認。課金・契約・権限の変更なし。

- 確認先: `https://dash.cloudflare.com/5fc5ec277dd3010f25a7c1a7b7e585b3/workers/plans`
- 既存アカウント `Melosalife.24@gmail.com's Account`、Workers **Free / Current plan** を画面で確認。
- Workers一覧は `swarm-front` の1件。Requests today **7 / 100,000**。月内Requests 374、CPU397ms（画面表示の集計遅延はあり得る）。
- Durable Objectsは既存SQLiteの `swarm-front_Gate` / `swarm-front_Room` の2件。当日Requests6、Duration0.005GB-sec、SQL storage28.67kB、SQL rows read5 / written2、errors0。
- 旧 `docs/FREE-TIER.md` の「アカウント未確認」は2026-09-06時点の履歴。この確認は将来の負荷や残量の保証ではない。

## 初回監査の必須指摘と修正

6d1ee2aは要修正。独立監査が実ソースで次の2件を再現: (1) 古い端末を選ぶと日替わり/週間の消費・受取記録だけが残り報酬が失われる (2) クラウド開始前のweeklyPendingが初回登録時に処理されず消失。アート/水平地形/素材ロードには必須指摘なし。監査環境ではnpmへの通信不可で全ビルド再実行不能、ソース変換による状態遷移再現・GLB頂点解析・画像/Blenderヘッダ確認を実施したとの報告。

修正: サーバーに `protectedVersion`（日替わり開始・週間受取・日替わり台帳更新時）を記録。クライアントの保存元 `basisVersion` と、明示上書きのCAS `version` を分離。報酬更新をまだ反映していない端末からの保存は409で拒否し、クラウド採用を案内する。繰り返し「端末を保存」を押してもbasisを更新しない。最新報酬を受信後の通常のコイン消費等は許可。これは正常UIでの事故防止で、利用者が資格情報とリクエスト内容を改ざんする不正対策の追加ではない。

初回initializeではweeklyPendingをサーバー日時の空の週間進捗へ適用し、pendingを消去して返す。クライアントはその確認済み実績だけを端末へ反映し、作成通信中の別の進行を上書きしない。

保存応答の喪失後に別端末で報酬が更新された場合も、古いmutationの再送を「新しい報酬まで反映済み」と誤認させないよう409で保護。

検証: 型チェック・playtest54件。日替わり保証/戦利品/敗北精錬粉と週間150コインの巻き戻し拒否、受取後100コイン消費の許可、初回クラウド前3勝の反映と二重加算防止、保存再送と後続報酬の競合。実Chrome2端末+ローカルWorker/SQLiteで同じ保護と繰り返し拒否を確認（APIモックなし）。クラウド作成/キャンセル/復元/週間受取/防衛敗北のUI確認、両ビルド・production dry-runも成功。証拠 `docs/evidence/player-continuity/cloud-client.json`。

任意指摘として、参加POST直後にブラウザ終了した場合の自動復旧、協力接続資格情報の期限とRoom受付期限の区別、実スマホのロード/メモリ/FPS測定は未確認。今回の修正は失われた応答後もクラウドの報酬を上書きさせず、比較から採用できるよう保護するが、自動復旧は追加していない。

## 再監査の週間台帳指摘と修正

`c45c6d4788013eaccbbdd38f1a8a5f4b767dfb74` は前回必須2件の解消を独立確認。ただしクラウド削除→再作成時の週間台帳リセットが新たな必須1件（中）となった。initializeで同じサーバー週のcampaign/defense/claimedを保持しpendingを重複なく追加、過去週だけ失効、未来週/不正形式は400拒否へ修正。実Chrome+ローカルWorkerでも削除→再作成→再受取でコインが増えず、端末/クラウド双方の台帳が一致することを確認。

型チェック・専用playtest設定57件・実通信cloud-client成功。追加単体は受取後再作成、2/3途中進捗と防衛記録の保持、pendingの重複除去、過去/未来/不正週を検証。最初の通常vitest設定では対象が含まれず0件で終了したため、専用設定で実行し直した。監査側のmergeable:false表示はGitHub CLIで再確認し、base206f000不変・MERGEABLE・draft・check一覧空を確認。

## 未完了

独立監査判定、必要なら指摘修正・再監査、PRの通常merge、既存Worker公開と配信SHA照合。自己レビューは独立監査の代替にしていない。
