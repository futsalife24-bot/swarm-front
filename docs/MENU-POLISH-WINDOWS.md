# PR142のWindows再検証・監査記録（2026-10-07）

作業場所: `C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a`。
正本: https://github.com/futsalife24-bot/swarm-front 。[PR142](https://github.com/futsalife24-bot/swarm-front/pull/142)、継続ブランチ `ccr-3d467d84-o5t70k`。
base main `1026fccaa509723c74e1b85bbdde934afe6d82f6`、実装監査対象 `7ef32289a4662afa940c1c7accbfc9f42bb179e6`、開始時HEAD `f240329519f1fde57220f0094455e726bc8c1e2e`。fetchでmainの進行なし・開始時cleanを確認。実装以降の既存差分は文書と証拠だけ。

## Windowsで実行した確認

- Node 24.19.0、npm 11.17.0。`npm ci`成功。旧Vite preview（5431）がrolldownのファイルを使用していたため、モジュールの完全パスとPIDを照合してそのプロセスだけ終了し再実行。npmが報告した既存依存のhigh 5件は更新していない。
- 型チェック、save147件、front73件、progression6件、media-dialog3件、本番build、`npm run server:build`のdry-run成功。front73件は、以前DOMなしimportで実行できなかったfront-feedback7件を含む。既存の大きいbundle警告あり。
- Windows Chrome（既定のchannel chrome、d3d11）の `check-menu-effects.mjs`、`check-menu-effects-network.mjs`、`check-menu-effects-rapid.mjs`成功。通常/reduced、保存失敗/再試行、作成/合成、育成、改装版の一時選択と成功演出0、試聴停止、協力シルエット、reduced途中切替、連続操作/離脱後の演出残り0、pageerror0。
- 実ローカルWorker8789とdev5186で、2人のready初回2回・再準備で1回追加、週間150コイン受取と成功演出1回・終了を確認。実APIを使用し、成功応答は捏造していない。認証値は証拠に含めない。
- 844/640の通常/reducedを実通信でも確認。reducedのready演出0、週間成功処理1回・実行中演出/残存DOM0。MutationObserverが同期除去済みノードの追加も通知することを検証側で区別。既存ローカル保存先はクラウド作成日次上限429に達したためその状態を保持し、未実行の640幅2ケースは独立した新規ローカル保存先`dist-validation/pr142-worker-matrix`で実行。制限値・Worker実装・本番の状態は変更しない。
- 武器行確認の初回は1280通常の高さが30.0000076pxになり、`row===30`で失敗。mainをgit archiveで隔離した5348でも30.0000305pxで同じ失敗。入場中のtransformが測定に含まれた。確認スクリプトへ実アニメーションの自然終了待ちを追加し、判定閾値・レイアウトは変更しない。
- 再実行はPR142・mainとも4サイズ×通常/整理の8表示と操作が成功。表示件数1280:11、915:6、844:6、640:5。844以上の横スクロール0、640は既存どおり補助スクロールと名前/ロック固定、見出し同期。cellOverlapなし。

ログとJSON: [Windows証拠](evidence/menu-polish-windows-20261007)。前回のLinux既知失敗は[元の記録](MENU-POLISH.md)を参照。無関係な全件単体を再実行して全合格と主張してはいない。

## 実時間の演出確認

`scripts/check-menu-polish-motion.mjs`でChromeの実描画動画とrequestAnimationFrameサンプルを取得。Web Animationsのpause/seekや時刻の固定は行っていない。844×390・640×360、通常/reducedの各9場面（タイトル、装備、作成/合成、育成、敵レポート、設定保存、試聴3本メーター、改装版ガイド）を確認し、横溢れ0・pageerror0、reducedの実行中演出0。3本メーターは実再生中に表示、pauseイベント後に非表示。実時間の数値は各JSONのms/currentTimeで確認する。

最終動画は実描画フレームをChromeの時刻で20fpsへ割り当てて保存。演出の実時間はJSONのms/currentTimeでも照合する。使い捨て生成物の`dist-validation/menu-polish-motion/`へ保存し、監査ZIPへ直接同梱。Playwright任意ffmpeg取得がタイムアウトしたため既存ffmpegで記録。録画開始のタイミング・非同期操作後の計測継続を修正し、全4条件を最終再実行して成功（`motion-final.txt`と`motion-final-summary.json`）。操作スクリプトではpauseイベント/ダイアログ除去完了を待って測定するよう調整。製品ソースの修正はない。初回の失敗ログは補完前の記録として保持。

監査の回答待ちに、実通信の準備完了/再準備と週間報酬も844/640・通常/reducedの4条件を実時間録画して再確認。`MENU_RECORD_VIDEO=1 MENU_WIDTH=844 MENU_REDUCED=no-preference node scripts/check-menu-effects-network.mjs`（PowerShellでは各環境変数を設定）で再現できる。既存ffmpegを使用し、録画しない既定動作は維持。成功回数・150コイン・終了後DOM0・pageerror0が全条件成功。状態文字の横でチェックが現れて消え、週間受取行から所持コインへ粒子が移動する過程を動画の時系列フレームで目視確認した。結果は`network-motion-*.json/.txt`、比較は`*-weekly-sequence.jpg`と`*-squad-final-sequence.jpg`。動画8本は`dist-validation/menu-polish-network-motion/`、ハッシュは`network-videos.json`。この追加分は初回監査ZIPの送信後に取得した補足で、製品ソースは不変。実APIの隔離保存先は幅別に分け、既存検証データと本番データを変更しない。

## 監査・公開と残件

独立監査は指定されたiabの通常新規Chatを使用する。共有UI貸出UI-20261007-008で依頼を送信し、009/010で処理中を確認して返却済み。既存CloudflareのOAuth認証と既存アカウントを確認済み。契約APIは権限不足403だったが管理画面ではFree/$0/Current planを確認。当日153/100,000 requests、10/1〜10/7のrequests2.72k・CPU2,035ms。変更せず読み取りのみ。監査判定、通常merge、本番構成dry-run、Worker公開、配信照合は未実施。

実際のタブ非表示時cleanup、実機タッチ、GPU長時間負荷、全敵モデルの見え方は未実測。headlessの別タブはvisibleのままだった。戦闘演出と兵士音声PR137は保留。

使用モデルID・推論設定は未確認。

## 独立監査の確定判定

14:05 JSTごろ、[同じ通常Chat](https://chatgpt.com/c/6ac5cd95-d3f4-83ec-9f08-046535b388f4)で回答完了と**合格、必須P0/P1/P2各0・任意1**を確認。[確定本文](evidence/menu-polish-windows-20261007/audit-final.md)。実装対象7ef3228、初回証拠HEAD d573209、379ファイルSHA不一致/欠落0。任意は既存のタイトル線900ms期限で、遅いクラウド処理時に線が出ない可能性。今回の回帰ではなく非同期ガードは維持されるため、範囲外の改修を追加しない。監査側Linuxは依存取得未完で新規テスト再実行できず、Windowsのログ・動画・計測とソースを独立照合した。製品の追加修正は不要。以後の差分も製品src/server不変を確認して通常統合へ進む。

## 独立監査の依頼

13:43 JSTごろ、[通常Chat](https://chatgpt.com/c/6ac5cd95-d3f4-83ec-9f08-046535b388f4)へ`menu-polish-audit-d573209.zip`を直接添付送信し、対象差分の照合開始を確認。実装7ef3228、補足HEAD d57320925564cf3b9ed91bd4bb55b2c9b09a1903。ZIP7,729,771bytes、SHA256 `04e7a2df8879eb19b1e6d57a191174d13844e26f70fa1a8e1bcfdbef4c8581b6`、379ファイルのSHAとCRC一致。初回ZIP生成はWindowsのパス区切り不一致で検査に失敗したため送信せず修正し、上記の正常ZIPだけを送った。

iabの初期ローカル5347では、一時所持武器の選択後に成功線のDOMが見えた。設定画面は現在のFrontSettingsにも存在し、その見た目は古いキャッシュの証明にはならない。保存/キャッシュ削除は行わず、新規5352へ切替。新規入口では一時支給装備の成功線0・横溢れ0、従来版との往復を確認したが、初期URLの成功線が出た原因は厳密には未特定。監査依頼でこの観測を開示し、初期表示を対象ソースの合格根拠にはしない。現在ソースの一時所持武器は別途headless実行で成功線0と保存不変/再読込復帰を確認済み。動画はiabで844通常/640通常の再生を行い、実フレームの時系列と途中画像も照合。reducedは実時間計測/画像で確認。共有UIは送信後返却した。
