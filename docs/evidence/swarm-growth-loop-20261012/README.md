# 成長循環候補の検証（2026-10-12）

基点 `35125e556c85a249a024cd4c033c39ce249b8d67`、ブランチ `codex/swarm-growth-loop-20261012`。実装は [候補仕様](../../SWARM-GROWTH-REDESIGN.md)。本番セーブと既存公開版を変更していない。

正式画像統合後の実装対象は `a7de399057040af1670031928f84ad0cea7d9720`、[Draft PR175](https://github.com/futsalife24-bot/swarm-front/pull/175)。通常Chat独立監査は親側から依頼・回答取得済み。補足訂正の最終判定は合格（確認範囲限定）・必須P0/P1/P2各0件であり、独立test/build/dry-run/E2E再実行はない。[監査全文](PR175-a7de399-independent-audit-full.txt)と[公開条件・追跡台帳](../../SWARM-GROWTH-AUDIT-FOLLOWUP.md)。本人の公開承認ではなく、merge・公開しない。以下の未依頼/旧実装の記録は当時の経過。

## 合格した確認

- client / Worker型検査。
- `npm run build` と `npm run server:build` 成功。Workerはdry-runだけ。初回のsandboxログ書込警告は、ログ先を作業領域に指定して再確認し解消。クライアントの既存大容量chunk警告は残る。
- 生存・成長・旧セーブ・再受取・不正データ・工房など関連139件。
- 保存回帰147件。旧所持品・旧pending >3・回復ドロップ・勝利後手動回収を保持。
- クラウド保存・共有武器庫・保存fixtures・成長循環59件。新規フィールドの検証、成長を消す旧端末の上書き拒否、初回ST1→生存Lv2武器→改造の費用3片、未保存進撃の武装片回復も確認。
- 実ローカルWorker/WebSocket13件。部隊長進度、参加者進度との差、進度0への復帰、恒久武器と改造、死亡時の個人戦果、再接続時の同一結果、不正進度拒否、既存の開幕/融合/60分終了/旧画面復帰。
- 実Chrome UI4件＋武器一覧1件。844×390と667×390のタイトル、反復遷移、進撃/協力生存導線、reduced-motion保存、改造の連打・変換・再読込、演出スキップと取消、全レア度/Lv60/最大改造の性能列重なり・横スクロールなし。

主な画像: [共通タイトル844](title-844.png)、[小さい横画面667](title-667.png)、[工房](workshop-844.png)、[成長値の武器行](gear-growth-844.png)。工房の数値は仮設定のテストセーブ。正式演出素材の完成デザインではない。

## 全体試験と既存失敗

全体実行は952件中948件通過・4 assertion failure、別途1 import suite failure。最終の初回費用調整後は関連139件・クラウド59件・ブラウザを再確認した。件数を足し合わせて全件合格とはしない。

変更前の独立 `baseline` worktree（同じ35125e5）で失敗5件を再現:

1. `aim.test.ts`: ロケットのカメラ位置期待値 1.25 と実1.875。
2. `render.test.ts`: 弾描画の期待位置 -7.5 と実-6。
3. `maps.test.ts`: 晶脈の地底巣の通路/敵侵入点判定。
4. `enemy-report-motion.test.ts`: HARROW空中発射位置の期待値。
5. `weapon-stat-marks.test.ts`: `weapon-help.ts` の document未定義によるimport失敗。

途中の「document未定義が新規問題」という推測は誤りだった。変更前の再実行で既存と確定し、今回その失敗を無断で修正・除外していない。

`npm ci` は依存High5件を検出。依存更新・脆弱性解消は実施していない。

Windows sandboxでVitestの別プロセスがSSR一時ファイルを読めず、`--pool=threads`で実行。初期ブラウザ/HTTP制限には専用localhostサーバーと権限レビュー付き起動を使用。部屋作成・接続制限は変更せず、test-only Workerでケースごとの試験クライアントを区別した。通信や保存そのものをモックにはしていない。ローカルfixtureの早送りは終了/受取の検証であり、長時間バランスの証明ではない。

## 未完了・再開条件

- 元Library ZIP全体の転送はWindows非対応 (`os.setxattr`) により未完。その後、今回の画像28点と説明/原本資料6点は明示承認済みの専用GitHub素材コミットから受領し、照合後に有効化した。詳細は下の「正式素材の統合確認」。ZIP未取得を、画像バイト未受領とは混同しない。
- 同じ環境の既存Linux経路を再確認した。WSL一覧はexit 1・「Linux用Windowsサブシステムがインストールされていません」。docker/podman/bashはPATHに見つからない。新規インストール・認証・セキュリティ変更はしていない。
- 正式転送結果: `file_00000000307481f5918053f698ec967e`、Library IDは上記、filename `swarm-front-claude-motion-assets-20261012.zip`、24,119,471 bytes、返却version 0、GET transfer、workspace_path null、xattr `user.library-file-version`。公式helperはそのxattr設定で `AttributeError: module 'os' has no attribute 'setxattr'`。最終ファイルはreferences内に存在せず、URLやメタデータを省く取得はしていない。
- 通常Chat独立監査は未実施。当初の指定iabは `cannot locate required Windows platform directory: HRESULT 0x80070003` で失敗。以下のIAB固定記述は当時の経過であり、最新のブラウザ経路承認と確認は末尾に記す。
- 再試行ではcuaカーネルリセット後のgetStateを2回、規定の `cua.createBrowserTab("iab", "https://chatgpt.com/", {visible:false})` を1回実施。getStateはtrusted Nodeの異常終了、直接IABは新kernel PID 68772 / exit 1 / 同じHRESULT。UI状態を取得できず、監査Chat作成・資料送信は未実施。一時的な会話タブの障害としては復旧しなかった。
- 素材受渡しと取込みは完了。IABは画像統合後も再度kernel reset→規定の新規IABを試したが、PID3964/exit1/同じHRESULTで起動できなかった。通常Chatを作成・送信していない。現在残る実行上の阻害はIABランタイム初期化。復旧後に対象SHAのZIPを同じ経路で監査する。他セッションのアプリを再起動しない。WSL等の導入や監査経路の置換は行わない。
- 実スマホ・長時間GPU・25任務を通じた収集/素材費用の調整・実クラウドの複数端末UI・正式デザインの美術的採用は未確認。
- merge・公開・破壊的移行は未実施。本人の候補/仮数値/美術レビュー、既存失敗/Highの受入方針、独立監査を満たしてから通常手順で再開する。

生ログは作業場所の `dist-validation/growth-review-front.json`, `growth-review-cloud.json`, `growth-final-transport.json`, `growth-review-unit.json`, `growth-baseline.json`, `growth-baseline-marks.json`。本記録とソース・テスト・画像をレビュー用に保存する。

## 経過: 原本受領前の7イベント仕様確認

- 契約単体5件、ブラウザのライフサイクル5件が成功。後者は合成の小さなPNGを使用し、制作元のAPNG表示確認には数えない。
- 追加後の関連一括144件は全件成功（`dist-validation/growth-front-seven-events.json`）。全体試験の既存失敗5件とは別の対象であり、全体合格へ読み替えない。
- 新イベントで旧タイマー取消、同じ結果keyは1回だけ通知、667pxで20:7・幅収まり、装飾画像の入力透過、スキップの通常メニュー配置、出撃中に追加の操作領域なし、reduced時にAPNGリクエストなし、途中設定変更で旧APNGのsrc解除、画像失敗の代替、取消後の遅いloadの無効化、pagehide、画像未読込でも規定時間終了を確認。
- 共通タイトル/導線/工房/武器行の既存UI5件も再実行で成功。最初の10件実行では途中のソース編集によるVite再読込で1件のbeforeEachが中断したため、編集完了後に演出5件を再実行して全5件成功を確認した。client/Worker型とクライアントbuild成功。最終ソースの正式素材、美術、実スマホ性能、独立監査は未確認。
- 受渡しパスを保つURL生成の契約1件を追加。原本検査スクリプトも準備したが、素材未受領のため原本への実行は未完。比較元のSHAがない場合を「原本ハッシュ照合済み」と扱わない。
- 検査スクリプトは合成28画像で正常系、別SHAの拒否、CRC破損の拒否、最終不透明フレームの拒否を確認。合成画像を制作元の画像検証とは扱わない。

## 正式素材の統合確認

- 親の転送コミット `d4482b1f8008b7796828cc35c938dca3ad26772c` を `6216e624c8d0806402c50c8178a0281e0d2bb889` として取り込み。画像28＋説明/manifest/validation/原本説明/OFLの計34ファイルのみで、転送元と全バイト一致。未コミット14ファイルはstash保護後に内容SHA256一致で復元し、保護stashも保持した。
- 全28画像の転送元SHA256、全14静止PNGのmanifestハッシュ、28パス、RGBA/寸法/CRC、全14 APNGの1回再生・規定時間・最終透明・default imageとPNGの一致を確認。[受領検査](event-banners-received.json)。全14の容量/符号化フレーム数もmanifestと一致。時刻差の最大は0.000001ms未満で、原本は変更していない。
- 追加後の関連一括146件成功（`dist-validation/growth-front-real-assets.json`）、client/Worker型・変更コードの整形・差分検査成功。
- 実ブラウザ27項目を分割して確認。全体実行は26成功＋実ソロの期待画面1件失敗。期待値を既存の一時停止画面へ修正し、その1件のみ再実行で成功。ソースの不具合を黙って除外した結果ではない。ログは `growth-real-browser.json` と `growth-real-solo-pause.json`。
- 正式APNG14点（7イベント×標準/スマホ）の実読込・保持・時間終了、1枚だけの取得、OS reduceでPNGだけの取得、途中OFF切替でAPNG解除、保存データ不変、画面遷移取消、実ソロ出撃から既存Escapeによる即取消と一時停止画面を確認。初期選択ではポインタの一時停止ボタンが従来どおり非表示のため、試験は既存Escapeを使用した。標準/スマホの画像14点と[実ソロ取消後](event-banners/actual-solo-canceled-844.png)を保存。
- 途中の試験配線はNode ESMのJSON読込、模擬時計の過去へのpause、Vite HMRの別モジュール参照、開幕3択と一時停止の期待値を修正した。後者は実際のエントリが読み込んだモジュールURLを使い、ゲーム側の取消を検証する。正式画像のバイトや既存のゲーム仕様を変更して試験を合わせていない。
- 実スマホのメモリー/フレーム時間、長期バランス、美術的採用、独立監査は未確認。自己検証を独立監査とは扱わない。

## 固定した監査候補

対象実装 `a7de399057040af1670031928f84ad0cea7d9720` をPR175へpush確認。同SHAからclient build・通常Worker dry-run・本番設定 `wrangler.production.jsonc` のdry-run成功。後者は344静的ファイルを読取り、実deployはしていない。ビルド後の画像28点も転送元SHAと一致。既存の大容量chunk警告は残る。

作業場所の親ディレクトリに `swarm-growth-audit-a7de399.zip` を保存。472ファイル、41,933,062 bytes、SHA256 `718a92abe73d2d8eaeec6e86271b5c58249d7e299d031b0e9ac2887c5c86ad98`。CRCと全収録SHAを照合し、既存ローカル認証値が収録されないことを確認した。実差分/ソース/依存lock/正式画像/元説明/OFL/UI証拠/自己検証ログを含む。認証・依存キャッシュ・Library signed URL・無関係な個人資料は含まない。未変更の巨大3D/音声は除外しているため、全実戦描画をZIP単独で再実行できるとはしない。独立監査は未送信。

## 通常Chat監査の別ブラウザ経路確認

2026-10-12、本人が正規Chrome等の別ブラウザ経路への変更調査を承認。通常ChatGPTでの独立監査を維持し、Work・サブエージェント・自己レビューを代用にしない。秘密情報取得、アクセス拒否回避、新規認証発行は行わない。

CUA kernel reset後の `getState` はtrusted Nodeの異常終了。次の規定の初回API `cua.createBrowserTab("chrome", "https://chatgpt.com/", {sessionName:"🔎 スワフロ監査"})` もPID30688/exit1、`MXC launcher: cannot locate required Windows platform directory: HRESULT 0x80070003` で停止した。ブラウザのUI状態を得る前の共通基盤障害であり、Chrome拡張の不在や接続権限拒否を確認した結果ではない。通常Chat作成・添付・監査依頼は未実施。他セッションのアプリ再起動・非公式の認証転用・制御経路の自作はしていない。

監査ZIPを正式Library createで保存済み。Library ID `libfile_ec2c665dfd008191a3f20c0f0d654cab`、filename `swarm-growth-audit-a7de399.zip`、初回version 0、file ID `file_00000000a00c8206af7b9e7540c9f8d0`。リモート保存成功とローカル属性付与は別に扱う。返却属性を公式helperで適用するとWindowsの `os.setxattr` 非対応で停止し、ローカルのLibrary版属性は保存できていない。リモート保存の成功は確認済み。

その後、ZIPの監査依頼文だけに本人の別ブラウザ承認と共通基盤障害を反映。収録ソースは対象SHAのまま、同じLibrary IDをexpected version 0で置換しversion 1の保存成功を確認（file ID `file_00000000385c82068c714c1e06264f04`）。現在のサイズ・SHAは上の固定候補欄。全472件のCRCと収録SHAを再照合した。公式helperのローカル属性付与は同じWindows非対応で未完であり、ローカル属性の保存成功とはしない。
