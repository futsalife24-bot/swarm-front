# 協力部屋IDを数字3桁に変更（2026-11-07）

## 依頼と範囲

本人の「スワフロ：協力プレイの部屋IDは今は数字3桁でいいよ。」に対応。
base: ac14198177bd3184ba7843c64da07155f346d1de。
専用 worktree: task-room-id-three-digits、branch: codex/room-id-three-digits-20261107。
他worktreeのバディ/ロビー改善や既存dirty差分には触れていない。

- 新しい部屋は 000〜999。文字列で保持して先頭ゼロを失わない。
- Gateの既存直列化内で採番し、有効な全モード・公開/招待部屋のIDを予約する。空き探索は最大1000回。枠が埋まった場合は503で既存部屋も作成枠も変更しない。
- 期限切れだけ再利用。32桁内部コード、既存接続制限/人間確認/人数上限は維持。directoryとgateを同じstorage.putで保存。
- 旧8文字ID、旧32桁招待、同じ設置先の招待URLの受付を維持。古いクライアント自体の3桁対応を保証するものではないため、公開後は新しいページへ再読込が必要。
- コピー・入室・一覧・生存招待の初期表示を3桁対応にし、案内を「部屋ID」「IDで招待」へ変更。レイアウトは無変更。3桁は短い合流用IDであり、強いアクセス認証とはしない。

## 検証

- クライアントとWorkerの型チェック成功。
- room-directory / room-invite / front-room-access-network / front-network-input / front-network-opening の5ファイル53単体テスト成功。
- 実ローカルWorker/実WebSocketの8条件成功。全1000枠満杯、007期限切れ再利用、旧ID解決、6同時作成の非重複、進撃/生存それぞれ4人welcomeと5人目拒否、満員一覧除外、不正IDを確認。network.jsonに実結果。
- 進撃844×390の隔離Chromeで通常UIから部屋作成、表示された459をコピー、別プロフィールで不正ID拒否→459参加、2人同一ロビー、横はみ出しなしを確認。campaign-844.pngを目視確認。準備読込み中のロビーであり、実戦通し攻略ではない。
- 生存640×360は作成POST200、実WS接続、706解決まで進んだが、PC応答遅延のため試験を中断。完了扱いにしていない。両モードの実WS人数確認は上記で別途成功している。
- 初回UI試験のVite起動待ち切れと、再試験時の新規プレイヤー名ダイアログ未処理は検証器の不足。隔離プロフィール名を設定した次の試験で進撃成功。
- Vite production build成功。既存chunkサイズ警告あり。manifestは最終41,063 bytesを生成。Worker dry-runは実行中。
- 生存UI、実スマホ/PWA/実回線、ロビー改善との統合後再検証、公開確認は未完。

## 再実行

既存依存を使用。Wranglerはこのworktreeの wrangler.room-id-test.jsonc、8811、専用 .wrangler/room-id-test に限定。既存のローカル試験用 .dev.vars は --env-file で直接参照し、新規資格情報の保存/作成はしない。スクリプトは SWARM_TEST_VARS_PATH で同じ既存ファイルを指定できる。内容は出力しない。

node scripts/check-three-digit-rooms.mjs はローカル検証Gateのfixtureだけを変更する。公開Workerはfixture入口をimportしない。
node scripts/check-three-digit-rooms-ui.mjs は Vite5202 と Worker8811、隔離Chromeと合成プロフィールだけを使う。

## 統合

バディ担当はserver/worker.tsの戦闘部分、ロビー担当はfront-app.tsの遷移/カード編集を変更中。今回のGate採番/IDコピー表示差分を残して統合する。共有STATE/mainの書込みと公開は一人に調整し、必要な現行許可と保護/CIを確認する。今回はまだ公開していない。
