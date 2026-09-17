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

## 独立監査合格

対象 `6e5cec8ff6113c2b770d7c38fdbcb9cbdef4cc18` は同じ監査Chatの再々監査で **合格・必須残件なし**。GitHub HEAD/base/mergeableと添付のserverソースblob一致を確認。実HEADのTypeScript関数を直接実行し、削除再作成後の重複受取拒否、2/3進捗、防衛進捗、pending重複除去、claimed保持、週またぎ/未来/不正配列を独立確認。前回までの報酬上書き保護も維持。

監査側の正式typecheck/Vitestは依存実体不足（vite/client未解決）により完走せず、実関数による状態遷移検証が独立根拠。途中の「依存準備できた」という進捗を最終成功とは扱わない。任意指摘: 日付形式の正規表現は実在日付/月曜までは検証せず、改ざんされた過去形式値を破棄する。正常runtimeは生成しないためmerge阻止なし。前回の実スマホ/ブラウザ終了復帰/自動復旧の限界も維持。

## main反映・公開結果

- PR32を通常merge（管理者バイパスなし）。監査後の203d48dはSTATE/本記録のみ。merge/source SHA `fb042aad596f46ba9f6b2e41faa1b6a3c9250904`。
- merge後mainから `npm run build` / `npm run server:build:production` 成功。日本語Player-Noteをmerge本文へ保存し更新履歴へ反映。
- 初回deployは自動承認レビューが公開の明示承認を確認できず拒否。既存AGENTS/WORKFLOWのユーザー継続承認、公開設定差分ゼロ、監査合格/clean/dry-runを確認して同一コマンドの再審査が許可された。別経路や回避なし。
- `npx wrangler deploy --config wrangler.production.jsonc` 成功。既存 `swarm-front`、Version `425d572b-0e4c-4b75-afb0-9a62e8300244`、追加/変更16静的ファイル。新規binding/移行/課金なし。
- [公開ゲーム](https://swarm-front.melosalife-24.workers.dev/)。index/全JS・CSS/武器庫GLB/6防衛GLBの計19ファイルをHTTP200かつSHA-256一致で照合。`/api/health` HTTP200・ok:true。[配信照合](evidence/player-continuity/published-assets.json)。
- 公開iabでホーム、日替わり入口→クラウド必須案内、設定の週間入口、クラウド引き継ぎ説明/有効化入口を確認。errorログ0。本番のクラウド新規登録や日替わり参加権消費は行わず、それらの動作検証は実ローカルWorkerで実施済み。

依頼範囲の実装・独立監査・main反映・公開・配信確認は完了。前記の任意課題/実機未確認と、対象baseに既存のダッシュボード監査不足は未解消のまま区別する。後続は公開記録のみ。
